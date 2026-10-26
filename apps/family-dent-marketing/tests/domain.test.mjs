import test from 'node:test';
import assert from 'node:assert/strict';
import {canManage,approved,safeMediaUrl,validateWeekly,summarize} from '../lib/domain.mjs';
import {encrypt,decrypt} from '../lib/meta.mjs';
test('Financial access is limited to active marketers and leaders',()=>{
 for(const role of ['marketer','leadership'])assert.equal(canManage({role,active:true}),true);
 for(const role of ['staff','doctor','it'])assert.equal(canManage({role,active:true}),false);
 assert.equal(canManage({role:'leadership',active:false}),false);
});
test('Two distinct active leaders are required; doctor/duplicate votes do not count',()=>{
 const profiles=[{id:'a',role:'leadership',active:true},{id:'b',role:'leadership',active:true},{id:'c',role:'doctor',active:true}];
 const vote=id=>({plan_id:'p',reviewer_id:id,decision:'approved'});
 assert.equal(approved('p',[vote('a'),vote('a')],profiles),false);
 assert.equal(approved('p',[vote('a'),vote('c')],profiles),false);
 assert.equal(approved('p',[vote('a'),vote('b')],profiles),true);
 profiles[1].active=false;assert.equal(approved('p',[vote('a'),vote('b')],profiles),false);
});
test('Only valid public HTTPS links can be sent to Meta',()=>{
 for(const u of ['javascript:alert(1)','http://files.example/a','https://localhost/a','https://127.0.0.1/a','https://user:secret@example.com/a','https://[::1]/a'])assert.equal(safeMediaUrl(u),null);
 assert.equal(safeMediaUrl('https://drive.google.com/file/d/ABC-123/view'),'https://drive.google.com/uc?export=download&id=ABC-123');
 assert.equal(safeMediaUrl('https://drive.google.com/drive/folders/ABC'),null);
});
test('Weekly entry rejects invalid Mondays, negative counts, fractional counts and invalid money',()=>{
 const payload={week_start:'2026-10-26',branch_id:'20000000-0000-4000-8000-000000000001',direction_id:'10000000-0000-4000-8000-000000000001',source_id:'30000000-0000-4000-8000-000000000001',inquiries:5};
 assert.doesNotThrow(()=>validateWeekly(payload,150.25));
 assert.throws(()=>validateWeekly({...payload,week_start:'2026-10-27'},150));
 assert.throws(()=>validateWeekly({...payload,inquiries:-1},150));
 assert.throws(()=>validateWeekly({...payload,inquiries:1.5},150));
 assert.throws(()=>validateWeekly(payload,150.001));
 assert.throws(()=>validateWeekly(payload,NaN));
});
test('Budget is excluded from actual expenditure and conversion handles missing denominator',()=>{
 const result=summarize([{inquiries:8,bookings:0,first_visits:0}],[{amount:1000}],[{amount:100,type:'regular'},{amount:900,type:'budget'}]);
 assert.equal(result.spend,100);assert.equal(result.receipts,1000);assert.equal(result.conversion,null);
});
test('Encrypted social credentials roundtrip and tampering is rejected',()=>{
 process.env.TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 const token=encrypt('test-token');assert.equal(decrypt(token),'test-token');assert.ok(!token.includes('test-token'));
 const chunks=token.split('.');chunks[2]=Buffer.from('tampered').toString('base64');assert.throws(()=>decrypt(chunks.join('.')));
});
