/*
 * 복용 시각 입력 — 키보드로 친 말("730", "7:30", "오후 7시 30분")을 "HH:MM"으로 바꾸고, 어느 시간대(아침·점심·저녁·자기 전)에 들어가는지 알려 준다.
 * 시간대 경계는 엔진(js/care.js)과 같다: 아침 04:00~10:59, 점심 11:00~14:59, 저녁 15:00~20:59, 자기 전 21:00~03:59.
 *
 *   KeepingTime.parse('730')        → '07:30'
 *   KeepingTime.parse('오후 7시 반') → '19:30'
 *   KeepingTime.parse('25:00')      → null
 *   KeepingTime.bandOf('13:00')     → { id:'lunch', label:'점심' }
 *   KeepingTime.DEFAULTS            → { morning:'07:30', lunch:'12:30', dinner:'18:30', bedtime:'22:00' }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingTime = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = { morning: '07:30', lunch: '12:30', dinner: '18:30', bedtime: '22:00' };
  var BANDS = [
    { id: 'morning', label: '아침', from: 240, to: 660 },
    { id: 'lunch', label: '점심', from: 660, to: 900 },
    { id: 'dinner', label: '저녁', from: 900, to: 1260 },
    { id: 'bedtime', label: '자기 전', from: 1260, to: 1680 }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(h, m) { return (h >= 0 && h <= 23 && m >= 0 && m <= 59) ? pad(h) + ':' + pad(m) : null; }
  function toMin(hhmm) { var m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }

  function parse(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase();
    if (!s) return null;
    var pm = /오후|pm|p\.m/.test(s), am = /오전|am|a\.m/.test(s);
    s = s.replace(/오전|오후|am|pm|a\.m\.?|p\.m\.?/g, '').trim();
    var half = /반/.test(s);                                   // "7시 반"
    s = s.replace(/반/, '');
    var h, m = 0, g;
    if ((g = /^(\d{1,2})\s*(?:시|:|\.)\s*(\d{1,2})?\s*분?$/.exec(s))) { h = +g[1]; m = g[2] != null ? +g[2] : 0; }
    else if ((g = /^(\d{1,2})\s*시?$/.exec(s))) { h = +g[1]; }
    else if ((g = /^(\d{1,2})(\d{2})$/.exec(s))) { h = +g[1]; m = +g[2]; }   // 730, 0730, 1930
    else return null;
    if (half) m = 30;
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    return fmt(h, m);
  }

  function bandOf(hhmm) {
    var m = toMin(hhmm); if (m == null) return null;
    var x = m < 240 ? m + 1440 : m;
    for (var i = 0; i < BANDS.length; i++) if (x >= BANDS[i].from && x < BANDS[i].to) return { id: BANDS[i].id, label: BANDS[i].label };
    return null;
  }
  /* 고른 칩(아침 등)과 친 시각의 시간대가 다르면 알려 준다. 시간선에는 친 시각 기준으로 들어간다. */
  function mismatch(chipBandId, hhmm) {
    var b = bandOf(hhmm);
    return (b && chipBandId && b.id !== chipBandId) ? b : null;
  }
  return { parse: parse, bandOf: bandOf, mismatch: mismatch, toMin: toMin, DEFAULTS: DEFAULTS, BANDS: BANDS };
});
