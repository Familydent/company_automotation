import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDemo} from '../public/demo.js';
test('Preview includes the complete screen data contract without real patient records',()=>{
 const d=makeDemo();
 for(const t of ['profiles','directions','social_accounts','categories','content_items','content_plans','tasks','social_metric_snapshots','publications','sync_runs','weekly_reports','weekly_receipts','expenses'])assert.ok(Array.isArray(d[t]),t);
 assert.equal(d.directions.length,6);assert.equal(d.social_accounts.length,7);
 assert.equal(d.social_metric_snapshots.length,0);assert.ok(!('patients'in d));
 assert.ok(d.doctors.every(r=>r.name.includes('пример')));
});
