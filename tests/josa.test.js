/* 실행: node tests/josa.test.js — js/josa.js(조사 붙이기) 점검 */
'use strict';
const assert = require('assert');
const J = require('../js/josa.js');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

t('받침 있는 말: 은·과·을·이', () => {
  assert.strictEqual(J.attach('칼슘 영양제', '은/는'), '칼슘 영양제는');   // 제: 받침 없음
  assert.strictEqual(J.attach('내과 처방약', '과/와'), '내과 처방약과');     // 약: ㄱ
  assert.strictEqual(J.attach('비타민', '은/는'), '비타민은');               // ㄴ
  assert.strictEqual(J.attach('피부과 처방약', '을/를'), '피부과 처방약을');
  assert.strictEqual(J.attach('약국약', '이/가'), '약국약이');
});
t('받침 없는 말: 는·와·를·가', () => {
  assert.strictEqual(J.attach('시바스정', '은/는'), '시바스정은');            // 정: ㅇ 받침
  assert.strictEqual(J.attach('마그네슘', '과/와'), '마그네슘과');            // ㅁ
  assert.strictEqual(J.attach('오메가3', '과/와'), '오메가3과');              // 삼: ㅁ
  assert.strictEqual(J.attach('비타민D', '은/는'), '비타민D는');              // 디: 없음
  assert.strictEqual(J.attach('코큐텐', '이/가'), '코큐텐이');
  assert.strictEqual(J.attach('종합비타민', '를/을'.split('/').reverse().join('/')), '종합비타민을');
});
t('으로/로: ㄹ 받침은 로', () => {
  assert.strictEqual(J.attach('물', '으로/로'), '물로');
  assert.strictEqual(J.attach('약', '으로/로'), '약으로');
  assert.strictEqual(J.attach('우유', '으로/로'), '우유로');
});
t('숫자·영문·괄호 끝말은 읽는 소리로 판단한다', () => {
  assert.strictEqual(J.attach('비타민B12', '은/는'), '비타민B12는');   // 이
  assert.strictEqual(J.attach('비타민C1', '은/는'), '비타민C1은');     // 일: ㄹ
  assert.strictEqual(J.attach('EPA', '은/는'), 'EPA는');
  assert.strictEqual(J.attach('알마겔(F)', '은/는'), '알마겔(F)은');   // 에프: ㅍ
  assert.strictEqual(J.attach('', '은/는'), '는');                      // 빈 말은 안전한 쪽으로
});
t('쓰는 말 전체(받침 있음·없음 번갈아) 조합이 자연스럽다', () => {
  const sentence = (a, b) => J.attach(a, '은/는') + ' ' + J.attach(b, '과/와') + ' 최소 4시간 간격을 두는 것을 권장해요';
  assert.strictEqual(sentence('칼슘 영양제', '내과 처방약'), '칼슘 영양제는 내과 처방약과 최소 4시간 간격을 두는 것을 권장해요');
  assert.strictEqual(sentence('마그네슘', '피부과 처방약'), '마그네슘은 피부과 처방약과 최소 4시간 간격을 두는 것을 권장해요');
  assert.strictEqual(sentence('비타민D', '약국약'), '비타민D는 약국약과 최소 4시간 간격을 두는 것을 권장해요');
});
console.log('\n' + n + '개 통과');
