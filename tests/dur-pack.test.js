/* 실행: node tests/dur-pack.test.js
 * scripts/build_packs.py로 만든 data/dur/dur-pairs.json, products.json 점검 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'data', 'dur');
const P = JSON.parse(fs.readFileSync(path.join(dir, 'dur-pairs.json'), 'utf8'));
const PR = JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'));
const D = PR.products;

const idx = new Map(); const pairIngr = new Set();
P.pairs.forEach(([a, b, rs, nt, dt]) => {
  pairIngr.add(a); pairIngr.add(b);
  const k = a < b ? a + '|' + b : b + '|' + a;
  if (!idx.has(k)) idx.set(k, []);
  idx.get(k).push({ reason: P.reasons[rs], note: nt >= 0 ? P.notes[nt] : '', date: P.dates[dt] });
});
const pairOf = (ca, cb) => idx.get(ca < cb ? ca + '|' + cb : cb + '|' + ca) || [];
const find = (kw) => Object.entries(D).filter(([, v]) => v[0].includes(kw));

let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

t('규모: 병용금기 쌍 23,619개, 제품 23,126개(급여목록 21,498 + 병용금기 파일에만 있는 1,628)', () => {
  assert.strictEqual(P.pairs.length, 23619);
  assert.strictEqual(Object.keys(D).length, 23126);
  assert.strictEqual(Object.values(D).filter((v) => v[4] !== 2).length, 21498);
});
t('출처·이용 조건이 meta에 들어 있음', () => {
  assert.ok(/한국의약품안전관리원/.test(P.meta.provider));
  assert.ok(/상업적 이용금지/.test(P.meta.license));
  assert.ok(PR.meta.source && PR.meta.file);
});
t('우리 약 4개 + 시바스정이 제품 목록에 있고, 주성분코드가 맞음', () => {
  const want = { '645602250': '212101ATL', '698500300': '203801ATB', '698500200': '133301ATB', '642101071': '105201ASS', '670601380': '227801ATB' };
  Object.entries(want).forEach(([code, ing]) => { assert.ok(D[code], code + ' 없음'); assert.strictEqual(D[code][3], ing, code); });
  assert.strictEqual(D['642101071'][4], 1, '알마겔에프는 일반의약품');
  assert.strictEqual(D['645602250'][4], 0, '후로스판정은 전문의약품');
});
t('우리 약 4개는 병용금기 성분에 해당하지 않음(= 확인함, 병용금기 없음). API 0건과 일치', () => {
  ['212101ATL', '203801ATB', '133301ATB', '105201ASS'].forEach((c) => assert.ok(!pairIngr.has(c), c));
});
t('시바스정 × 코니트라정: 성분코드로 병용금기 쌍을 찾고 사유에 횡문근융해증', () => {
  const s = D['670601380']; const c = find('코니트라정')[0];
  assert.ok(c, '코니트라정 없음');
  const f = pairOf(s[3], c[1][3]);
  assert.ok(f.length > 0 && f.some((x) => /횡문근융해증/.test(x.reason)));
  console.log('      →', f[0].reason, '/ 고시', f[0].date);
});
t('쌍 조회는 순서와 무관', () => {
  const a = D['670601380'][3], b = find('코니트라정')[0][1][3];
  assert.deepStrictEqual(pairOf(a, b), pairOf(b, a));
});
t('8자리로 들어 있던 보험코드는 9자리(앞에 0)로 맞춰 둠', () => {
  assert.ok(Object.keys(D).every((k) => k.length === 9), '9자리가 아닌 코드가 있음');
  assert.ok(D['052400690'], '로페낙정 052400690');
});
t('이름 검색: 시바스 / 후로스 / 이텍스 / 알마겔', () => {
  ['시바스', '후로스판', '이텍스시메티딘', '알마겔에프'].forEach((kw) => assert.ok(find(kw).length >= 1, kw));
});
t('쌍의 성분코드는 모두 성분명 표에 있음', () => {
  assert.ok(P.pairs.every(([a, b]) => P.ingredients[a] && P.ingredients[b]));
});
t('비고(조건) 문구가 보존됨', () => { assert.ok(P.notes.some((x) => /48시간/.test(x))); });

// 참고 통계
const all = Object.values(D).filter((v) => v[4] !== 2);
const withPair = all.filter((v) => pairIngr.has(v[3])).length;
console.log(`\n참고: 급여목록 제품 ${all.length.toLocaleString()}개 중 병용금기 성분에 해당하는 제품 ${withPair.toLocaleString()}개(${(withPair / all.length * 100).toFixed(0)}%), 나머지 ${(all.length - withPair).toLocaleString()}개는 "병용금기 없음"으로 확인 가능`);
console.log(n + '개 통과');
