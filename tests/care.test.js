/* 실행: node tests/care.test.js — js/care.js(타임라인 계산) 점검 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const Care = require('../js/care.js');
const D = require('../js/dur.js');
const dur = D.create({
  pairs: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/dur-pairs.json'), 'utf8')),
  products: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/products.json'), 'utf8'))
});
const groups = JSON.parse(fs.readFileSync(path.join(root, 'data/care/groups.json'), 'utf8'));
const E = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/care-entries.json'), 'utf8'));

const code = (q) => dur.search(q, { limit: 1 })[0].code;
const drug = (id, q, times) => dur.toItem(code(q), { id, times });
const key = (q) => dur.get(code(q)).ingrName.toLowerCase();
// 시험용 묶음: 씬지로이드(레보티록신)와 메토폴(메트포르민)에만 규칙이 있다
const pack = { entries: { [key('씬지로이드정0.075')]: E.levothyroxine, [key('메토폴정')]: E.metformin } };
const care = Care.create({ pack, dur, groups });
const supp = (id, keys, times, name) => ({ id, kind: 'supp', name: name || '칼슘 영양제', ingredientKeys: keys, times });
const flagsOf = (m, id) => m.slots.flatMap((s) => s.items).filter((x) => x.itemId === id).flatMap((x) => x.flags);

let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

const base = () => [drug('levo', '씬지로이드정0.075', ['07:00']), supp('ca', ['calcium'], ['09:00']),
                    drug('alma', '알마겔에프', ['08:00']), drug('nex', '넥시움정20', ['07:30'])];

t('규칙 묶음에서 제품의 성분으로 항목을 찾는다', () => {
  assert.ok(care.entryOf(drug('x', '씬지로이드정0.075', [])), '씬지로이드 entry');
  assert.strictEqual(care.entryOf(drug('y', '후로스판', [])), null);
});
t('칼슘 영양제가 2시간 차: "최소 4시간 간격 안내" + 시간 제안 11:00', () => {
  const m = care.analyze(base(), {});
  const f = flagsOf(m, 'levo').find((x) => x.withItemIds.includes('ca'));
  assert.ok(f && /최소 4시간 간격 안내/.test(f.short) && f.grade === 'label' && f.severity === 'caution', JSON.stringify(f));
  const s = m.suggestions.find((x) => x.itemId === 'ca');
  assert.ok(s && s.suggestTime === '11:00', JSON.stringify(m.suggestions));
});
t('근거 시트에는 허가사항 원문이 그대로 있고 출처·확인일이 붙는다', () => {
  const m = care.analyze(base(), {});
  const f = flagsOf(m, 'levo').find((x) => x.withItemIds.includes('ca'));
  const ev = m.evidence[f.id];
  assert.ok(/최소 4시간 간격/.test(ev.excerpt) && /허가사항/.test(ev.source.label) && ev.source.url && ev.source.checkedAt, JSON.stringify(ev));
});
t('알마겔에프(제산제)·넥시움(PPI)이 분류 표현으로 연결된다(시간 숫자가 없는 안내)', () => {
  const fl = flagsOf(care.analyze(base(), {}), 'levo');
  assert.ok(fl.some((x) => x.withItemIds.includes('alma') && /병용 주의 안내/.test(x.short)), '제산제');
  assert.ok(fl.some((x) => x.withItemIds.includes('nex')), 'PPI');
});
t('안내된 간격(4시간) 이상 떨어져 있으면 경고하지 않고 ok에 기록한다', () => {
  const items = base(); items[1].times = ['12:00'];
  const m = care.analyze(items, {});
  assert.ok(!flagsOf(m, 'levo').some((x) => x.withItemIds.includes('ca')));
  assert.ok(m.ok.some((o) => o.itemIds.includes('ca')));
  assert.ok(!m.suggestions.some((x) => x.itemId === 'ca'));
});
t('복용 시간이 없는 영양제는 간격을 계산하지 못하므로 일반 안내로만 보여준다', () => {
  const items = base(); items[1].times = [];
  const f = flagsOf(care.analyze(items, {}), 'levo').find((x) => x.withItemIds.includes('ca'));
  assert.ok(f && /최소 4시간 간격 안내/.test(f.short) && !/지금/.test(f.short));
});
t('등록하지 않은 영양제와는 연결하지 않는다(칼슘을 안 먹으면 칼슘 안내가 없다)', () => {
  const items = [drug('levo', '씬지로이드정0.075', ['07:00'])];
  assert.deepStrictEqual(flagsOf(care.analyze(items, {}), 'levo'), []);
});
t('임신 상태를 골랐을 때만 임신 안내가 붙는다', () => {
  const items = [drug('levo', '씬지로이드정0.075', ['07:00'])];
  assert.deepStrictEqual(flagsOf(care.analyze(items, {}), 'levo'), []);
  const m = care.analyze(items, { states: ['pregnant'] });
  const f = flagsOf(m, 'levo')[0];
  assert.ok(f && f.kind === 'state' && /임신 중에도 치료를 중단하지 않는다/.test(m.evidence[f.id].excerpt));
});
t('음식 주의(알코올)는 상대 없이 약 자체에 붙고, 복용 시점이 읽힌다', () => {
  const m = care.analyze([drug('metf', '메토폴정', ['19:00'])], {});
  const item = m.slots[0].items[0];
  assert.ok(item.flags.some((f) => f.kind === 'food' && /알코올/.test(f.short)), JSON.stringify(item.flags));
  assert.ok(item.mealRelation && /식사와 함께/.test(item.mealRelation.label), JSON.stringify(item.mealRelation));
});
t('병용금기(DUR)는 ① 공식 지정으로 양쪽에 붙는다', () => {
  const m = care.analyze([drug('s', '시바스정', ['21:00']), drug('i', '이트코나졸캡슐', ['08:30'])], {});
  const a = flagsOf(m, 's')[0], b = flagsOf(m, 'i')[0];
  assert.ok(a && a.grade === 'official' && b && b.grade === 'official');
  assert.ok(/횡문근융해증/.test(m.evidence[a.id].excerpt));
});
t('규칙 묶음에 없는 약은 uncovered로 알린다(말을 지어내지 않는다)', () => {
  const m = care.analyze([drug('f', '후로스판', ['12:30'])], {});
  assert.deepStrictEqual(m.uncovered, [{ itemId: 'f', reason: 'care_missing' }]);
  assert.deepStrictEqual(flagsOf(m, 'f'), []);
});
t('시간대: 아침약·점심약·저녁약·자기 전, 시간이 없으면 unscheduled', () => {
  const items = [drug('a', '메토폴정', ['07:00']), drug('b', '메토폴정', ['12:30']), drug('c', '메토폴정', ['19:00']), drug('d', '메토폴정', ['22:30']), drug('e', '메토폴정', ['02:00']), drug('x', '메토폴정', [])];
  const m = care.analyze(items, { meals: { breakfast: '08:00', lunch: '12:30', dinner: '18:30' } });
  assert.deepStrictEqual(m.slots.map((s) => s.label), ['아침약', '점심약', '저녁약', '자기 전']);
  assert.strictEqual(m.slots[3].items.length, 2);
  assert.deepStrictEqual(m.unscheduled, ['x']);
  assert.strictEqual(m.slots[0].meal.label, '아침 식사');
});
t('severity는 caution뿐이고, 엔진이 만든 문구에 판정·지시 표현이 없다', () => {
  const m = care.analyze(base().concat([drug('metf', '메토폴정', ['19:00'])]), { states: ['pregnant'] });
  const mine = JSON.stringify([m.slots.flatMap((s) => s.items.flatMap((x) => x.flags.map((f) => [f.short, f.severity]))), m.suggestions.map((s) => s.message)]);
  assert.ok(!/안전|괜찮|문제없|먹어도|중단하세요|끊으세요|줄이세요|늘리세요/.test(mine), mine);
  assert.ok(m.slots.flatMap((s) => s.items.flatMap((x) => x.flags)).every((f) => f.severity === 'caution'));
});
t('같은 규칙이 한 약에 중복으로 붙지 않는다', () => {
  const items = base(); items.push(supp('ca2', ['calcium'], ['09:30'], '칼슘 2'));
  const ids = flagsOf(care.analyze(items, {}), 'levo').map((f) => f.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});
console.log('\n' + n + '개 통과');
