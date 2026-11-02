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
 *   var S = KeepingSupp.create({ ..., products: json.rows, mapKeys: function (raw) { return E.mapIngredient(raw, Pack); } });
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
    var mapKeys = opts.mapKeys || null;

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
      var r = p.r, k = mapKeys ? mapKeys(r[3]) : null;
      return { key: 's-' + r[0], source: 'catalog', name: r[1], sub: r[2] + ' · ' + r[0],
               supp: { reportNo: r[0], name: r[1], company: r[2], reportedAt: '', ingredientRaw: r[3], ingredientKeys: k ? (Array.isArray(k) ? k : [k]) : [] } };
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
    return { search: search, searchProducts: searchProducts, searchAll: searchAll, get: get, size: list.length, productCount: products.length };
  }
  return { create: create, norm: norm };
});
