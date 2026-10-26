import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
// Optional local PostgreSQL-WASM verifier: npm install --no-save @electric-sql/pglite
// Or supply PGLITE_MODULE pointing to its dist/index.js. Never connects to a company database.
let PGlite;
try{({PGlite}=await import(process.env.PGLITE_MODULE?pathToFileURL(process.env.PGLITE_MODULE).href:'@electric-sql/pglite'));}catch{}
test('PostgreSQL migration, financial isolation, role escalation, approvals and atomic reports',{skip:!PGlite},async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$; grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
  for(const name of ['001_initial.sql','002_content_and_security.sql']){
   const sql=(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;','');
   await pg.exec(sql);
  }
  await pg.exec(await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
  const ids=['40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004'];
  for(let i=0;i<ids.length;i++)await pg.query(`insert into auth.users values($1);`,[ids[i]]);
  for(let i=0;i<ids.length;i++)await pg.query(`insert into public.profiles(id,display_name,role,active) values($1,$2,$3,true)`,[ids[i],'Test '+i,['marketer','staff','leadership','leadership'][i]]);
  async function as(id){await pg.exec('reset role;');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await pg.exec("select set_config('request.jwt.claim.role','authenticated',false);set role authenticated;");}
  await as(ids[0]);
  await pg.exec("insert into public.expenses(title,amount,paid_on) values('test',125,'2026-10-26');");
  assert.equal((await pg.query('select * from public.expenses')).rows.length,1);
  const payload={week_start:'2026-10-26',branch_id:'20000000-0000-4000-8000-000000000001',direction_id:'10000000-0000-4000-8000-000000000001',source_id:(await pg.query("select id from public.categories where kind='source' and name='Instagram'")).rows[0].id,inquiries:10,bookings:5,first_visits:4};
  await pg.query('select public.submit_weekly_report($1::jsonb,1200)',[JSON.stringify(payload)]);
  await pg.query('select public.submit_weekly_report($1::jsonb,1300)',[JSON.stringify({...payload,inquiries:11})]);
  assert.equal((await pg.query('select * from public.weekly_reports')).rows.length,1);
  assert.equal(Number((await pg.query('select amount from public.weekly_receipts')).rows[0].amount),1300);
  await assert.rejects(pg.query('select public.submit_weekly_report($1::jsonb,-1)',[JSON.stringify({...payload,inquiries:99})]));
  assert.equal((await pg.query('select inquiries from public.weekly_reports')).rows[0].inquiries,11);
  const plan=(await pg.query("insert into public.content_plans(title,starts_on,ends_on) values('Plan','2026-10-01','2026-10-31') returning id")).rows[0].id;
  await as(ids[1]);
  assert.equal((await pg.query('select * from public.expenses')).rows.length,0);
  assert.equal((await pg.query('select * from public.weekly_receipts')).rows.length,0);
  assert.equal((await pg.query('select * from public.weekly_reports')).rows.length,1);
  await assert.rejects(pg.query("update public.profiles set role='leadership' where id=$1",[ids[1]]));
  await assert.rejects(pg.exec("insert into public.expenses(title,amount,paid_on) values('forbidden',1,'2026-10-26')"));
  await assert.rejects(pg.query("insert into public.plan_approvals(plan_id,decision) values($1,'approved')",[plan]));
  await assert.rejects(pg.exec('select * from public.worker_credentials()'));
  for(let i=2;i<=3;i++){
   await as(ids[i]);await pg.query("insert into public.plan_approvals(plan_id,decision) values($1,'approved')",[plan]);
   assert.equal((await pg.query('select public.plan_is_approved($1) ok',[plan])).rows[0].ok,i===3);
  }
  await as(ids[0]);
  const item={plan_id:plan,direction_id:payload.direction_id,title:'Test content',format:'Рилс',status:'ready',body:'Original',asset_url:'https://files.example/test.mp4'};
  const content=(await pg.query('select public.save_content(null,$1::jsonb,array[]::uuid[]) id',[JSON.stringify(item)])).rows[0].id;
  await pg.query('select public.save_content($1,$2::jsonb,array[]::uuid[])',[content,JSON.stringify({...item,body:'Edited'})]);
  assert.equal((await pg.query('select public.plan_is_approved($1) ok',[plan])).rows[0].ok,true);
  assert.equal((await pg.query('select * from public.content_versions')).rows.length,2);
  const account=(await pg.query('select id from public.social_accounts limit 1')).rows[0].id;
  await pg.query("insert into public.publications(content_id,account_id,scheduled_at) values($1,$2,now())",[content,account]);
  await as(ids[1]);
  await assert.rejects(pg.query("insert into public.publications(content_id,account_id,scheduled_at) values($1,$2,now())",[content,account]));
  await pg.exec('reset role;set role anon;');
  await assert.rejects(pg.exec('select * from public.weekly_reports'));
 }finally{await pg.close();}
});
