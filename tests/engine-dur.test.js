/* 실행: node tests/engine-dur.test.js — 엔진 + DUR 모듈 연결 점검 (기존 engine.test.js와 별개) */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
global.window = {};
require('../data/datapack.js');
const basePack = global.window.KEEPING_DATA;
const E = require('../js/engine.js');
const D = require('../js/dur.js');
const dir = path.join(__dirname, '..', 'data', 'dur');
const dur = D.create({
  pairs: JSON.parse(fs.readFileSync(path.join(dir, 'dur-pairs.json'), 'utf8')),
  products: JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'))
});
const pack = Object.assign({}, basePack, { dur: dur, _idx: undefined });   // pack.dur만 더해서 씀

let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }
const item = (id, code, times) => dur.toItem(code, { id: id, times: times || [] });

const simva = item('simva', '670601380', ['21:00']);
const itra = item('itra', dur.search('코니트라정')[0].code, ['08:30']);
const cime = item('cime', '698500200', ['09:00']);
const alma = item('alma', '642101071', ['08:00']);
const furos = item('furos', '645602250', ['12:30']);
const brom = item('brom', '698500300', ['10:00']);
const items = [simva, itra, cime, alma, furos, brom];
const A = {}; E.analyze(items, pack).forEach((a) => { A[a.item.id] = a; });

console.log('DUR 파일로 확인 (제품코드로 등록한 약)');
t('시바스정 ↔ 코니트라정: 병용금기(높음), 사유·고시일·출처가 붙음', () => {
  assert.strictEqual(A.simva.status, 'attention');
  const f = A.simva.findings.find((x) => x.kind === 'pair');
  assert.ok(f && f.confidence === 'high' && /횡문근융해증/.test(f.reason) && f.notified);
  assert.ok(/한국의약품안전관리원/.test(f.source.label) && /data\.go\.kr/.test(f.source.url));
  assert.ok(/사유:/.test(f.summary) && /고시/.test(f.summary));
});
t('코니트라정 쪽에서도 같은 쌍이 보임', () => {
  assert.ok(A.itra.findings.some((x) => x.kind === 'pair' && x.withId === 'simva'));
});
t('후로스판정·브로목틸정은 "확인한 자료 안에서 못 찾음"(none) — 안전하다는 뜻이 아님', () => {
  ['furos', 'brom'].forEach((id) => assert.strictEqual(A[id].status, 'none', id));
});
t('알마겔 ↔ 시메티딘은 설명서의 간격 안내로 낮은 확신(class)의 근거가 그대로 나옴(약사 확인 권장)', () => {
  assert.deepStrictEqual(A.cime.findings.map((f) => f.kind + ':' + f.confidence + ':' + f.withId), ['class:low:alma']);
  assert.deepStrictEqual(A.alma.findings.map((f) => f.kind + ':' + f.confidence + ':' + f.withId), ['class:low:cime']);
});
t('coverage: 제품 목록에 있으면 병용금기는 확인함, 설명서는 데이터 팩에 있는 약만 확인함', () => {
  assert.strictEqual(A.furos.coverage.dur, true);
  assert.strictEqual(A.cime.coverage.label, true);        // 이텍스시메티딘은 설명서를 읽어 둔 약
  assert.strictEqual(A.itra.coverage.label, false);       // 코니트라정은 설명서 미확인
  assert.ok(A.itra.coverage.product && A.itra.coverage.product.code);
});
t('데이터 팩의 약을 itemSeq로 등록한 것과 섞어도 쌍을 찾음', () => {
  const legacy = { id: 'legacy', kind: 'drug', itemSeq: '200403126', times: [] };
  const r = E.analyze([legacy, itra], pack);
  assert.strictEqual(r[0].status, 'attention');
  assert.ok(r[0].findings.some((f) => f.kind === 'pair' && f.source.label.includes('한국의약품안전관리원')));
});
t('제품코드로 등록해도 데이터 팩의 설명서 근거가 붙음(이텍스시메티딘 ↔ 이트라코나졸)', () => {
  const itraCap = dur.search('이트코나졸캡슐')[0];
  assert.ok(itraCap, '이트코나졸캡슐 없음');
  const r = E.analyze([cime, dur.toItem(itraCap.code, { id: 'itracap' })], pack);
  assert.ok(r[0].findings.some((f) => f.kind === 'name'), '설명서 근거 없음');
});
t('목록에 없는 제품코드는 확인 못 함(unchecked)', () => {
  const ghost = { id: 'g', kind: 'drug', productCode: '000000000', name: '없는약', times: [] };
  assert.strictEqual(E.analyze([ghost, simva], pack)[0].status, 'unchecked');
});
t('이름만 직접 입력한 약도 확인 못 함(unchecked)', () => {
  const manual = { id: 'm', kind: 'drug', name: '내가 입력한 약', times: [] };
  assert.strictEqual(E.analyze([manual, simva], pack)[0].status, 'unchecked');
});
t('pack.dur가 없으면 기존 데이터 팩 방식 그대로(시바스 ↔ 코니트라캡슐)', () => {
  const legacyPack = Object.assign({}, basePack, { _idx: undefined });
  const L = E.analyze([{ id: 'a', kind: 'drug', itemSeq: '200403126', times: [] }, { id: 'b', kind: 'drug', itemSeq: '200000913', times: [] }], legacyPack);
  assert.strictEqual(L[0].status, 'attention');
  assert.strictEqual(L[0].findings.find((f) => f.kind === 'pair').reason, '횡문근융해증');
});
console.log('\n' + n + '개 통과');
