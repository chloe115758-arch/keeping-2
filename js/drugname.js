/*
 * 약 이름 줄이기·묶기 — 검색 결과를 시안처럼 "글리메디정, 글리메윈정…" 짧은 이름으로 한 줄씩 보여 주기 위한 도구.
 * 실제 제품 이름은 "씬지로이드정0.1밀리그램(레보티록신나트륨수화물)"처럼 함량과 성분이 붙어 길고, 함량만 다른 것이 여러 개 나온다.
 * 키핑은 성분 기준으로 주의를 찾으므로(함량은 결과에 영향이 없다) 이름에서 함량·괄호를 떼고, 같은 이름은 한 줄로 묶어도 된다.
 *
 *   KeepingDrugName.baseName('씬지로이드정0.1밀리그램(레보티록신나트륨수화물)') → '씬지로이드정'
 *   KeepingDrugName.group(dur.search('씬지', {limit: 30}), { query: '씬지', limit: 8 })
 *      → [{ name:'씬지로이드정', variants: 4, rep: <검색 결과 하나(그 묶음의 대표)> }, { name:'씬지록신정', ... }]
 *   고른 줄의 대표(rep.code)로 항목을 만든다(dur.toItem). 함량이 여럿이어도 같은 성분이라 주의 안내는 같다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingDrugName = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNIT = '(?:밀리그램|밀리그람|마이크로그램|마이크로그람|그램|그람|㎎|㎍|μg|mcg|ug|mg|g|㎖|ml|mL|%|IU|국제단위|단위|U)';
  var STRENGTH_TAIL = new RegExp('\\d[\\d.,]*(?:\\/\\d[\\d.,]*)*\\s*' + UNIT + '[\\s\\S]*$', 'i');

  function stripParens(s) {                      // 중첩 괄호까지 모두 지운다: "(아세트아미노펜(미분화))"
    var out = '', depth = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') { if (depth > 0) depth--; }
      else if (depth === 0) out += c;
    }
    return out;
  }
  function baseName(name) {
    var s = stripParens(String(name == null ? '' : name)).replace(/\s+/g, ' ').trim();
    var cut = s.replace(STRENGTH_TAIL, '').trim();
    return cut.length >= 2 ? cut : s;            // 이름이 통째로 지워지는 경우는 그대로 둔다
  }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s\-_.()·,/]+/g, ''); }

  /* 검색 결과를 이름 기준으로 묶는다. 검색어로 시작하는 이름이 먼저, 그다음 짧은 이름 순(같으면 원래 순서). */
  function group(results, opts) {
    opts = opts || {};
    var limit = opts.limit || 8, nq = norm(opts.query), map = {}, order = [];
    (results || []).forEach(function (r, i) {
      var name = baseName(r.name), k = norm(name);
      if (!map[k]) { map[k] = { name: name, variants: 0, rep: r, i: i }; order.push(k); }
      map[k].variants++;
    });
    var list = order.map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      var pa = nq && norm(a.name).indexOf(nq) === 0 ? 0 : 1, pb = nq && norm(b.name).indexOf(nq) === 0 ? 0 : 1;
      return (pa - pb) || (a.name.length - b.name.length) || (a.i - b.i);
    });
    return list.slice(0, limit).map(function (g) { return { name: g.name, variants: g.variants, rep: g.rep }; });
  }
  return { baseName: baseName, group: group };
});
