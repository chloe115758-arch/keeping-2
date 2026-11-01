/*
 * 한국어 조사 붙이기 — 받침 유무로 은/는, 과/와, 을/를, 이/가, 으로/로를 고른다.
 * 쓰는 법: KeepingJosa.attach('칼슘 영양제', '은/는') → '칼슘 영양제는'
 * 한글이 아닌 끝글자는 읽는 소리로 판단한다: 숫자(영일이삼사오육칠팔구)와 알파벳(에이 비 씨 …).
 * 판단할 수 없는 글자(기호 등)는 앞 글자로 거슬러 올라간다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingJosa = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIGIT = { '0': 'ㅇ', '1': 'ㄹ', '2': '', '3': 'ㅁ', '4': '', '5': '', '6': 'ㄱ', '7': 'ㄹ', '8': 'ㄹ', '9': '' };   // 받침(읽는 소리 기준): 영 일 이 삼 사 오 육 칠 팔 구
  var LATIN = { a: '', b: '', c: '', d: '', e: '', f: 'ㅍ', g: '', h: '', i: '', j: '', k: '', l: 'ㄹ', m: 'ㅁ', n: 'ㄴ', o: '', p: '', q: '', r: 'ㄹ', s: '', t: '', u: '', v: '', w: '', x: 'ㅅ', y: '', z: '' };
  var JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  /* 마지막으로 읽히는 글자의 받침: '' (없음) 또는 받침 글자. 판단 불가면 null */
  function finalOf(word) {
    var s = String(word == null ? '' : word);
    for (var i = s.length - 1; i >= 0; i--) {
      var ch = s.charAt(i), c = ch.charCodeAt(0);
      if (c >= 0xAC00 && c <= 0xD7A3) return JONG[(c - 0xAC00) % 28];
      if (DIGIT.hasOwnProperty(ch)) return DIGIT[ch];
      var lo = ch.toLowerCase();
      if (LATIN.hasOwnProperty(lo)) return LATIN[lo];
      // 괄호·점·공백 같은 기호는 건너뛴다
    }
    return null;
  }
  /* pair: '은/는' | '과/와' | '을/를' | '이/가' | '으로/로' (앞이 받침 있을 때, 없을 때) */
  function pick(word, pair) {
    var two = String(pair).split('/'), f = finalOf(word);
    if (f === null) return two[1];
    var has = f !== '';
    if (pair === '으로/로') return (!has || f === 'ㄹ') ? two[1] : two[0];   // ㄹ 받침은 '로'
    return has ? two[0] : two[1];
  }
  function attach(word, pair) { return String(word) + pick(word, pair); }

  return { attach: attach, pick: pick, finalOf: finalOf };
});
