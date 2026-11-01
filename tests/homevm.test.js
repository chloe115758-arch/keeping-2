/* 실행: node tests/homevm.test.js — js/homevm.js(홈 화면 뷰모델)를 실제 엔진·데이터로 점검 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const Care = require('../js/care.js'), D = require('../js/dur.js'), Greeting = require('../js/greeting.js'), Home = require('../js/homevm.js');
const dur = D.create({
  pairs: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/dur-pairs.json'), 'utf8')),
  products: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/products.json'), 'utf8'))
});
const groups = JSON.parse(fs.readFileSync(path.join(root, 'data/care/groups.json'), 'utf8'));
const E = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/care-entries.json'), 'utf8'));
const copy = JSON.parse(fs.readFileSync(path.join(root, 'data/copy/greeting.json'), 'utf8'));

const code = (q) => dur.search(q, { limit: 1 })[0].code;
const drug = (id, q, times, dept) => Object.assign(dur.toItem(code(q), { id, times }), dept ? { dept } : {});
const key = (q) => dur.get(code(q)).ingrName.toLowerCase();
const pack = { entries: { [key('씬지로이드정0.075')]: E.levothyroxine, [key('메토폴정')]: E.metformin } };
const care = Care.create({ pack, dur, groups });
const supp = (id, keys, times, name) => ({ id, kind: 'supp', name: name || '칼슘 영양제', ingredientKeys: keys, times });
const productOf = (item) => { const c = item.productCode || (item.itemSeq && dur.codeOf && dur.codeOf(item.itemSeq)); return c ? dur.get(c) : null; };
const vm = Home.create({ greeting: Greeting.create(copy), productOf });
const run = (items, extra) => vm.build(Object.assign({ nowMin: 7 * 60 + 30, nickname: '지수', items, analysis: care.analyze(items, {}) }, extra || {}));
const slotRow = (m, id) => m.rows.find((r) => r.type === 'slot' && r.id === id);
const BAN = /안전|괜찮|문제없|먹어도|드세요|복용하세요|챙겨\s*드|중단하세요|끊으세요|늘리세요|줄이세요/;

let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

const base = () => [drug('levo', '씬지로이드정0.075', ['07:00'], '내과'), drug('metf', '메토폴정', ['07:00'], '피부과'), supp('ca', ['calcium'], ['09:00'])];

t('묶음: 처방약은 진료과별, 영양제는 이름 그대로 한 줄', () => {
  const m = run(base());
  const g = slotRow(m, 'morning').groups;
  assert.deepStrictEqual(g.map((x) => x.title), ['내과 처방약', '피부과 처방약', '칼슘 영양제']);
  assert.deepStrictEqual(g.map((x) => x.kind), ['rx', 'rx', 'supp']);
  assert.strictEqual(g[0].id, 'morning:rx:내과');
  assert.strictEqual(g[2].id, 'morning:supp:ca');
});
t('진료과를 안 적으면 "처방약" 하나로 묶고, 약국약(일반의약품)은 "약국약"으로 자동 분류한다', () => {
  const m = run([drug('levo', '씬지로이드정0.075', ['07:00']), drug('alma', '알마겔에프', ['08:00'])]);
  const titles = slotRow(m, 'morning').groups.map((x) => x.title);
  assert.ok(titles.includes('처방약') && titles.includes('약국약'), JSON.stringify(titles));
});
t('주의 블록: 설명서에 간격 숫자가 있으면 "권장해요", 문장이 자연스러운 조사로 이어진다', () => {
  const S = slotRow(run(base()), 'morning');
  assert.ok(S.notice, '주의 블록이 있다');
  assert.strictEqual(S.notice.title, '주의 및 권고사항');
  assert.ok(S.notice.lines.some((l) => l.text === '칼슘 영양제는 내과 처방약과 최소 4시간 간격을 두는 것을 권장해요'), JSON.stringify(S.notice.lines));
});
t('영양제 행 아래 한 줄: 간격이 모자랄 때 계산한 시각이 나온다(오전 11시)', () => {
  const S = slotRow(run(base()), 'morning');
  assert.strictEqual(S.groups.find((x) => x.key === 'supp:ca').hint, '오전 11시 이후 섭취 권장');
  assert.strictEqual(S.groups[0].hint, null);
});
t('간격이 충분하면(4시간 이상) 주의 블록도 힌트도 없다', () => {
  const items = base(); items[2].times = ['12:00'];
  const m = run(items);
  assert.ok(slotRow(m, 'lunch') && !slotRow(m, 'lunch').notice);
  assert.strictEqual(slotRow(m, 'lunch').groups[0].hint, null);
});
t('주의 블록은 2건까지, 넘으면 "외 N건"', () => {
  const items = base().concat([drug('alma', '알마겔에프', ['08:00']), drug('nex', '넥시움정20', ['07:30'])]);
  const S = slotRow(run(items), 'morning');
  assert.ok(S.notice.all.length >= 3, 'all ' + S.notice.all.length);
  assert.strictEqual(S.notice.lines.length, 2);
  assert.strictEqual(S.notice.more, S.notice.all.length - 2);
  assert.strictEqual(S.notice.moreText, '외 ' + S.notice.more + '건');
});
t('숫자 없는 안내는 "권장" 대신 "주의가 필요하다고 안내돼 있어요"', () => {
  const items = [drug('levo', '씬지로이드정0.075', ['07:00'], '내과'), drug('alma', '알마겔에프', ['08:00'])];
  const S = slotRow(run(items), 'morning');
  const l = S.notice.lines.find((x) => /약국약/.test(x.text));
  assert.ok(l && /함께 쓸 때 주의가 필요하다고 안내돼 있어요$/.test(l.text) && !/권장/.test(l.text), JSON.stringify(S.notice.lines));
});
t('공식 병용금기는 "지정된 조합이에요"이고 주의 블록에서 맨 위에 온다', () => {
  const items = [drug('s', '시바스정', ['21:00'], '내과'), drug('i', '이트코나졸캡슐', ['21:00'], '피부과')];
  const S = slotRow(run(items, { nowMin: 21 * 60 + 10 }), 'bedtime');
  assert.ok(/함께 복용하지 않도록 지정된 조합이에요$/.test(S.notice.lines[0].text) && S.notice.lines[0].official, JSON.stringify(S.notice.lines));
  assert.ok(!/권장/.test(S.notice.lines[0].text));
});
t('같은 묶음 안의 두 약이 부딪히면 묶음 이름 대신 약 이름으로 말한다', () => {
  const items = [drug('s', '시바스정', ['21:00'], '내과'), drug('i', '이트코나졸캡슐', ['21:00'], '내과')];
  const S = slotRow(run(items, { nowMin: 21 * 60 + 10 }), 'bedtime');
  const txt = S.notice.lines[0].text;
  assert.ok(!/내과 처방약은 내과 처방약과/.test(txt) && /시바스|이트코나졸/.test(txt), txt);
});
t('체크: 묶음 단위로 진행률이 오르고 시간선 노드 상태가 바뀐다', () => {
  const items = base().concat([drug('b1', '메토폴정', ['12:30']), drug('b2', '메토폴정', ['22:30'])]);
  let m = run(items);
  assert.strictEqual(m.header.card.count, '0/5'); assert.strictEqual(m.header.card.ratio, 0);
  assert.deepStrictEqual(m.rows.filter((r) => r.type === 'slot').map((r) => r.nodeState), ['now', 'up', 'up']);
  const ids = slotRow(m, 'morning').groups.map((g) => g.id);
  const checks = {}; ids.forEach((id) => { checks[id] = true; });
  m = run(items, { checks, nowMin: 8 * 60 });
  assert.strictEqual(m.header.card.count, '3/5');
  assert.deepStrictEqual(m.rows.filter((r) => r.type === 'slot').map((r) => r.nodeState), ['done', 'now', 'up']);
  assert.strictEqual(slotRow(m, 'morning').complete, true);
});
t('시간선 줄: 식사 표시 3개가 시각순으로 끼고(같은 시각이면 식사가 먼저), 지난 구간만 lineDone', () => {
  const items = base().concat([drug('b1', '메토폴정', ['12:30'])]);
  const ids = slotRow(run(items), 'morning').groups.map((g) => g.id); const checks = {}; ids.forEach((id) => { checks[id] = true; });
  const m = run(items, { checks, nowMin: 8 * 60 });
  assert.deepStrictEqual(m.rows.map((r) => r.id), ['morning', 'meal:breakfast', 'meal:lunch', 'lunch', 'meal:dinner']);
  assert.deepStrictEqual(m.rows.map((r) => r.lineDone), [true, true, true, false, false]);
  assert.strictEqual(m.rows[m.rows.length - 1].last, true);
});
t('시간을 정하지 않은 약은 홈에서 빠지고, 시간 있는 약이 없으면 안내 문구가 나온다', () => {
  const m = run([drug('x', '메토폴정', [])]);
  assert.strictEqual(m.rows.filter((r) => r.type === 'slot').length, 0);
  assert.strictEqual(m.header.keys.line2, 'notime_line2');
  assert.strictEqual(run([]).header.keys.line2, 'empty_line2');
});
t('근거 시트: 설명서 원문, 안내가 가리키는 약, 읽기 전용 한 줄(오전 11시)', () => {
  const m = run(base());
  const line = slotRow(m, 'morning').notice.lines.find((l) => /칼슘/.test(l.text));
  const sh = m.sheets[line.flagId];
  assert.strictEqual(sh.intro, '설명서에 이렇게 나와 있어요');
  assert.ok(/최소 4시간 간격/.test(sh.excerpt) && sh.source.url && sh.source.checkedAt, JSON.stringify(sh));
  assert.deepStrictEqual(sh.related.map((r) => r.label), ['내과 처방약', '칼슘 영양제']);
  assert.ok(sh.related[0].names.length === 1 && /씬지로이드/.test(sh.related[0].names[0]), JSON.stringify(sh.related));
  assert.strictEqual(sh.hintLine, '칼슘 영양제 · 오전 11시 이후에 드시면 안내된 간격 이상이에요.');
});
t('공식 지정 시트는 "공식 자료에 이렇게 나와 있어요"', () => {
  const items = [drug('s', '시바스정', ['21:00'], '내과'), drug('i', '이트코나졸캡슐', ['21:00'], '피부과')];
  const m = run(items, { nowMin: 21 * 60 + 10 });
  const sh = m.sheets[slotRow(m, 'bedtime').notice.lines[0].flagId];
  assert.strictEqual(sh.intro, '공식 자료에 이렇게 나와 있어요'); assert.ok(/횡문근융해증/.test(sh.excerpt));
});
t('약봉투 화면: 묶음 안 약마다 이름·구분·시간, 관련 안내, 조심할 음식(홈에는 두지 않는다)', () => {
  const m = run(base());
  const d = m.detail['morning:rx:피부과'];
  assert.strictEqual(d.title, '피부과 처방약');
  assert.strictEqual(d.items.length, 1);
  assert.ok(/메토폴/.test(d.items[0].display) && d.items[0].category === '처방약' && d.items[0].times[0] === '07:00', JSON.stringify(d.items[0]));
  assert.ok(d.foods.some((f) => /알코올/.test(f)), JSON.stringify(d.foods));
  assert.ok(/안전하다는 뜻은 아니에요/.test(d.scope) && /약사 안내를 따라/.test(d.footer));
  assert.ok(!('foods' in slotRow(m, 'morning')), '홈 시간대 카드에는 음식 줄이 없다');
});
t('시간대 카드 둘째 줄: 약 개수 · 주의 개수(주의가 없으면 개수만)', () => {
  const m = run(base());
  assert.ok(/^약 3개 · 주의 \d+$/.test(slotRow(m, 'morning').summary.text), slotRow(m, 'morning').summary.text);
  const m2 = run([drug('b', '메토폴정', ['12:30'])]);
  assert.strictEqual(slotRow(m2, 'lunch').summary.text, '약 1개');
});
t('만든 모든 문장에 판정·지시 표현이 없다(허용 문구 제외)', () => {
  const m = run(base().concat([drug('alma', '알마겔에프', ['08:00']), drug('s', '시바스정', ['21:00']), drug('i', '이트코나졸캡슐', ['21:00'])]));
  const texts = [m.header.line1, m.header.line2, m.header.card.status];
  m.rows.forEach((r) => { if (r.type !== 'slot') return; texts.push(r.summary.text); r.groups.forEach((g) => { texts.push(g.title); if (g.hint) texts.push(g.hint); }); if (r.notice) r.notice.all.forEach((l) => texts.push(l.text)); });
  Object.keys(m.sheets).forEach((k) => { texts.push(m.sheets[k].intro, m.sheets[k].hintLine); });
  texts.filter(Boolean).forEach((x) => assert.ok(!BAN.test(x), x));
});
t('공식 병용금기의 조건(비고)이 근거 시트에 한 줄로 남는다("조건 · 48시간 이내 병용금기")', () => {
  const items = [{ id: 'a', kind: 'drug', name: '가약', times: ['21:00'] }, { id: 'b', kind: 'drug', name: '나약', times: ['21:00'] }];
  const flag = { id: 'f1', grade: 'official', severity: 'caution', kind: 'pair', short: 'x', withItemIds: ['b'], ownerId: 'a', interval: null };
  const analysis = { slots: [{ id: 'bedtime', label: '자기 전', time: '21:00', summary: { itemCount: 2, cautionCount: 1, foodNoteCount: 0 },
    items: [{ itemId: 'a', kind: 'drug', name: '가약', display: '가약', time: '21:00', flags: [flag], foods: [] }, { itemId: 'b', kind: 'drug', name: '나약', display: '나약', time: '21:00', flags: [], foods: [] }] }],
    suggestions: [], unscheduled: [], evidence: { f1: { grade: 'official', headline: '병용금기로 지정된 조합', detail: '48시간 이내 병용금기', excerpt: '원문', where: '병용금기 · 고시', source: { label: 'x', url: null, checkedAt: '2026-07-31' } } } };
  const m = vm.build({ nowMin: 21 * 60 + 10, items, analysis });
  assert.strictEqual(m.sheets.f1.noteLine, '조건 · 48시간 이내 병용금기');
  analysis.evidence.f1.detail = '';
  assert.strictEqual(vm.build({ nowMin: 21 * 60 + 10, items, analysis }).sheets.f1.noteLine, '');
});
t('설명서 근거 시트에는 조건 줄을 만들지 않는다(규칙 제목이 조건처럼 보이는 것을 막는다)', () => {
  const m = run(base());
  const line = slotRow(m, 'morning').notice.lines.find((l) => /칼슘/.test(l.text));
  assert.strictEqual(m.sheets[line.flagId].noteLine, '');
});
t('새 처방: 앱이 newItemIds를 넘길 때만 묶음에 "새 처방" 칩이 붙는다', () => {
  const items = base();
  const plain = slotRow(run(items), 'morning').groups;
  assert.ok(plain.every((g) => !g.isNew && g.newLabel === ''));
  const g = slotRow(run(items, { newItemIds: ['metf'] }), 'morning').groups;
  assert.deepStrictEqual(g.map((x) => [x.title, x.isNew, x.newLabel]), [['내과 처방약', false, ''], ['피부과 처방약', true, '새 처방'], ['칼슘 영양제', false, '']]);
});
t('다른 시간대 약이 섞이면 시간대 이름이 앞에 붙는다("자기 전 약국약은 …")', () => {
  const items = [drug('levo', '씬지로이드정0.075', ['07:00'], '내과'), drug('alma', '알마겔에프', ['21:00'])];
  const l = slotRow(run(items), 'morning').notice.lines.find((x) => /약국약/.test(x.text));
  assert.ok(l && /^자기 전 약국약은 내과 처방약과 /.test(l.text), l && l.text);
  const same = [drug('levo', '씬지로이드정0.075', ['07:00'], '내과'), drug('alma', '알마겔에프', ['08:00'])];
  const l2 = slotRow(run(same), 'morning').notice.lines.find((x) => /약국약/.test(x.text));
  assert.ok(l2 && /^약국약은 내과 처방약과 /.test(l2.text), '같은 시간대면 붙이지 않는다: ' + (l2 && l2.text));
});
t('약봉투 화면: 약별 카드에는 약 이름으로 말해서 카드마다 같은 문장이 반복되지 않는다', () => {
  const items = [drug('levo', '씬지로이드정0.075', ['07:00'], '내과'), drug('metf', '메토폴정', ['07:00'], '내과'), supp('ca', ['calcium'], ['09:00'])];
  const m = run(items);
  const d = m.detail['morning:rx:내과'];
  const levo = d.items.find((i) => /씬지로이드/.test(i.display)), metf = d.items.find((i) => /메토폴/.test(i.display));
  assert.ok(levo.notices.some((n) => /^칼슘 영양제는 씬지로이드/.test(n.text) && /최소 4시간 간격을 두는 것을 권장해요$/.test(n.text)), JSON.stringify(levo.notices));
  assert.ok(!metf.notices.some((n) => /칼슘/.test(n.text)), '메토폴 카드에는 칼슘 문장이 없다');
  const homeTexts = slotRow(m, 'morning').notice.all.map((x) => x.text);
  assert.ok(levo.notices.every((n) => !homeTexts.includes(n.text)), '홈 문장과 같지 않다');
});
t('약봉투 화면: 성분은 한글(영문)으로 보인다', () => {
  const d = run(base()).detail['morning:rx:내과'];
  assert.strictEqual(d.items[0].ingredient, '레보티록신나트륨수화물 (levothyroxine sodium)');
});
console.log('\n' + n + '개 통과');
