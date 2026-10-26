import {db,allRows} from './lib/supabase.mjs';
import {graph,decrypt,collectMetrics,preparePublication} from './lib/meta.mjs';
import {approved} from './lib/domain.mjs';
const service={service:true};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function update(table,id,body){return db(`${table}?id=eq.${id}`,{...service,method:'PATCH',body});}

export async function runWorker(){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Не настроены переменные Supabase для worker.');
 const credentials=await db('rpc/worker_credentials',{...service,method:'POST',body:{}});
 const accounts=await allRows('social_accounts?archived=eq.false',service);
 const byId=new Map();
 for(const c of credentials){try{byId.set(c.account_id,decrypt(c.encrypted_token));}catch{await db('sync_runs',{...service,method:'POST',body:{account_id:c.account_id,status:'error',message:'Не удалось расшифровать ключ подключения. Проверьте TOKEN_ENCRYPTION_KEY.'}});}}
 for(const account of accounts){
  const token=byId.get(account.id);if(!token||!account.external_id)continue;
  // Publishing checks every 5 min; expensive metrics collection is once per hour.
  if(account.last_synced_at&&Date.now()-Date.parse(account.last_synced_at)<55*60000)continue;
  try{
   const rows=await collectMetrics(account,token);
   if(rows.length)await db('social_metric_snapshots',{...service,method:'POST',body:rows});
   await update('social_accounts',account.id,{connection_status:'connected',last_synced_at:new Date().toISOString()});
   await db('sync_runs',{...service,method:'POST',body:{account_id:account.id,status:'success',message:`Получено показателей: ${rows.length}`}});
  }catch(e){
   await update('social_accounts',account.id,{connection_status:'needs_attention'});
   await db('sync_runs',{...service,method:'POST',body:{account_id:account.id,status:'error',message:e.message}});
  }
 }
 // A crashed request may already have published. Never blindly retry stale processing jobs.
 await db(`publications?status=eq.processing&updated_at=lt.${encodeURIComponent(new Date(Date.now()-15*60000).toISOString())}`,{...service,method:'PATCH',body:{status:'uncertain',error:'Отправка прервалась. Проверьте аккаунт перед повторной публикацией.'}});
 if(process.env.META_PUBLISHING_ENABLED!=='true')return;
 for(let n=0;n<10;n++){
  const [job]=await db('rpc/claim_publication',{...service,method:'POST',body:{}});if(!job)break;
  let publishingStarted=false;
  try{
   const [item]=await db(`content_items?id=eq.${job.content_id}`,service);
   const account=accounts.find(a=>a.id===job.account_id);const token=byId.get(job.account_id);
   if(!item||!account||!token)throw new Error('Аккаунт или материал недоступен.');
   const votes=await db(`plan_approvals?plan_id=eq.${item.plan_id}`,service),profiles=await allRows('profiles',service);
   if(!approved(item.plan_id,votes,profiles))throw new Error('У плана нет двух действующих одобрений руководства.');
   if(!['ready','scheduled'].includes(item.status))throw new Error('Материал не отмечен как готовый.');
   const container=await preparePublication(account,item,token);
   await update('publications',job.id,{container_id:container.id});
   let ready=account.platform==='facebook';
   for(let attempt=0;!ready&&attempt<10;attempt++){
    const state=await graph(container.id,token,{params:{fields:'status_code'}});
    if(state.status_code==='FINISHED'){ready=true;break;}
    if(['ERROR','EXPIRED'].includes(state.status_code))throw new Error('Meta не смогла подготовить материал. Проверьте формат и доступность файла.');
    await sleep(4000);
   }
   if(!ready)throw new Error('Meta ещё обрабатывает материал. Проверьте его перед повторной отправкой.');
   // Recheck approvals after media processing; no silent send after revoked approval.
   const latestVotes=await db(`plan_approvals?plan_id=eq.${item.plan_id}`,service);
   if(!approved(item.plan_id,latestVotes,await allRows('profiles',service)))throw new Error('Одобрение плана изменилось до отправки.');
   publishingStarted=true;
   const published=account.platform==='facebook'
    ?await graph(`${account.external_id}/feed`,token,{method:'POST',params:{message:item.body,attached_media:JSON.stringify([{media_fbid:container.id}])}})
    :await graph(`${account.external_id}/media_publish`,token,{method:'POST',params:{creation_id:container.id}});
   await update('publications',job.id,{external_id:published.id,status:'published',updated_at:new Date().toISOString()});
   await update('content_items',item.id,{status:'published'});
   // Publishing is already committed. A failed permalink lookup must not trigger a second send.
   try{const key=account.platform==='facebook'?'permalink_url':'permalink';const info=await graph(published.id,token,{params:{fields:key}});await update('publications',job.id,{permalink:info[key]});}catch{}
  }catch(e){await update('publications',job.id,{status:publishingStarted?'uncertain':'failed',error:e.message,updated_at:new Date().toISOString()});}
 }
}
if(import.meta.url===new URL(process.argv[1],'file:///').href || process.argv[1]?.endsWith('worker.mjs')){
 runWorker().then(()=>console.log('Синхронизация завершена')).catch(()=>{console.error('Worker завершился с ошибкой. Проверьте переменные сервиса и записи sync_runs.');process.exitCode=1;});
}
