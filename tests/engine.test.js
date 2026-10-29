/* 실행: node tests/engine.test.js */
'use strict';
const assert = require('assert');
global.window = {};
require('../data/datapack.js');
const pack = global.window.KEEPING_DATA;
const E = require('../js/engine.js');

let n = 0;
function t(name, fn) {
  try { fn(); n++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

const drug = (id, seq, times) => ({ id, kind: 'drug', itemSeq: seq, name: '', times: times || [] });
const supp = (id, name, keys, times) => ({ id, kind: 'supp', name, ingredientKeys: keys, times: times || [] });

// 예시 사용자: 기존 복용 + 이번 처방
const itra = drug('itra', '200000913', ['08:30']);
const vitC = supp('vitc', '메가도스C 비타민C 3000mg', ['vitaminC'], ['13:30']);
const iron = supp('iron', '철분제(예시)', ['iron'], ['09:30']);
const simva = drug('simva', '200403126', ['21:00']);
const cime = drug('cime', '200402420', ['09:00']);
const alma = drug('alma', '199000541', ['08:00']);
const furos = drug('furos', '198801649', ['12:30']);
const items = [itra, vitC, iron, simva, cime, alma, furos];
const A = {};
E.analyze(items, pack).forEach((a) => { A[a.item.id] = a; });
const kinds = (id) => A[id].findings.map((f) => f.kind + ':' + f.withId + ':' + f.confidence);

console.log('겹침 확인');
t('시바스정 ↔ 코니트라캡슐: DUR 병용금기 쌍(높음)', () => {
  assert.strictEqual(A.simva.status, 'attention');
  assert.ok(kinds('simva').includes('pair:itra:high'));
  const f = A.simva.findings.find((x) => x.kind === 'pair');
  assert.strictEqual(f.reason, '횡문근융해증');
});
t('코니트라캡슐 쪽에서도 같은 쌍이 보임', () => {
  assert.ok(kinds('itra').includes('pair:simva:high'));
});
t('이텍스시메티딘정 설명서에 이트라코나졸이 이름으로 나옴(높음)', () => {
  assert.ok(kinds('cime').includes('name:itra:high'));
});
t('코니트라캡슐 쪽에서도 시메티딘 설명서 근거가 보임', () => {
  assert.ok(kinds('itra').includes('name:cime:high'));
});
t('알마겔 ↔ 이텍스시메티딘: 분류 표현(낮음)', () => {
  assert.ok(kinds('alma').includes('class:cime:low'));
  assert.ok(kinds('cime').includes('class:alma:low'));
});
t('알마겔 ↔ 철분 영양제: 낮음', () => {
  assert.ok(kinds('alma').includes('supp:iron:low'));
  assert.ok(kinds('iron').includes('supp:alma:low'));
  assert.strictEqual(A.iron.status, 'attention');
});
t('후로스판정: 겹침 없음(none)이고 안전을 뜻하지 않음 — 설명서 미확인 표시', () => {
  assert.strictEqual(A.furos.status, 'none');
  assert.strictEqual(A.furos.coverage.label, false);
});
t('비타민 C: 33종 밖이라 unchecked(확인 못 함)', () => {
  assert.strictEqual(A.vitc.status, 'unchecked');
  assert.strictEqual(A.vitc.coverage.scope, false);
});
t('칼슘 영양제를 등록해도 시메티딘 설명서의 "칼슘채널차단제"와 엉뚱하게 매칭되지 않음', () => {
  const ca = supp('ca', '칼슘제', ['calcium'], ['10:00']);
  const r = E.analyze([cime, ca], pack);
  const c = r.find((x) => x.item.id === 'ca');
  assert.strictEqual(c.findings.length, 0);
});

console.log('범위 / 상태');
t('팩 밖의 약은 등록돼도 unchecked', () => {
  const x = { id: 'x', kind: 'drug', itemSeq: '999', name: '모르는약', times: [] };
  assert.strictEqual(E.analyzeItem(x, [x], pack).status, 'unchecked');
});
t('팩 안의 약 단독 등록은 none', () => {
  assert.strictEqual(E.analyzeItem(alma, [alma], pack).status, 'none');
});
t('범위 안 영양제(은행잎)는 scope', () => {
  const g = supp('g', '은행잎 추출물', ['ginkgo']);
  assert.strictEqual(E.analyzeItem(g, [g], pack).status, 'scope');
});
t('성분 키가 없는 직접 입력 영양제는 unchecked', () => {
  const g = supp('g2', '이름만 입력', []);
  assert.strictEqual(E.analyzeItem(g, [g], pack).status, 'unchecked');
});

console.log('성분 이름 정리');
t('비타민C / 비타민 C / 비타민C(고시형) 모두 같은 키', () => {
  ['비타민C', '비타민 C', '비타민C(고시형)', 'Vitamin C'].forEach((s) => assert.strictEqual(E.mapIngredient(s, pack), 'vitaminC'));
});
t('부분 문자열로는 매칭하지 않음("철"은 "철분"과 같은 키지만 "비철"은 아님)', () => {
  assert.strictEqual(E.mapIngredient('철', pack), 'iron');
  assert.strictEqual(E.mapIngredient('비철금속', pack), null);
});

console.log('복용 간격');
t('알마겔 08:00, 시메티딘 09:00 → 1시간 차, 안내 간격(2~3시간)보다 가까움', () => {
  const c = E.intervalChecks(items, pack).find((x) => x.otherId === 'cime');
  assert.ok(c);
  assert.strictEqual(c.gapHours, 1);
  assert.strictEqual(c.close, true);
  assert.strictEqual(c.minH, 2);
});
t('알마겔 08:00, 철분 09:30 → 1.5시간 차, close', () => {
  const c = E.intervalChecks(items, pack).find((x) => x.otherId === 'iron');
  assert.strictEqual(c.gapHours, 1.5);
  assert.strictEqual(c.close, true);
});
t('간격이 안내 이상이면 close=false', () => {
  const c2 = Object.assign({}, cime, { times: ['11:00'] });
  const c = E.intervalChecks([alma, c2], pack)[0];
  assert.strictEqual(c.close, false);
});
t('자정을 넘는 간격도 원형으로 계산(23:30 vs 00:30 = 1시간)', () => {
  assert.strictEqual(E.minGapHours(['23:30'], ['00:30']), 1);
});
t('시간이 없으면 간격을 계산하지 않음', () => {
  const c2 = Object.assign({}, cime, { times: [] });
  assert.strictEqual(E.intervalChecks([alma, c2], pack).length, 0);
});

console.log('문구');
t('조사: 이텍스시메티딘정과 / 알마겔에프현탁액과 / 후로스판정이', () => {
  assert.strictEqual(E.josa('이텍스시메티딘정', '과', '와'), '이텍스시메티딘정과');
  assert.strictEqual(E.josa('시바스정', '과', '와'), '시바스정과');
  assert.strictEqual(E.josa('후로스판정', '이', '가'), '후로스판정이');
  assert.strictEqual(E.josa('코니트라캡슐', '이', '가'), '코니트라캡슐이');
  assert.strictEqual(E.josa('철분제', '이', '가'), '철분제가');
});
t('질문은 판정하지 않고 묻기만 함', () => {
  const qs = E.questionsFor(A.simva, items, pack);
  assert.ok(qs.length > 0);
  qs.forEach((q) => assert.ok(/\?$/.test(q)));
  qs.forEach((q) => assert.ok(!/안전|괜찮|문제없/.test(q)));
});
t('어떤 결과 문구에도 "안전/괜찮/문제없"이 들어가지 않음', () => {
  Object.values(A).forEach((a) => a.findings.forEach((f) => {
    assert.ok(!/안전|괜찮|문제없/.test(f.title + (f.summary || '')), f.title);
  }));
});

console.log('\n' + n + '개 통과' + (process.exitCode ? ' (실패 있음)' : ''));
