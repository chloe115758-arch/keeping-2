/* 실행: node tests/suppsearch.test.js — js/suppsearch.js(서버 없는 영양제 검색) 점검 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const Supp = require('../js/suppsearch.js');
const w = {}; new Function('window', fs.readFileSync(path.join(__dirname, '../data/datapack.js'), 'utf8'))(w);
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/care/supplement-keys-extra.json'), 'utf8')).keys;
const S = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra: extra, popular: w.KEEPING_DATA.chipKeys });
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }
const ids = (q) => S.search(q).map((r) => r.supp.ingredientKeys[0]);

t('성분 목록이 40개 안팎이고 추가 키(비오틴·비타민K·세인트존스워트)가 합쳐진다', () => {
  assert.ok(S.size >= 40, 'size ' + S.size);
  ['biotin', 'vitaminK', 'stJohnsWort'].forEach((k) => assert.ok(S.get(k), k));
  assert.strictEqual(ids('은행').filter((x) => x === 'ginkgo').length, 1, '같은 id는 한 번만');
});
t('칼슘·철분·마그네슘 같은 흔한 이름이 바로 나온다', () => {
  assert.strictEqual(ids('칼슘')[0], 'calcium');
  assert.strictEqual(ids('철분')[0], 'iron');
  assert.strictEqual(ids('마그네슘')[0], 'magnesium');
});
t('앞부분만 쳐도 찾는다("비타" → 비타민 C·D·K)', () => {
  const r = ids('비타');
  ['vitaminC', 'vitaminD', 'vitaminK'].forEach((k) => assert.ok(r.includes(k), k + ' ' + r));
});
t('영문·별칭·띄어쓰기·대소문자가 달라도 찾는다', () => {
  assert.strictEqual(ids('Omega-3')[0], 'omega3');
  assert.strictEqual(ids('유산균')[0], 'probiotics');
  assert.strictEqual(ids('비타민 d')[0], 'vitaminD');
  assert.strictEqual(ids('CoQ10')[0], 'coq10');
});
t('정확히 같은 이름이 먼저 온다', () => {
  assert.strictEqual(ids('철')[0], 'iron');   // 별칭 "철"과 같음
});
t('빈 검색은 자주 찾는 성분 순서로, 없는 이름은 빈 목록으로', () => {
  assert.deepStrictEqual(ids('').slice(0, 3), w.KEEPING_DATA.chipKeys.slice(0, 3));
  assert.deepStrictEqual(S.search('ㅁㅁㅁ없는이름'), []);
});
t('결과는 엔진이 쓰는 모양이다(성분 키, 회사 이름 없음, 제품 이름은 몰라도 된다는 안내)', () => {
  const r = S.search('칼슘')[0];
  assert.strictEqual(r.source, 'local');
  assert.deepStrictEqual(r.supp.ingredientKeys, ['calcium']);
  assert.strictEqual(r.supp.company, '');
  assert.ok(/제품 이름은 몰라도 돼요/.test(r.sub));
});
t('엔진 연결: 이 결과로 만든 영양제 항목이 약과의 간격 안내를 만든다', () => {
  const D = require('../js/dur.js'), Care = require('../js/care.js');
  const dur = D.create({ pairs: JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dur/dur-pairs.json'), 'utf8')), products: JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dur/products.json'), 'utf8')) });
  const groups = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/care/groups.json'), 'utf8'));
  const E = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/care-entries.json'), 'utf8'));
  const code = dur.search('씬지로이드정0.075', { limit: 1 })[0].code, key = dur.get(code).ingrName.toLowerCase();
  const care = Care.create({ pack: { entries: { [key]: E.levothyroxine } }, dur, groups });
  const s = S.search('칼슘')[0].supp;
  const items = [dur.toItem(code, { id: 'a', times: ['07:00'] }), { id: 'b', kind: 'supp', name: s.name, ingredientKeys: s.ingredientKeys, times: ['08:00'] }];
  const A = care.analyze(items, {});
  assert.ok(A.slots[0].items[0].flags.some((f) => f.kind === 'interaction' && f.interval), '칼슘 간격 안내가 생긴다');
});
console.log('\n' + n + '개 통과');
