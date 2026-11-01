/* 실행: node tests/greeting.test.js — 홈 헤더 문구(js/greeting.js) 점검 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const G = require('../js/greeting.js');
const copy = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/copy/greeting.json'), 'utf8'));
const g = G.create(copy);
const mk = (h, m) => h * 60 + m;
const S = (id, time, total, taken) => ({ id, time, total, taken: taken || 0 });
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

t('아침, 아직 아무것도 안 했다 → 시작 전', () => {
  const h = g.state({ nowMin: mk(7, 30), nickname: '지수', slots: [S('m', '07:00', 3), S('l', '12:30', 2), S('b', '21:00', 2)] });
  assert.strictEqual(h.line1, '좋은 아침이에요, 지수님!');
  assert.strictEqual(h.line2, '건강한 하루를 시작해볼까요?');
  assert.deepStrictEqual([h.card.count, h.card.ratio, h.card.status, h.card.icon], ['0/7', 0, '아직 시작 전이에요', 'sun']);
});
t('이름이 없으면 "님"과 쉼표까지 사라진다', () => {
  assert.strictEqual(g.state({ nowMin: mk(8, 0), slots: [S('m', '07:00', 1)] }).line1, '좋은 아침이에요!');
  assert.strictEqual(g.state({ nowMin: mk(12, 0), slots: [S('l', '12:00', 1)] }).line1, '점심 시간이에요!');
  assert.strictEqual(G.fill('{name}님, 오늘도 수고했어요', {}), '오늘도 수고했어요');
  assert.strictEqual(G.fill('좋은 아침이에요, {name}님!', { name: '민' }), '좋은 아침이에요, 민님!');
});
t('조사 자리표시 {key:은/는}은 값의 받침에 맞게 붙는다', () => {
  assert.strictEqual(G.fill('{a:은/는} {b:과/와} {c:을/를} 둔다', { a: '칼슘 영양제', b: '내과 처방약', c: '최소 4시간 간격' }), '칼슘 영양제는 내과 처방약과 최소 4시간 간격을 둔다');
  assert.strictEqual(G.fill('{a:은/는}', { a: '' }), '');
});
t('주의 문장: 간격 숫자가 있을 때만 "권장해요"', () => {
  assert.strictEqual(g.say('notice_interval', { subject: '칼슘 영양제', object: '내과 처방약', interval: '최소 4시간 간격' }), '칼슘 영양제는 내과 처방약과 최소 4시간 간격을 두는 것을 권장해요');
  assert.strictEqual(g.say('notice_caution', { subject: '마그네슘', object: '피부과 처방약' }), '마그네슘은 피부과 처방약과 함께 쓸 때 주의가 필요하다고 안내돼 있어요');
  assert.strictEqual(g.say('notice_official', { subject: '시바스정', object: '코니트라정' }), '시바스정은 코니트라정과 함께 복용하지 않도록 지정된 조합이에요');
  assert.ok(!/권장/.test(g.say('notice_caution', { subject: 'a', object: 'b' })) && !/권장/.test(g.say('notice_official', { subject: 'a', object: 'b' })));
});
t('체크하면 진행 문구와 바가 바뀐다 (3/7)', () => {
  const h = g.state({ nowMin: mk(8, 10), nickname: '지수', slots: [S('m', '07:00', 3, 3), S('l', '12:30', 2), S('b', '21:00', 2)] });
  assert.deepStrictEqual([h.card.count, Math.round(h.card.ratio * 100), h.card.status, h.keys.line2], ['3/7', 43, '4개 남았어요', 'progress_morning']);
  assert.strictEqual(h.line2, '좋은 시작이에요! 4개 남았어요.');
});
t('유예 60분: 07:00 시간대는 07:59까지 놓친 게 아니고 08:01부터 놓친 것이다', () => {
  assert.notStrictEqual(g.state({ nowMin: mk(7, 59), slots: [S('m', '07:00', 2)] }).keys.line2, 'missed_morning');
  const h = g.state({ nowMin: mk(8, 1), slots: [S('m', '07:00', 2)] });
  assert.strictEqual(h.keys.line2, 'missed_morning');
});
t('점심에 아침을 놓쳤다 → 타임라인을 가리키는 문장(버튼 없음)', () => {
  const h = g.state({ nowMin: mk(12, 5), nickname: '지수', slots: [S('m', '07:00', 2), S('l', '12:30', 2), S('b', '21:00', 1)] });
  assert.strictEqual(h.keys.line2, 'missed_lunch');
  assert.ok(/^아침 복약/.test(h.line2) && /아직 체크/.test(h.line2) && /아래에서 확인해 볼까요\?$/.test(h.line2), h.line2);   // 말투(기본·친근)와 상관없이
  assert.strictEqual(h.card.status, '체크하지 않은 2개가 있어요');
  assert.ok(!('action' in h) && !('caution' in h), '버튼·주의 칩 필드가 없다');
});
t('놓친 시간대가 둘이면 "아침·점심", 셋 이상이면 "아침 외"', () => {
  assert.ok(/아침·점심 복약/.test(g.state({ nowMin: mk(17, 0), slots: [S('m', '07:00', 1), S('l', '12:30', 1), S('d', '19:00', 1)] }).line2));
  assert.ok(/아침 외 복약/.test(g.state({ nowMin: mk(20, 30), slots: [S('m', '07:00', 1), S('l', '12:30', 1), S('d', '18:30', 1)] }).line2));
});
t('밤에는 재촉하지 않고 마무리 문구', () => {
  const h = g.state({ nowMin: mk(23, 0), nickname: '지수', slots: [S('m', '07:00', 3, 3), S('l', '12:30', 2, 1), S('b', '21:00', 2)] });
  assert.strictEqual(h.line2, '오늘 3개는 체크하지 않았어요. 내일 다시 시작해요.');
  assert.deepStrictEqual([h.card.count, h.card.status], ['4/7', '체크하지 않은 3개가 있어요']);
});
t('모두 체크 → 시간대별 마무리 문구', () => {
  assert.strictEqual(g.state({ nowMin: mk(22, 0), slots: [S('m', '07:00', 2, 2), S('b', '21:00', 1, 1)] }).line2, '오늘도 잘 확인했어요. 푹 쉬세요!');
  assert.strictEqual(g.state({ nowMin: mk(9, 0), slots: [S('m', '07:00', 2, 2)] }).line2, '아침 복약 끝! 오늘도 잘 시작했어요.');
});
t('새벽 02:00에는 어제 밤 시간대가 놓친 시간대로 이어진다(자기 전)', () => {
  const h = g.state({ nowMin: mk(2, 0), slots: [S('b', '21:00', 2)] });
  assert.strictEqual(h.band, 'night');
  assert.ok(/오늘 2개는/.test(h.line2), h.line2);
});
t('시간대 경계', () => {
  const b = (m) => G.bandOf(m);
  assert.deepStrictEqual([b(mk(10, 59)), b(mk(11, 0)), b(mk(14, 59)), b(mk(15, 0)), b(mk(21, 0)), b(mk(3, 59)), b(mk(4, 0))], ['morning', 'lunch', 'lunch', 'dinner', 'night', 'night', 'morning']);
});
t('등록한 약이 없다 / 시간이 있는 약이 하나도 없다', () => {
  const e = g.state({ nowMin: mk(9, 0), nickname: '지수', slots: [] });
  assert.deepStrictEqual([e.line2, e.card.status, e.card.count], ['첫 약을 추가하고 하루를 챙겨 볼까요?', '등록한 약이 없어요', '0/0']);
  assert.strictEqual(g.state({ nowMin: mk(9, 0), slots: [], hasUntimed: true }).keys.line2, 'notime_line2');
});
t('접근성 문구', () => {
  assert.strictEqual(g.state({ nowMin: mk(9, 0), slots: [S('m', '07:00', 7, 7)] }).aria, '7개 중 7개 확인했어요');
});
t('두 말투(기본·친근) 문구 전체에 금지 표현·모르는 변수가 없다', () => {
  const md = fs.readFileSync(path.join(__dirname, '../docs/ux-writing.md'), 'utf8').split('\n');
  const BAN = /안전|괜찮|문제없|먹어도|드세요|복용하세요|챙겨\s*드|중단하세요|끊으세요|늘리세요|줄이세요|못\s*했어요|안\s*드셨/;
  const ALLOWED = ['안전하다는 뜻은 아니'];
  const OK = new Set(['name', 'taken', 'left', 'total', 'missed', 'missedN', 'subject', 'object', 'interval', 'time', 'verb', 'dept', 'text', 'c', 'more', 'n']);
  let rows = 0;
  md.forEach((line) => {
    const c = line.split('|').map((x) => x.trim());
    if (c.length !== 7 || !/^`\w+`$/.test(c[1])) return;
    [c[3], c[4]].forEach((txt) => {
      rows++;
      let tx = txt; ALLOWED.forEach((a) => { tx = tx.split(a).join(''); });
      assert.ok(!BAN.test(tx), c[1] + ': ' + txt);
      (txt.match(/\{(\w+)(?::[^}]*)?\}/g) || []).forEach((v) => assert.ok(OK.has(v.slice(1).split(/[:}]/)[0]), c[1] + ' 변수 ' + v));
    });
  });
  assert.ok(rows >= 90, '문구 행 수 ' + rows);
});
t('모든 상태·시간대 조합에서 문구가 비지 않고 자리표시가 남지 않는다', () => {
  const states = [[], [S('a', '07:00', 1)], [S('a', '07:00', 1, 1)], [S('a', '07:00', 3, 1)]];
  [mk(5, 0), mk(9, 0), mk(12, 0), mk(16, 0), mk(22, 0), mk(2, 0)].forEach((now) => states.forEach((sl) => {
    [true, false].forEach((hasU) => {
      const h = g.state({ nowMin: now, nickname: '지수', slots: sl, hasUntimed: hasU });
      assert.ok(h.line1 && h.line2 && h.card.status && h.card.title, now + ' ' + JSON.stringify(sl));
      assert.ok(!/[{}]|undefined/.test(h.line1 + h.line2 + h.card.status), h.line2);
    });
  }));
});
console.log('\n' + n + '개 통과');
