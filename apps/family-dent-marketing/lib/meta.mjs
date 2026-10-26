import {createCipheriv,createDecipheriv,randomBytes,createHmac} from 'node:crypto';
import {safeMediaUrl} from './domain.mjs';
const version = () => {
  if (!/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION || '')) throw new Error('Укажите поддерживаемую версию META_GRAPH_VERSION.');
  return process.env.META_GRAPH_VERSION;
};
function key() { const k=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'base64');if(k.length!==32) throw new Error('Не настроен ключ шифрования.');return k; }
export function encrypt(value) {const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return [iv,c.getAuthTag(),data].map(x=>x.toString('base64')).join('.');}
export function decrypt(value) {const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64'));const c=createDecipheriv('aes-256-gcm',key(),iv);c.setAuthTag(tag);return Buffer.concat([c.update(data),c.final()]).toString('utf8');}
export async function graph(path,token,{method='GET',params={}}={}) {
  const u=new URL(`https://graph.facebook.com/${version()}/${path}`);
  const proof=process.env.META_APP_SECRET ? {appsecret_proof:createHmac('sha256',process.env.META_APP_SECRET).update(token).digest('hex')} : {};
  const form=new URLSearchParams({...params,...proof});
  if(method==='GET') u.search=form.toString();
  const r=await fetch(u,{method,headers:{Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:method==='POST'?form:undefined,signal:AbortSignal.timeout(45000)});
  const data=await r.json();
  if(!r.ok || data.error) throw new Error(`Meta отклонила запрос (код ${data.error?.code || r.status}). Проверьте разрешения, формат материала и подключение.`);
  return data;
}
export function oauthUrl(state,redirect) {
  return `https://www.facebook.com/${version()}/dialog/oauth?${new URLSearchParams({client_id:process.env.META_APP_ID,redirect_uri:redirect,state,scope:'pages_show_list,pages_read_engagement,pages_manage_posts,read_insights,instagram_basic,instagram_manage_insights,instagram_content_publish',response_type:'code'})}`;
}
export async function exchangeCode(code,redirect) {
  const u=new URL(`https://graph.facebook.com/${version()}/oauth/access_token`);
  const body=new URLSearchParams({client_id:process.env.META_APP_ID,client_secret:process.env.META_APP_SECRET,redirect_uri:redirect,code});
  const r=await fetch(u,{method:'POST',body,signal:AbortSignal.timeout(20000)});const result=await r.json();
  if(!r.ok || !result.access_token) throw new Error('Не удалось подключить Meta. Повторите вход.');
  return result;
}
export async function collectMetrics(account,token) {
  const rows=[];
  const observed_at=new Date().toISOString();
  if(account.platform==='instagram') {
    const basic=await graph(account.external_id,token,{params:{fields:'followers_count,media_count'}});
    for(const metric of ['followers_count','media_count']) if(Number.isFinite(basic[metric])) rows.push({metric,value:basic[metric],period:'lifetime',external_media_id:''});
    const stats=await graph(`${account.external_id}/insights`,token,{params:{metric:'reach',period:'day'}});
    for(const m of stats.data || []) for(const v of m.values || []) if(Number.isFinite(v.value)) rows.push({metric:m.name,value:v.value,period:`day:${v.end_time || ''}`,external_media_id:''});
    const media=await graph(`${account.external_id}/media`,token,{params:{fields:'id,media_type',limit:'25'}});
    for(const item of media.data || []) {
      try {
        const data=await graph(`${item.id}/insights`,token,{params:{metric:'reach,saved,likes,comments,shares'}});
        for(const m of data.data || []) for(const v of m.values || []) if(Number.isFinite(v.value)) rows.push({metric:m.name,value:v.value,period:'lifetime',external_media_id:item.id});
      } catch { rows.push({metric:'insights_unavailable',value:1,period:'status',external_media_id:item.id}); }
    }
  } else {
    const data=await graph(account.external_id,token,{params:{fields:'followers_count'}});
    if(Number.isFinite(data.followers_count)) rows.push({metric:'followers_count',value:data.followers_count,period:'lifetime',external_media_id:''});
    // Metric availability changes by Graph version. Errors are explicit, never zero-filled.
    const stats=await graph(`${account.external_id}/insights`,token,{params:{metric:'page_post_engagements',period:'day'}});
    for(const m of stats.data || []) for(const v of m.values || []) if(Number.isFinite(v.value)) rows.push({metric:m.name,value:v.value,period:`day:${v.end_time || ''}`,external_media_id:''});
  }
  return rows.map(r=>({...r,account_id:account.id,observed_at,source:'meta'}));
}
export async function preparePublication(account,item,token) {
  const url=safeMediaUrl(item.asset_url);
  if(!url) throw new Error('Нужна HTTPS-ссылка на доступный файл фото или видео.');
  if(account.platform==='facebook') {
    if(item.format!=='Пост')throw new Error('Для Facebook в этой версии доступно одиночное фото с текстом. Другие форматы отметьте вручную.');
    return graph(`${account.external_id}/photos`,token,{method:'POST',params:{url,published:'false'}});
  }
  if(!['Рилс','Пост'].includes(item.format)) throw new Error('Автопубликация первой версии поддерживает Рилс и одиночное фото. Карусели и сторис публикуются вручную.');
  const params=item.format==='Рилс'?{media_type:'REELS',video_url:url,caption:item.body}:{image_url:url,caption:item.body};
  return graph(`${account.external_id}/media`,token,{method:'POST',params});
}
