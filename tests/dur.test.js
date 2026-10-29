/* 실행: node tests/dur.test.js  — js/dur.js (검색·병용금기 확인) 점검 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const D = require('../js/dur.js');
const dir = path.join(__dirname, '..', 'data', 'dur');
const t0 = Date.now();
const dur = D.create({
  pairs: JSON.parse(fs.readFileSync(path.join(dir, 'dur-pairs.json'), 'utf8')),
  products: JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'))
});
console.log('색인 만들기', Date.now() - t0, 'ms');

let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

t('통계', () => {
  const s = dur.stats();
  assert.strictEqual(s.products, 23126); assert.strictEqual(s.pairs, 23619); assert.strictEqual(s.baseDate, '2026-07-31');
});
t('검색: 제품명 "시바스" → 시바스정이 첫 결과', () => {
  const r = dur.search('시바스');
  assert.ok(r.length >= 1 && /^시바스정/.test(r[0].name), JSON.stringify(r[0]));
  assert.strictEqual(r[0].code, '670601380');
});
t('검색: 띄어쓰기·대소문자 무시 ("시 바 스", "SIMVASTATIN")', () => {
  assert.ok(dur.search('시 바 스')[0].code === '670601380');
  const r = dur.search('SIMVASTATIN');
  assert.ok(r.length > 5 && r.every((x) => /simvastatin/i.test(x.ingrName)), r.length);
});
t('검색: 성분 한글명 "심바스타틴"도 찾음(제품명 괄호 안)', () => {
  assert.ok(dur.search('심바스타틴').some((x) => x.code === '670601380'));
});
t('검색: 우리 약 4개', () => {
  assert.strictEqual(dur.search('후로스판')[0].code, '645602250');
  assert.strictEqual(dur.search('이텍스시메티딘')[0].code, '698500200');
  assert.strictEqual(dur.search('알마겔에프')[0].code, '642101071');
  assert.ok(dur.search('브로목틸').some((x) => x.code === '698500300'));
});
t('검색: 없는 이름은 빈 배열, 빈 입력도 빈 배열', () => {
  assert.deepStrictEqual(dur.search('ㅁㄴㅇㄹ없는약이름'), []);
  assert.deepStrictEqual(dur.search('   '), []);
});
t('검색 속도: 1회 50ms 이내', () => {
  const s = Date.now(); for (let i = 0; i < 20; i++) dur.search('정'); const ms = (Date.now() - s) / 20;
  console.log('      → 평균', ms.toFixed(1), 'ms'); assert.ok(ms < 50);
});
t('제품 정보: 구분(전문/일반)과 상태', () => {
  assert.strictEqual(dur.get('645602250').category, '전문의약품');
  assert.strictEqual(dur.get('642101071').category, '일반의약품');
  assert.strictEqual(dur.statusOf('645602250'), 'listed');
  assert.strictEqual(dur.statusOf('000000000'), 'unknown');
});
t('병용금기: 시바스정 × 코니트라정 → 근거 있음, 사유·고시일·성분명', () => {
  const c = dur.search('코니트라정')[0];
  const ev = dur.evidence('670601380', c.code);
  assert.ok(ev.length >= 1 && /횡문근융해증/.test(ev[0].reason) && ev[0].date && ev[0].ingrA);
  assert.deepStrictEqual(dur.evidence(c.code, '670601380').map((e) => e.reason), ev.map((e) => e.reason));
});
t('병용금기: 우리 약끼리는 근거 없음(빈 배열)', () => {
  const codes = ['645602250', '698500300', '698500200', '642101071'];
  codes.forEach((a) => codes.forEach((b) => { if (a !== b) assert.deepStrictEqual(dur.evidence(a, b), []); }));
});
t('hasPairs: 우리 약 4개는 false, 시바스정은 true', () => {
  ['645602250', '698500300', '698500200', '642101071'].forEach((c) => assert.strictEqual(dur.hasPairs(c), false, c));
  assert.strictEqual(dur.hasPairs('670601380'), true);
});
t('checkAgainst: 근거 있는 것만 돌려줌', () => {
  const c = dur.search('코니트라정')[0].code;
  const r = dur.checkAgainst('670601380', ['645602250', c, '698500200', '670601380']);
  assert.strictEqual(r.length, 1); assert.strictEqual(r[0].withCode, c);
});
t('정렬: 성분명이 정확히 같은 제품(단일 성분)이 부분 일치보다 먼저', () => {
  ['simvastatin', 'SIMVASTATIN', 'Simvastatin '].forEach((q) => {
    const r = dur.search(q, { limit: 21 });
    assert.ok(r.length > 0, q);
    assert.strictEqual(r[0].ingrName, 'simvastatin', q + ' 첫 결과: ' + r[0].display + ' / ' + r[0].ingrName);
    const firstPartial = r.findIndex((x) => x.ingrName !== 'simvastatin');   // 복합제 등 부분 일치
    const lastExact = r.map((x) => x.ingrName === 'simvastatin').lastIndexOf(true);
    assert.ok(firstPartial === -1 || lastExact < firstPartial, q + ': 정확 일치 뒤에 부분 일치가 섞임');
  });
  // 이름으로 찾는 검색은 그대로
  assert.strictEqual(dur.search('시바스')[0].code, '670601380');
  assert.strictEqual(dur.search('이텍스시메티딘')[0].code, '698500200');
});
t('정렬: acetaminophen의 첫 결과는 함량·"+" 없는 단일 성분 제품', () => {
  const r = dur.search('acetaminophen');
  assert.ok(r.length > 0);
  assert.strictEqual(r[0].ingrName, 'acetaminophen', r[0].display + ' / ' + r[0].ingrName);
});
t('cleanIngr: 함량을 떼고 복합제는 " + "로 잇는다', () => {
  assert.strictEqual(D.cleanIngr('acetaminophen   0.325g, tramadol hydrochloride   37.5mg').display, 'acetaminophen + tramadol hydrochloride');
  assert.strictEqual(D.cleanIngr('5-fluorouracil').display, '5-fluorouracil');
  assert.strictEqual(D.cleanIngr('').display, '');
});
t('toItem: 앱에 저장할 항목 모양', () => {
  const it = dur.toItem('670601380', { id: 'x1', times: ['21:00'] });
  assert.strictEqual(it.kind, 'drug'); assert.strictEqual(it.productCode, '670601380');
  assert.strictEqual(it.name, '시바스정'); assert.strictEqual(it.ingredientKo, '심바스타틴'); assert.strictEqual(it.id, 'x1');
  assert.strictEqual(dur.toItem('000000000'), null);
});
t('toItem: 복합제는 한글 성분명을 비워 둠(추측 금지)', () => {
  const combo = dur.search('조바토린')[0];
  assert.ok(combo, '조바토린 없음'); assert.strictEqual(dur.toItem(combo.code).ingredientKo, null);
});
t('데이터 팩의 약(itemSeq) ↔ 보험코드 연결', () => {
  assert.strictEqual(dur.codeOf('198801649'), '645602250');
  assert.strictEqual(dur.seqOf('670601380'), '200403126');
  assert.strictEqual(dur.codeOf('999'), null);
});
t("출처: source('list')는 약 목록 적용일, source('pair')는 병용금기 기준일", () => {
  assert.strictEqual(dur.source('list').checkedAt, '2026-11-01');
  assert.strictEqual(dur.source('pair').checkedAt, '2026-07-31');
  assert.ok(/약제급여목록/.test(dur.source('list').label) && dur.source('list').url === null);
  assert.strictEqual(dur.source('product').checkedAt, dur.source('list').checkedAt);
});
t('출처·이용 조건', () => {
  assert.ok(/한국의약품안전관리원/.test(dur.source('pair').label) && /data\.go\.kr/.test(dur.source('pair').url));
  assert.strictEqual(dur.source('pair').checkedAt, '2026-07-31');
  assert.ok(/상업적 이용금지/.test(dur.license()));
});
console.log('\n' + n + '개 통과');
