import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleCustomers } from '../lib/workbench.ts';
import { initialStrategies, strategyHits, priorityLevel, sceneTags, chinaDate, addDays, dateDiff } from '../lib/platform.ts';
import { Limiter, hashPassword, checkPassword } from '../server/security.ts';

test('后端策略返回规则编号、版本、实际数据和可复算权重',()=>{const c=sampleCustomers()[0];const hits=strategyHits(c,initialStrategies);assert.equal(hits.reduce((n,h)=>n+h.points,0),92);assert.deepEqual(hits.map(h=>h.id),['S-00','S-01','S-02','S-04']);assert(hits.every(h=>h.version&&h.condition&&h.field&&h.actual));assert.equal(strategyHits({...c,daysToMaturity:null,stable:null,demand:''},initialStrategies).length,1);assert(!strategyHits({...c,daysToMaturity:-1},initialStrategies).some(h=>h.id==='S-01'));});
test('联系颜色与场景标签覆盖边界值',()=>{assert.equal(priorityLevel(85).className,'priority-high');assert.equal(priorityLevel(84).className,'priority-medium');assert.equal(priorityLevel(59).className,'priority-normal');assert(sceneTags({...sampleCustomers()[0],daysToMaturity:0}).includes('15 天内到期'));assert(sceneTags({...sampleCustomers()[0],daysToMaturity:-1}).includes('已过到期日'));});
test('中国日期与到期计算跨月跨年一致',()=>{assert.equal(chinaDate(new Date('2026-12-31T17:00:00Z')),'2027-01-01');assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(dateDiff('2027-01-01','2026-12-31'),1);});
test('限流按独立键计数且窗口可恢复',()=>{const l=new Limiter();l.take('a',2,100,1);l.take('a',2,100,2);assert.throws(()=>l.take('a',2,100,3),/频繁/);l.take('b',2,100,3);l.take('a',2,100,102);});
test('密码使用独立盐，验证错误密码与未知账号返回失败',async()=>{const a=await hashPassword('unit-test-only-password'),b=await hashPassword('unit-test-only-password');assert.notEqual(a,b);assert(await checkPassword('unit-test-only-password',a));assert.equal(await checkPassword('wrong-password',a),false);assert.equal(await checkPassword('unknown-user-password',null),false);});
