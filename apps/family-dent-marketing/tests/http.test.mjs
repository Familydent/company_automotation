import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {server} from '../server.mjs';
test('HTTP boundaries: no unauthenticated data, secrets, CSRF or arbitrary files',async()=>{
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
  let r=await fetch(base+'/health');assert.equal(r.status,200);
  r=await fetch(base+'/api/bootstrap');assert.equal(r.status,401);
  r=await fetch(base+'/api/data/expenses',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
  r=await fetch(base+'/.env');assert.equal(r.status,404);
  r=await fetch(base+'/server.mjs');assert.equal(r.status,404);
  r=await fetch(base+'/api/auth/invitation',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
  r=await fetch(base+'/calendar');assert.equal(r.status,200);assert.match(await r.text(),/lang="ru"/);
  assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  r=await fetch(base+'/api/config');const config=await r.json();assert.deepEqual(Object.keys(config).sort(),['configured','demo','publishing']);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
