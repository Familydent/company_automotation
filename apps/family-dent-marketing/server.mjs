import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {supabase,db,allRows,configured} from './lib/supabase.mjs';
import {canManage,canConnect,validateWeekly} from './lib/domain.mjs';
import {oauthUrl,exchangeCode,graph,encrypt} from './lib/meta.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const production=process.env.NODE_ENV==='production';
const demo=!configured() && (process.env.ALLOW_DEMO==='true' || (!production && process.env.ALLOW_DEMO!=='false'));
const origin=()=>process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const cookies=req=>Object.fromEntries((req.headers.cookie || '').split(';').map(s=>s.trim().split(/=(.*)/s)).filter(x=>x[0]).map(([k,v])=>[k,decodeURIComponent(v || '')]));
function cookie(name,value,age=3600) {return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${production?'; Secure':''}`;}
function sessionCookies(data) {return [cookie('fd_access',data.access_token,data.expires_in || 3600),cookie('fd_refresh',data.refresh_token,60*60*24*14)];}
function send(res,status,data) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req) {let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>150000)throw Object.assign(new Error('Слишком большой запрос.'),{status:413});}try{return JSON.parse(text || '{}');}catch{throw Object.assign(new Error('Некорректный JSON.'),{status:400});}}
async function identity(req) {
 const token=cookies(req).fd_access;
 if(!token) throw Object.assign(new Error('Войдите в приложение.'),{status:401});
 const user=await supabase('/auth/v1/user',{token});
 const [profile]=await db(`profiles?id=eq.${encodeURIComponent(user.id)}&select=*`,{token});
 if(!profile?.active) throw Object.assign(new Error('Доступ ещё не выдан. Обратитесь к IT-руководителю.'),{status:403});
 return {token,profile};
}
const tables=['directions','branches','categories','profiles','goals','content_plans','content_items','content_doctors','content_versions','doctors','tasks','plan_approvals','medical_reviews','comments','partners','partner_activities','events','ideas','campaigns','metric_definitions','weekly_metric_values','social_accounts','publications','sync_runs'];
const fields={
 goals:['title','direction_id','channel','target','due_date','status'],content_plans:['title','starts_on','ends_on'],
 content_items:['title','plan_id','direction_id','format','objective','language','body','asset_url','publish_at','assignee_id','status'],
 tasks:['title','direction_id','content_id','goal_id','assignee_id','due_date','status','link'],
 partners:['name','kind','direction_id','owner_id','status','next_action','next_date'],partner_activities:['partner_id','body'],
 events:['title','direction_id','starts_on','kind','description'],ideas:['title','direction_id','description'],
 doctors:['name','specialty','branch_id','monthly_target','archived'],categories:['kind','name','archived'],
 directions:['name','short_name','color','description','archived'],branches:['name','archived'],
 campaigns:['title','direction_id','source_id','starts_on','ends_on','status'],metric_definitions:['direction_id','name','unit','archived'],
 social_accounts:['direction_id','platform','handle','url','external_id','archived'],
 expenses:['title','amount','paid_on','direction_id','campaign_id','category_id','type'],comments:['content_id','plan_id','body']
};
const attempts=new Map();
function throttle(req) {const key=req.socket.remoteAddress;const now=Date.now();const old=attempts.get(key);const v=old && now-old.start<60000?old:{start:now,n:0};v.n++;attempts.set(key,v);if(attempts.size>10000)for(const[k,v]of attempts)if(now-v.start>60000)attempts.delete(k);if(v.n>20)throw Object.assign(new Error('Слишком много попыток. Подождите минуту.'),{status:429});}

export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 if(production) res.setHeader('Strict-Transport-Security','max-age=31536000');
 try {
  const url=new URL(req.url,origin());const route=url.pathname;
  if(!['GET','HEAD'].includes(req.method) && req.headers.origin!==new URL(origin()).origin) throw Object.assign(new Error('Запрос с другого сайта запрещён.'),{status:403});
  if(route==='/health') return send(res,200,{status:'ok',database:configured()?'configured':'not_configured'});
  if(route==='/api/config') return send(res,200,{demo,configured:configured(),publishing:process.env.META_PUBLISHING_ENABLED==='true'});
  if(route==='/api/auth/login' && req.method==='POST') {
    throttle(req);const input=await body(req);
    if(typeof input.email!=='string'||typeof input.password!=='string') return send(res,400,{error:'Укажите почту и пароль.'});
    const result=await supabase('/auth/v1/token?grant_type=password',{method:'POST',body:{email:input.email,password:input.password}});
    res.setHeader('Set-Cookie',sessionCookies(result));return send(res,200,{ok:true});
  }
  if(route==='/api/auth/refresh' && req.method==='POST') {
    throttle(req);const refresh_token=cookies(req).fd_refresh;if(!refresh_token)return send(res,401,{error:'Войдите заново.'});
    const result=await supabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token}});
    res.setHeader('Set-Cookie',sessionCookies(result));return send(res,200,{ok:true});
  }
  if(route==='/api/auth/invitation' && req.method==='POST') {
    throttle(req);const input=await body(req);
    if(typeof input.access_token!=='string'||typeof input.refresh_token!=='string')return send(res,400,{error:'Ссылка приглашения недействительна.'});
    await supabase('/auth/v1/user',{token:input.access_token});
    res.setHeader('Set-Cookie',sessionCookies(input));return send(res,200,{ok:true});
  }
  if(route==='/api/auth/recover' && req.method==='POST') {
    throttle(req);const input=await body(req);
    if(typeof input.email!=='string')return send(res,400,{error:'Укажите рабочую почту.'});
    await supabase(`/auth/v1/recover?redirect_to=${encodeURIComponent(origin()+'/login')}`,{method:'POST',body:{email:input.email}});
    return send(res,200,{ok:true});
  }
  if(route==='/api/auth/logout' && req.method==='POST') {res.setHeader('Set-Cookie',[cookie('fd_access','',0),cookie('fd_refresh','',0)]);return send(res,200,{ok:true});}
  if(route.startsWith('/api/')) {
    const {token,profile}=await identity(req);
    if(route==='/api/auth/password' && req.method==='POST') {
      const {password}=await body(req);if(typeof password!=='string'||password.length<12)return send(res,400,{error:'Пароль должен содержать не менее 12 символов.'});
      await supabase('/auth/v1/user',{token,method:'PUT',body:{password}});return send(res,200,{ok:true});
    }
    if(route==='/api/bootstrap' && req.method==='GET') {
      const data={profile};
      const start=url.searchParams.get('from') || new Date(Date.now()-90*86400000).toISOString().slice(0,10);
      const end=url.searchParams.get('to') || new Date().toISOString().slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw Object.assign(new Error('Проверьте период.'),{status:400});
      await Promise.all(tables.map(async t=>{data[t]=await allRows(t,{token});}));
      data.weekly_reports=await allRows(`weekly_reports?week_start=gte.${start}&week_start=lte.${end}`,{token});
      data.social_metric_snapshots=await db('social_metric_snapshots?order=observed_at.desc&limit=1000',{token});
      if(canManage(profile)) {
        data.expenses=await allRows(`expenses?paid_on=gte.${start}&paid_on=lte.${end}`,{token});
        const ids=data.weekly_reports.map(r=>r.id);
        data.weekly_receipts=[];
        for(let i=0;i<ids.length;i+=100)data.weekly_receipts.push(...await allRows(`weekly_receipts?report_id=in.(${ids.slice(i,i+100).join(',')})`,{token}));
        data.audit_log=await db('audit_log?order=created_at.desc&limit=100',{token});
      }
      return send(res,200,data);
    }
    if(route==='/api/content' && req.method==='POST') {
      if(!canManage(profile))return send(res,403,{error:'Недостаточно прав.'});
      const {id,values,doctor_ids}=await body(req);
      const clean=Object.fromEntries(Object.entries(values||{}).filter(([k])=>fields.content_items.includes(k)));
      if(!Array.isArray(doctor_ids)||doctor_ids.length>100)return send(res,400,{error:'Проверьте список врачей.'});
      const result=await db('rpc/save_content',{token,method:'POST',body:{record_id:id||null,payload:clean,doctor_ids}});return send(res,200,{id:result});
    }
    if(route==='/api/weekly' && req.method==='POST') {
      if(!canManage(profile))return send(res,403,{error:'Недостаточно прав.'});
      const {payload,receipt}=await body(req);validateWeekly(payload,receipt);
      const id=await db('rpc/submit_weekly_report',{token,method:'POST',body:{payload,receipt}});return send(res,200,{id});
    }
    if(route==='/api/approval' && req.method==='POST') {
      const {plan_id,decision,comment='',medical=false,content_id}=await body(req);
      if(medical?!['doctor','leadership'].includes(profile.role):profile.role!=='leadership')return send(res,403,{error:'Недостаточно прав для одобрения.'});
      if(!['approved','rejected'].includes(decision))return send(res,400,{error:'Укажите решение.'});
      const table=medical?'medical_reviews':'plan_approvals';const data={reviewer_id:profile.id,decision,comment,...(medical?{content_id}:{plan_id})};
      await db(table,{token,method:'POST',body:data,prefer:'resolution=merge-duplicates'});return send(res,200,{ok:true});
    }
    if(route==='/api/publish' && req.method==='POST') {
      if(!canManage(profile))return send(res,403,{error:'Недостаточно прав.'});
      if(process.env.META_PUBLISHING_ENABLED!=='true')return send(res,503,{error:'Автопубликация включается после настройки Meta и проверки материалов. Пока добавьте ссылку на ручную публикацию.'});
      const {content_id,account_id,scheduled_at}=await body(req);
      if(!Number.isFinite(Date.parse(scheduled_at)))return send(res,400,{error:'Укажите время публикации.'});
      const [account]=await db(`social_accounts?id=eq.${encodeURIComponent(account_id)}`,{token});
      if(!account?.external_id || account.connection_status!=='connected')return send(res,400,{error:'Сначала подключите аккаунт.'});
      const result=await db('publications',{token,method:'POST',body:{content_id,account_id,scheduled_at,created_by:profile.id},prefer:'return=representation'});return send(res,201,result);
    }
    if(route==='/api/manual-publication' && req.method==='POST') {
      if(!canManage(profile))return send(res,403,{error:'Недостаточно прав.'});
      // Status alone is not proof of a platform publication; manual link is recorded in content body/comment.
      const {content_id,permalink}=await body(req);const link=new URL(permalink);
      if(link.protocol!=='https:'||!['www.instagram.com','instagram.com','www.facebook.com','facebook.com'].includes(link.hostname))return send(res,400,{error:'Нужна ссылка на публикацию Instagram или Facebook.'});
      await db(`content_items?id=eq.${encodeURIComponent(content_id)}`,{token,method:'PATCH',body:{status:'published'}});
      await db('comments',{token,method:'POST',body:{content_id,body:`Опубликовано вручную: ${link.href}`}});return send(res,200,{ok:true});
    }
    if(route==='/api/meta/connect' && req.method==='GET') {
      if(!canConnect(profile))return send(res,403,{error:'Недостаточно прав.'});
      if(!process.env.META_APP_ID||!process.env.META_APP_SECRET||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.TOKEN_ENCRYPTION_KEY)return send(res,503,{error:'IT-руководителю нужно настроить ключи Meta, Supabase и шифрования на сервере.'});
      const state=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',cookie('fd_oauth_state',state,600));res.writeHead(302,{Location:oauthUrl(state,`${origin()}/api/meta/callback`)});return res.end();
    }
    if(route==='/api/meta/callback' && req.method==='GET') {
      if(!canConnect(profile))return send(res,403,{error:'Недостаточно прав.'});
      const state=url.searchParams.get('state')||'';const expected=cookies(req).fd_oauth_state||'';
      if(!expected||state.length!==expected.length||!timingSafeEqual(Buffer.from(state),Buffer.from(expected)))return send(res,403,{error:'Недействительное подтверждение Meta. Повторите подключение.'});
      res.setHeader('Set-Cookie',cookie('fd_oauth_state','',0));
      const result=await exchangeCode(url.searchParams.get('code'),`${origin()}/api/meta/callback`);
      const accounts=await allRows('social_accounts',{token});
      let pages=await graph('me/accounts',result.access_token,{params:{fields:'id,name,link,access_token,instagram_business_account{id,username}',limit:'100'}});
      let count=0;
      while(pages){
       for(const page of pages.data||[]) {
        for(const a of accounts) {
          const normalized=value=>{try{const u=new URL(value);return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+(u.searchParams.get('id')?'?id='+u.searchParams.get('id'):'');}catch{return '';}};
          const matches=a.platform==='instagram'?a.handle===page.instagram_business_account?.username:(a.external_id===page.id||a.handle===page.id||normalized(a.url)===normalized(page.link));
          if(!matches)continue;
          const external_id=a.platform==='instagram'?page.instagram_business_account.id:page.id;
          await db(`social_accounts?id=eq.${a.id}`,{service:true,method:'PATCH',body:{external_id,connection_status:'connected'}});
          await db('rpc/store_social_credential',{service:true,method:'POST',body:{account:a.id,token:encrypt(page.access_token),expires:null}});count++;
        }
       }
       const next=pages.paging?.cursors?.after;
       if(!pages.paging?.next||!next)break;
       pages=await graph('me/accounts',result.access_token,{params:{fields:'id,name,link,access_token,instagram_business_account{id,username}',limit:'100',after:next}});
      }
      res.writeHead(302,{Location:`/settings?connected=${count}`});return res.end();
    }
    const match=route.match(/^\/api\/data\/([a-z_]+)(?:\/([0-9a-f-]{36}))?$/i);
    if(match && ['POST','PATCH'].includes(req.method)) {
      const [,table,id]=match;const allow=fields[table];if(!allow)return send(res,404,{error:'Раздел не найден.'});
      const input=await body(req);const clean=Object.fromEntries(Object.entries(input).filter(([k])=>allow.includes(k)));
      if(req.method==='PATCH'&&!id)return send(res,400,{error:'Не указана запись.'});
      if(Object.keys(clean).length===0)return send(res,400,{error:'Нет данных для сохранения.'});
      const result=await db(table+(id?`?id=eq.${id}`:''),{token,method:req.method,body:clean,prefer:'return=representation'});
      if(!result?.length)return send(res,403,{error:'Запись не изменена: проверьте права доступа.'});return send(res,200,result);
    }
    return send(res,404,{error:'Действие не найдено.'});
  }
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Метод не поддерживается.'});
  const decoded=decodeURIComponent(route);
  if(decoded.split('/').some(part=>part.startsWith('.')))return send(res,404,{error:'Файл не найден.'});
  let target=path.resolve(root,`.${decoded}`);
  if(target!==root&&!target.startsWith(root+path.sep))return send(res,403,{error:'Доступ запрещён.'});
  if(!path.extname(target))target=path.join(root,'index.html');
  try {if(!(await stat(target)).isFile())return send(res,404,{error:'Файл не найден.'});}catch{return send(res,404,{error:'Файл не найден.'});}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:await readFile(target));
 } catch(e) {send(res,e.status || 500,{error:e.status?e.message:'Не удалось выполнить действие. Проверьте настройки подключения и повторите попытку.'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Family Dent: ${origin()} (${demo?'demo':'live'})`));
