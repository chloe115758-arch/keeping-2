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
  var DUR_LIMIT = 20;
  /* 전체 약 목록(DUR)이 연결돼 있으면 거기서 찾는다. 21개를 달라고 해서 "더 있는지"만 알아낸다. */
  function searchDrugsDur(dur, q, max) {
    var lim = max || DUR_LIMIT, rows = dur.search(q, { limit: lim + 1 });   // max: 온보딩 검색은 8줄
    var more = rows.length > lim;
    return Promise.resolve({
      results: rows.slice(0, lim).map(function (r) {
        return {
          key: 'd-' + r.code, source: 'dur', code: r.code, name: r.display,
          sub: [r.company, r.category === '전문의약품' ? '전문' : (r.category === '일반의약품' ? '일반' : '')].filter(Boolean).join(' · '),
          outside: r.kind === 'outside'
        };
      }),
      more: more, remote: { status: 'off' }
    });
  }
  /* 온보딩 검색: 함량·괄호를 뗀 짧은 이름으로 묶어 6줄까지 (js/drugname.js). 고르면 그 묶음의 대표 제품(code)로 담는다. */
  function searchDrugsGrouped(dur, q) {
    var g = root.KeepingDrugName.group(dur.search(q, { limit: 40 }), { query: q, limit: 6 });
    return Promise.resolve({
      results: g.map(function (x) { return { key: 'd-' + x.rep.code, source: 'dur', code: x.rep.code, name: x.name, base: x.name, variants: x.variants, sub: '', outside: x.rep.kind === 'outside' }; }),
      more: false, remote: { status: 'off' }
    });
  }
  function searchDrugs(q, opts) {
    if (Pack.dur && q && opts && opts.grouped && root.KeepingDrugName) return searchDrugsGrouped(Pack.dur, q);
    if (Pack.dur && q) return searchDrugsDur(Pack.dur, q, opts && opts.limit);
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
  /* 성분 단위 로컬 검색(js/suppsearch.js). 서버가 없거나 실패해도 이 결과는 항상 먼저 돌려준다.
     추가 키 파일(supplement-keys-extra.json)은 한 번만 읽고, 못 읽으면 datapack의 키만으로 만든다. */
  var suppIndex = null, suppInfo = { products: 'loading', source: '' };
  function loadJson(url, pick, empty) {
    return (typeof fetch === 'function')
      ? fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(pick).catch(function () { return empty; })
      : Promise.resolve(empty);
  }
  function suppSearcher() {
    if (suppIndex) return suppIndex;
    var extra = root.KeepingSupp ? loadJson('data/care/supplement-keys-extra.json', function (j) { return j.keys || []; }, []) : Promise.resolve([]);
    /* 제품 목록(data/supp/products.json)은 없어도 된다. 있으면 한 번만 읽어 캐시한다. */
    var prod = root.KeepingSupp ? loadJson('data/supp/products.json', function (j) { return (j && Array.isArray(j.rows) && j.rows.length) ? j : null; }, null) : Promise.resolve(null);
    suppIndex = Promise.all([extra, prod]).then(function (r) {
      suppInfo = { products: r[1] ? 'ready' : 'off', source: (r[1] && r[1].meta && r[1].meta.source) || '' };
      return root.KeepingSupp ? root.KeepingSupp.create({ keyList: Pack.supplementKeyList, extra: r[0], popular: Pack.chipKeys, products: r[1] ? r[1].rows : [] }) : null;
    });
    return suppIndex;
  }
  function searchSupplements(q) {
    return suppSearcher().then(function (S) { return searchSupplementsWith(S, q); });
  }
  function searchSupplementsWith(S, q) {
    var out = S ? (q ? S.searchAll(q, { limit: 12 }) : S.search('', { limit: 12 })) : [];   // 성분 결과가 앞, 제품 결과가 뒤
    if (!q) return Promise.resolve({ results: out, remote: { status: base ? 'idle' : 'off' } });
    Pack.supplements.forEach(function (s) {
      if (has(s.name + s.company, q)) {
        out.push({
          key: 's-' + s.reportNo, source: 'pack', name: s.name,
          sub: s.company + ' · ' + s.reportedAt + ' 신고 · ' + s.reportNo,
          supp: s
        });
      }
    });
    if (!base) return Promise.resolve({ results: out, remote: { status: 'off' } });
    return getJSON(base + '/api/supp?name=' + encodeURIComponent(q)).then(function (j) {
      (j.rows || []).forEach(function (r) {
        if (Pack.supplements.some(function (s) { return s.reportNo === r.reportNo; })) return;
        var keys = S ? S.mapKeys(r.ingredientRaw) : [];   // 성분 키는 KeepingSupp가 만든다
        out.push({
          key: 'a-' + r.reportNo, source: 'api', name: r.name,
          sub: r.company + ' · ' + (r.reportedAt || '') + ' 신고 · ' + r.reportNo,
          supp: {
            reportNo: r.reportNo, name: r.name, company: r.company, reportedAt: r.reportedAt,
            ingredientRaw: r.ingredientRaw, ingredientKeys: keys,
            intake: r.intake, functionality: r.functionality, cautions: r.cautions
          }
        });
      });
      return { results: out, remote: { status: 'ok' } };
    }).catch(function () {
      return { results: out, remote: { status: 'error' } };
    });
  }

  root.KeepingApi = {
    proxyBase: base,
    searchDrugs: searchDrugs,
    searchSupplements: searchSupplements,
    suppInfo: function () { return suppSearcher().then(function () { return suppInfo; }); }
  };
})(window);
