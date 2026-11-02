/*
 * 영양제 검색(서버 없이) — 앱에 들어 있는 영양제 성분 목록(supplementKeyList + 추가 키)에서 이름·별칭으로 찾는다.
 * 정적 배포(GitHub Pages)에는 /api/supp 서버가 없어서 영양제 검색이 비던 문제를 막는다.
 * 제품(브랜드) 단위가 아니라 "성분 단위"로 담긴다. 엔진은 성분 키(ingredientKeys)로 약과의 주의를 찾으므로 결과는 같다.
 *
 * 쓰는 법
 *   var S = KeepingSupp.create({ keyList: KEEPING_DATA.supplementKeyList, extra: extraKeys, popular: KEEPING_DATA.chipKeys });
 *   S.search('칼슘')   → [{ key:'k-calcium', source:'local', name:'칼슘', sub:'…', supp:{ name, company:'', ingredientKeys:['calcium'], … } }]
 *   S.search('')      → 자주 찾는 성분(popular) 순서
 *   S.get('calcium')  → 같은 모양의 결과 하나
 *
 * 제품(브랜드) 단위 검색: scripts/fetch_supplements.py가 만든 data/supp/products.json의 rows를 넘기면 제품 이름·업체로도 찾는다.
 *   var S = KeepingSupp.create({ ..., products: json.rows });   // 성분 키는 mapKeys가 알아서 찾는다
 *   S.mapKeys('칼슘, 비타민D3') → ['calcium','vitaminD']  (원재료 글자에서 성분 키를 모두 찾는다. mapKeys 옵션을 주면 그 결과와 합친다)
 *   S.search('센트룸') → 성분 결과(있으면 앞 3개까지) 뒤에 제품 결과: { key:'s-<신고번호>', source:'catalog', name, sub:'업체 · 신고번호', supp:{ reportNo, name, company, ingredientRaw, ingredientKeys } }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingSupp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s\-_.()·,/]+/g, ''); }

  function create(opts) {
    opts = opts || {};
    var byId = {}, list = [];
    (opts.keyList || []).concat(opts.extra || []).forEach(function (k) {
      if (!k || !k.id) return;
      if (byId[k.id]) {                                  // 같은 id는 별칭을 합친다
        var al = byId[k.id].aliases;
        (k.aliases || []).forEach(function (a) { if (al.indexOf(a) < 0) al.push(a); });
        return;
      }
      byId[k.id] = { id: k.id, ko: k.ko || k.id, scope: !!k.scope, aliases: [k.ko || k.id].concat(k.aliases || []) };
      list.push(byId[k.id]);
    });
    var popular = opts.popular || [];
    var products = (opts.products || []).map(function (r) { return { r: r, n: norm(r[1]), c: norm(r[2]) }; });   // [신고번호, 제품명, 업체, 원재료]
    var extraMap = opts.mapKeys || null;
    /* 글자 속에서 성분 이름(별칭)을 찾는다: "칼슘, 비타민D3, 마그네슘" → [calcium, vitaminD, magnesium].
       한 글자·아주 짧은 영문 별칭은 건너뛰고(철, fe 등), 기초 재료로만 쓰이는 말(대두유 등)은 지우고 본다. */
    var EXCLUDE = ['대두유', '대두레시틴', '레시틴', '대두왁스'];
    var matchers = list.map(function (k) {
      return { id: k.id, as: k.aliases.map(norm).filter(function (a) { return /[가-힣]/.test(a) ? a.length >= 2 : a.length >= 4; }) };
    });
    function mapKeys(text) {
      var t = norm(text); EXCLUDE.forEach(function (x) { t = t.split(norm(x)).join(''); });
      var out = [];
      matchers.forEach(function (m) { if (m.as.some(function (a) { return t.indexOf(a) >= 0; })) out.push(m.id); });
      if (extraMap) { var e = extraMap(text); (Array.isArray(e) ? e : e ? [e] : []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); }
      return out;
    }

    function entry(k) {
      return { key: 'k-' + k.id, source: 'local', name: k.ko, sub: '영양제 성분 · 제품 이름은 몰라도 돼요',
               supp: { reportNo: null, name: k.ko, company: '', reportedAt: '', ingredientRaw: k.ko, ingredientKeys: [k.id] } };
    }
    /* 0 정확히 같음, 1 앞부분이 같음, 2 포함, null 없음 */
    function score(k, q) {
      var best = null;
      k.aliases.forEach(function (a) {
        var n = norm(a), s = n === q ? 0 : n.indexOf(q) === 0 ? 1 : n.indexOf(q) >= 0 ? 2 : null;
        if (s !== null && (best === null || s < best)) best = s;
      });
      return best;
    }
    function search(q, o) {
      var limit = (o && o.limit) || 8, nq = norm(q);
      if (!nq) return popular.map(function (id) { return byId[id]; }).filter(Boolean).slice(0, limit).map(entry);
      var hits = [];
      list.forEach(function (k, i) { var s = score(k, nq); if (s !== null) hits.push({ k: k, s: s, i: i }); });
      hits.sort(function (a, b) { return (a.s - b.s) || (a.i - b.i); });
      return hits.slice(0, limit).map(function (h) { return entry(h.k); });
    }
    function productEntry(p) {
      var r = p.r, k = mapKeys(r[3] + ' ' + r[1]);   // 원재료(앞 60자)와 제품 이름 둘 다 본다
      return { key: 's-' + r[0], source: 'catalog', name: r[1], sub: r[2] + ' · ' + r[0],
               supp: { reportNo: r[0], name: r[1], company: r[2], reportedAt: '', ingredientRaw: r[3], ingredientKeys: k } };
    }
    function searchProducts(q, o) {
      var limit = (o && o.limit) || 8, nq = norm(q);
      if (!nq || !products.length) return [];
      var hits = [];
      for (var i = 0; i < products.length && hits.length < 500; i++) {
        var p = products[i], at = p.n.indexOf(nq), ac = p.c.indexOf(nq);
        if (at >= 0 || ac >= 0) hits.push({ p: p, s: at === 0 ? 0 : at > 0 ? 1 : 2, i: i });
      }
      hits.sort(function (a, b) { return (a.s - b.s) || (a.p.r[1].length - b.p.r[1].length) || (a.i - b.i); });
      return hits.slice(0, limit).map(function (h) { return productEntry(h.p); });
    }
    /* 성분 결과(앞 3개) + 제품 결과. 제품 목록이 없으면 성분 결과만 */
    function searchAll(q, o) {
      var limit = (o && o.limit) || 12, ing = search(q, { limit: products.length ? 3 : limit });
      return ing.concat(searchProducts(q, { limit: limit - ing.length }));
    }
    function get(id) { return byId[id] ? entry(byId[id]) : null; }
    return { search: search, searchProducts: searchProducts, searchAll: searchAll, get: get, mapKeys: mapKeys, size: list.length, productCount: products.length };
  }
  return { create: create, norm: norm };
});
