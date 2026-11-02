/* 실행: node tests/timeinput.test.js — js/timeinput.js(복용 시각 입력) 점검 */
'use strict';
const assert = require('assert');
const T = require('../js/timeinput.js');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

t('숫자만 쳐도 된다: 730 / 0730 / 1930 / 7 / 19', () => {
  assert.deepStrictEqual(['730', '0730', '1930', '7', '19', '12'].map(T.parse), ['07:30', '07:30', '19:30', '07:00', '19:00', '12:00']);
});
t('콜론·점·한글: 7:30 / 7.30 / 7시 30분 / 7시 / 7시 반', () => {
  assert.deepStrictEqual(['7:30', '07:30', '7.30', '7시 30분', '7시', '7시 반', '7:5'].map(T.parse), ['07:30', '07:30', '07:30', '07:30', '07:00', '07:30', '07:05']);
});
t('오전·오후: 오후 7시 30분 → 19:30, 오전 12시 → 00:00, 오후 12시 → 12:00', () => {
  assert.strictEqual(T.parse('오후 7시 30분'), '19:30');
  assert.strictEqual(T.parse('오후7시'), '19:00');
  assert.strictEqual(T.parse('오전 12시'), '00:00');
  assert.strictEqual(T.parse('오후 12시'), '12:00');
  assert.strictEqual(T.parse('pm 8:15'), '20:15');
});
t('잘못된 입력은 null: 25:00, 7:75, 빈칸, 글자', () => {
  ['25:00', '7:75', '', '   ', '아침', 'abc', '99'].forEach((x) => assert.strictEqual(T.parse(x), null, x));
  assert.strictEqual(T.parse(null), null);
});
t('시간대는 엔진과 같은 경계다 (10:59 아침, 11:00 점심, 14:59 점심, 15:00 저녁, 20:59 저녁, 21:00 자기 전, 03:59 자기 전, 04:00 아침)', () => {
  const b = (x) => T.bandOf(x).id;
  assert.deepStrictEqual(['10:59', '11:00', '14:59', '15:00', '20:59', '21:00', '03:59', '04:00'].map(b), ['morning', 'lunch', 'lunch', 'dinner', 'dinner', 'bedtime', 'bedtime', 'morning']);
});
t('엔진(care.js)의 시간대와 같은 결과를 낸다', () => {
  const Care = require('../js/care.js');
  for (let m = 0; m < 1440; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    assert.strictEqual(T.bandOf(hh).id, Care.bandOf(m).id, hh);
  }
});
t('기본 시각은 각자 자기 시간대 안에 있다', () => {
  Object.keys(T.DEFAULTS).forEach((id) => assert.strictEqual(T.bandOf(T.DEFAULTS[id]).id, id));
});
t('칩과 친 시각의 시간대가 다르면 알려 준다(같으면 null)', () => {
  assert.strictEqual(T.mismatch('morning', '07:45'), null);
  assert.deepStrictEqual(T.mismatch('morning', '13:00'), { id: 'lunch', label: '점심' });
  assert.deepStrictEqual(T.mismatch('dinner', '23:00'), { id: 'bedtime', label: '자기 전' });
});
console.log('\n' + n + '개 통과');
