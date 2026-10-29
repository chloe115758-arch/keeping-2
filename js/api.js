/*
 * 데이터 조회 모듈
 * 1) 데이터 팩(확인한 실제 응답)에서 먼저 찾습니다.
 * 2) config.js의 proxyBase가 설정돼 있으면 서버 중계(/api/*)로 더 넓게 찾습니다.
 *    — 서버 중계는 인증키를 서버에만 두기 위한 것입니다. 브라우저에 키를 넣지 마세요.
 * 팩 밖의 결과는 등록은 되지만 "확인 못 함"으로 표시됩니다.
 */
(function (root) {
  'use strict';
  var Pack = root.KEEPING_DATA;
  var E = root.KeepingEngine;
  var cfg = root.KEEPING_CONFIG || {};
  var base = (cfg.proxyBase || '').replace(/\/$/, '');

  function has(hay, q) { return E.norm(hay).indexOf(E.norm(q)) > -1; }

  function getJSON(url) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 8000);
    return fetch(url, { signal: ctl.signal }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).finally(function () { clearTimeout(timer); });
  }

  /* ---------- 약 ---------- */
  function searchDrugs(q) {
    var out = [];
    Pack.drugs.forEach(function (d) {
      if (!q || has(d.nameFull + d.name + (d.ingredientKo || ''), q)) {
        out.push({
          key: 'p-' + d.itemSeq, source: 'pack', itemSeq: d.itemSeq,
          name: d.display || d.name,
          sub: [d.category, d.type].filter(Boolean).join(' · ') || '일부 정보만 확인했어요'
        });
      }
    });
    if (!base || !q) return Promise.resolve({ results: out, remote: { status: base ? 'idle' : 'off' } });
    return getJSON(base + '/api/drugs?name=' + encodeURIComponent(q)).then(function (j) {
      (j.rows || []).forEach(function (r) {
        if (Pack.drugs.some(function (d) { return d.itemSeq === r.itemSeq; })) return;
        out.push({
          key: 'a-' + r.itemSeq, source: 'api', itemSeq: r.itemSeq,
          name: r.name, sub: [r.category, r.type].filter(Boolean).join(' · ') + ' · 확인 범위 밖',
          ingredientKo: r.ingredient || null, type: r.type || null
        });
      });
      return { results: out, remote: { status: 'ok' } };
    }).catch(function () {
      return { results: out, remote: { status: 'error' } };
    });
  }

  /* ---------- 국내 영양제 ---------- */
  function searchSupplements(q) {
    var out = [];
    Pack.supplements.forEach(function (s) {
      if (!q || has(s.name + s.company, q)) {
        out.push({
          key: 's-' + s.reportNo, source: 'pack', name: s.name,
          sub: s.company + ' · ' + s.reportedAt + ' 신고 · ' + s.reportNo,
          supp: s
        });
      }
    });
    if (!base || !q) return Promise.resolve({ results: out, remote: { status: base ? 'idle' : 'off' } });
    return getJSON(base + '/api/supp?name=' + encodeURIComponent(q)).then(function (j) {
      (j.rows || []).forEach(function (r) {
        if (Pack.supplements.some(function (s) { return s.reportNo === r.reportNo; })) return;
        var key = E.mapIngredient(r.ingredientRaw, Pack);
        out.push({
          key: 'a-' + r.reportNo, source: 'api', name: r.name,
          sub: r.company + ' · ' + (r.reportedAt || '') + ' 신고 · ' + r.reportNo,
          supp: {
            reportNo: r.reportNo, name: r.name, company: r.company, reportedAt: r.reportedAt,
            ingredientRaw: r.ingredientRaw, ingredientKeys: key ? [key] : [],
            intake: r.intake, functionality: r.functionality, cautions: r.cautions
          }
        });
      });
      return { results: out, remote: { status: 'ok' } };
    }).catch(function () {
      return { results: out, remote: { status: 'error' } };
    });
  }

  /* ---------- 해외 영양제 (미국 NIH DSLD) ---------- */
  function searchOverseas(q) {
    if (!base) return Promise.resolve({ status: 'off', results: [] });
    return getJSON(base + '/api/dsld?name=' + encodeURIComponent(q)).then(function (j) {
      return { status: (j.rows && j.rows.length) ? 'ok' : 'empty', results: j.rows || [] };
    }).catch(function () { return { status: 'error', results: [] }; });
  }

  root.KeepingApi = {
    proxyBase: base,
    searchDrugs: searchDrugs,
    searchSupplements: searchSupplements,
    searchOverseas: searchOverseas
  };
})(window);
