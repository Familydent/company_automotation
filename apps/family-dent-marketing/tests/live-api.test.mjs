import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
test('Live API applies identity and never includes financial tables in a staff bootstrap',async()=>{
 const id='40000000-0000-4000-8000-000000000001';
 const queried=[];
 const upstream=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://test');const token=req.headers.authorization?.replace('Bearer ','');
  res.setHeader('Content-Type','application/json');
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id}));return;}
  const table=url.pathname.split('/').pop();queried.push({token,table});
  const result=table==='profiles'?[{id,display_name:'Test',active:true,role:token==='staff-token'?'staff':'marketer'}]:table==='expenses'?[{id:'expense',amount:100}]:[];
  res.end(JSON.stringify(result));
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 process.env.SUPABASE_URL=`http://127.0.0.1:${upstream.address().port}`;process.env.SUPABASE_ANON_KEY='test-key';
 const {server}=await import('../server.mjs');server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const response=await fetch(base+'/api/bootstrap',{headers:{Cookie:'fd_access=staff-token'}});assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.profile.role,'staff');assert.ok(!('expenses'in body));assert.ok(!('weekly_receipts'in body));assert.ok(!('audit_log'in body));
  assert.ok(!queried.some(q=>q.table==='expenses'||q.table==='weekly_receipts'));
  let r=await fetch(base+'/api/weekly',{method:'POST',headers:{Cookie:'fd_access=staff-token',Origin:'http://localhost:3000','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
  r=await fetch(base+'/api/bootstrap',{headers:{Cookie:'fd_access=manager-token'}});const manager=await r.json();assert.equal(manager.expenses[0].amount,100);
  assert.ok(queried.every(q=>['staff-token','manager-token'].includes(q.token)));
 }finally{await new Promise(r=>server.close(r));await new Promise(r=>upstream.close(r));}
});
