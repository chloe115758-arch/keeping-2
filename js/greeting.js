/*
 * 키핑 홈 헤더 문구 — 시간대와 체크 상태로 인사말·오늘의 복약 카드(진행 바)·주의 문장을 정한다.
 * 문구는 data/copy/greeting.json(docs/ux-writing.md에서 만든 것)에서 가져오고, 이 파일은 "어떤 문구를 언제 쓰는가"만 안다.
 *
 * 쓰는 법 (js/josa.js를 먼저 불러온다)
 *   var g = KeepingGreeting.create(copyJson);                 // { tone, copy: {...} }
 *   var h = g.state({ nowMin: 12*60+5, nickname: '지수', hasUntimed: false,
 *                     slots: [{ id:'morning', time:'07:00', total:3, taken:3 }, ...] });   // total·taken = 체크 칸(묶음) 개수
 *   h.line1, h.line2, h.card.{title, icon, emoji, count, taken, total, ratio, status}, h.aria
 *   g.say('notice_interval', { subject:'칼슘 영양제', object:'내과 처방약', interval:'최소 4시간 간격' })
 *
 * 문구 안의 자리표시: {key}는 값으로, {key:은/는}은 값 + 받침에 맞는 조사로, {name}님은 이름이 없으면 통째로 사라진다.
 * 규칙: docs/ux-writing.md. 복용 지시 문구를 만들지 않는다(문구 표가 그렇게 쓰여 있다).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./josa.js'));
  else root.KeepingGreeting = factory(root.KeepingJosa);
})(typeof self !== 'undefined' ? self : this, function (Josa) {
  'use strict';

  var GRACE_MIN = 60;                       // 시간대가 지나고 이만큼 더 기다린 뒤에야 "놓친 시간대"로 본다
  var EMOJI = { morning: '☀️', lunch: '🌤️', dinner: '🌇', night: '🌙' };
  var ICON = { morning: 'sun', lunch: 'sun', dinner: 'sun', night: 'moon' };
  var SLOT_LABEL = { morning: '아침', lunch: '점심', dinner: '저녁', night: '자기 전' };

  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function bandOf(min) {
    if (min >= 240 && min < 660) return 'morning';
    if (min >= 660 && min < 900) return 'lunch';
    if (min >= 900 && min < 1260) return 'dinner';
    return 'night';
  }
  function dayMin(min) { return min < 240 ? min + 1440 : min; }   // 자정 이후 새벽은 "어제의 밤"에 이어 붙인다

  function fill(text, vars) {
    var s = String(text == null ? '' : text);
    vars = vars || {};
    if (!vars.name) {
      s = s.replace(/,\s*\{name\}님/g, '').replace(/\{name\}님,\s*/g, '').replace(/\{name\}님\s*/g, '');
    }
    s = s.replace(/\{(\w+)(?::([^}]+))?\}/g, function (m, k, pair) {
      var v = vars[k];
      if (v == null || v === '') return '';
      v = String(v);
      return (pair && Josa) ? Josa.attach(v, pair) : v;
    });
    return s.replace(/\s{2,}/g, ' ').replace(/\s+([!?.,])/g, '$1').trim();
  }

  function create(copyJson) {
    var C = (copyJson && copyJson.copy) || {};
    function say(key, vars) { return fill(C[key], vars); }

    function state(input) {
      input = input || {};
      var nowMin = input.nowMin != null ? input.nowMin : (function (d) { d = d || new Date(); return d.getHours() * 60 + d.getMinutes(); })(input.now);
      var band = bandOf(nowMin), n = dayMin(nowMin);
      var name = (input.nickname || '').trim();
      var slots = (input.slots || []).filter(function (s) { return toMin(s.time) != null && s.total > 0; })
        .map(function (s) { var m = toMin(s.time); return { id: s.id, min: m, total: s.total, taken: Math.min(s.taken || 0, s.total), band: bandOf(m) }; })
        .sort(function (a, b) { return dayMin(a.min) - dayMin(b.min); });

      var total = 0, taken = 0, missedN = 0, labels = [];
      slots.forEach(function (s) {
        total += s.total; taken += s.taken;
        if (s.taken < s.total && n > dayMin(s.min) + GRACE_MIN) {
          missedN += s.total - s.taken;
          var l = SLOT_LABEL[s.band]; if (labels.indexOf(l) < 0) labels.push(l);
        }
      });
      var missed = labels.length > 2 ? labels[0] + ' 외' : labels.join('·');
      var vars = { name: name, taken: taken, left: total - taken, total: total, missed: missed, missedN: missedN };

      var line2Key, cardKey;
      if (total === 0) { line2Key = input.hasUntimed ? 'notime_line2' : 'empty_line2'; cardKey = 'card_empty'; }
      else if (taken === total) { line2Key = 'done_' + band; cardKey = 'card_done'; }
      else if (missedN > 0) { line2Key = 'missed_' + band; cardKey = 'card_missed'; }
      else if (taken > 0) { line2Key = 'progress_' + band; cardKey = 'card_progress'; }
      else { line2Key = 'start_' + band; cardKey = 'card_start'; }

      return {
        band: band,
        line1: say('greet_' + band, vars),
        line2: say(line2Key, vars),
        card: { title: say('card_title'), icon: ICON[band], emoji: EMOJI[band], count: taken + '/' + total, taken: taken, total: total,
                ratio: total ? taken / total : 0, status: say(cardKey, vars) },
        aria: total ? total + '개 중 ' + taken + '개 확인했어요' : '오늘 확인할 복약이 없어요',
        keys: { line1: 'greet_' + band, line2: line2Key, card: cardKey }
      };
    }
    return { state: state, say: say, bandOf: bandOf };
  }

  return { create: create, fill: fill, bandOf: bandOf, toMin: toMin };
});
