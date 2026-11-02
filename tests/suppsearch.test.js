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
t('제품 목록이 있으면 제품 이름·업체로 찾는다(성분 결과는 앞 3개까지, 그 뒤에 제품)', () => {
  const rows = [['2004001', '센트룸 멀티비타민', '한국화이자', '비타민C, 칼슘'], ['2004002', '락토핏 골드', '종근당건강', '프로바이오틱스'], ['2004003', '칼슘 마그네슘 D', '뉴트리원', '칼슘, 마그네슘'], ['2004004', '종근당 칼슘 플러스', '종근당건강', '칼슘']];
  const P = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra: extra, popular: w.KEEPING_DATA.chipKeys, products: rows, mapKeys: (raw) => (/칼슘/.test(raw) ? 'calcium' : null) });
  assert.strictEqual(P.productCount, 4);
  const r = P.searchAll('센트룸');
  assert.strictEqual(r[0].source, 'catalog'); assert.strictEqual(r[0].supp.reportNo, '2004001'); assert.strictEqual(r[0].sub, '한국화이자 · 2004001');
  assert.deepStrictEqual(r[0].supp.ingredientKeys.slice().sort(), ['calcium', 'vitaminC']);   // 원재료 "비타민C, 칼슘"에서 둘 다
  const k = P.searchAll('칼슘');
  assert.strictEqual(k[0].source, 'local');   // 성분 결과가 먼저
  assert.ok(k.slice(1).every((x) => x.source === 'catalog') && k.length >= 3, JSON.stringify(k.map((x) => x.source)));
  assert.strictEqual(P.searchProducts('종근당')[0].supp.company, '종근당건강');          // 업체 이름으로도
  assert.deepStrictEqual(P.searchProducts('칼슘').map((x) => x.name)[0], '칼슘 마그네슘 D');   // 이름이 앞부분과 같은 것 먼저
  assert.deepStrictEqual(P.searchProducts('없는제품xyz'), []);
});
t('제품 목록이 없으면 지금처럼 성분 결과만 나온다', () => {
  assert.deepStrictEqual(S.searchAll('칼슘').map((x) => x.source), ['local']);
});
t('제품 5만 건에서도 한 번 찾는 데 0.1초가 안 걸린다', () => {
  const rows = []; for (let i = 0; i < 50000; i++) rows.push([String(3000000 + i), '제품' + i + (i % 50 === 0 ? ' 칼슘' : ''), '업체' + (i % 300), '원료']);
  const P = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra: extra, products: rows });
  const t0 = Date.now(); const r = P.searchAll('칼슘'); const ms = Date.now() - t0;
  assert.ok(r.length >= 4 && ms < 100, r.length + '건 ' + ms + 'ms');
});
t('원재료 글자 목록에서 성분 키를 모두 찾는다(기존 방식은 문장 전체가 별칭과 같아야 해서 목록을 못 찾았다)', () => {
  const P = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra: extra });
  const ks = (x) => P.mapKeys(x).sort();
  assert.deepStrictEqual(ks('칼슘, 비타민D3, 마그네슘'), ['calcium', 'magnesium', 'vitaminD']);
  assert.deepStrictEqual(ks('구연산칼슘 / 산화마그네슘'), ['calcium', 'magnesium']);
  assert.deepStrictEqual(ks('EPA 및 DHA 함유 유지'), ['omega3']);
  assert.deepStrictEqual(ks('고려인삼'), ['ginseng']);
});
t('한 글자 별칭("철")과 기초 재료(대두유)에는 반응하지 않는다', () => {
  const P = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra: extra });
  assert.deepStrictEqual(P.mapKeys('철쭉꽃추출물'), []);
  assert.deepStrictEqual(P.mapKeys('정제어유, 대두유, 레시틴'), []);
  assert.deepStrictEqual(P.mapKeys('대두단백'), ['soy']);
  assert.deepStrictEqual(P.mapKeys(''), []);
});
t('제품을 고르면 원재료와 제품 이름에서 성분 키가 들어간다(이전에는 빈 목록이라 주의가 안 떴다)', () => {
  const rows = [['2004001', '영양칼슘비타민', '고려인삼과학', '탄산칼슘, 비타민D3'], ['2004002', '오메가 골드', '회사', '정제어유'], ['2004003', '칼슘마그네슘D', '회사', '원료']];
  const P = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra: extra, products: rows });
  const by = (no) => P.searchProducts('').concat(P.searchAll('영양칼슘'), P.searchAll('칼슘마그')).find((x) => x.supp.reportNo === no);
  assert.deepStrictEqual(by('2004001').supp.ingredientKeys.sort(), ['calcium', 'vitaminD']);
  assert.deepStrictEqual(by('2004003').supp.ingredientKeys.sort(), ['calcium', 'magnesium']);   // 제품 이름의 "칼슘", "마그네슘" ("D" 한 글자는 비타민D로 보지 않는다)
});
console.log('\n' + n + '개 통과');
