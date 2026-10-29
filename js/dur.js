/*
 * 키핑 DUR 모듈 — 병용금기 파일 + 약제급여목록으로 "약 검색"과 "약↔약 병용금기 확인"을 합니다.
 * 서버·인증키·호출 한도가 필요 없습니다. 데이터는 scripts/build_packs.py로 만든 JSON 두 개입니다.
 *
 *   data/dur/dur-pairs.json  병용금기 성분 쌍 + 금기사유 + 비고 + 고시일
 *   data/dur/products.json   제품 전체 목록(제품코드 → 이름·업체·주성분코드·전문/일반)
 *
 * 쓰는 법 (브라우저)
 *   KeepingDur.load('data/dur/').then(function (dur) { ... });
 * 쓰는 법 (Node / 테스트)
 *   var dur = KeepingDur.create({ pairs: <dur-pairs.json>, products: <products.json> });
 *
 * 판정하지 않습니다. "병용금기 목록에 해당하는 쌍이 있다/없다"만 알려줍니다. 없다는 것은 안전하다는 뜻이 아닙니다.
 *
 * 이용 조건: 병용금기 파일은 한국의약품안전관리원, 공공저작물 · 출처표시 · 상업적 이용금지(제2유형).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingDur = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAIR_URL = 'https://www.data.go.kr/data/15089525/fileData.do';
  var CATEGORY = ['전문의약품', '일반의약품', null];   // products.json의 구분값 0/1/2
  // 허가정보 품목기준코드(itemSeq) ↔ 보험코드. 데이터 팩의 약을 급여목록 제품과 이어 줍니다.
  // 제품명·주성분이 일치하는 것을 직접 확인한 5개만 둡니다.
  var LEGACY = [
    ['198801649', '645602250'],   // 후로스판정
    ['199501749', '698500300'],   // 브로목틸정 20mg
    ['200402420', '698500200'],   // 이텍스시메티딘정
    ['199000541', '642101071'],   // 알마겔에프현탁액
    ['200403126', '670601380']    // 시바스정 (데이터 팩에 함량 표기가 없어 20mg 제품에 연결. 병용금기는 성분 기준이라 함량과 무관)
  ];

  function norm(s) {
    return String(s == null ? '' : s).replace(/[\s·\-_()\[\]\/,+]/g, '').toLowerCase();
  }

  /* 급여목록의 성분명에서 함량을 떼어 읽기 좋게 만든다. 예) "acetaminophen   0.325g, tramadol hydrochloride   37.5mg"
     → display "acetaminophen + tramadol hydrochloride". 검색·표시에만 쓰고, 쌍 조회는 성분코드로 한다. */
  function cleanIngr(name) {
    var parts = String(name || '')
      .replace(/\(\s*as\s[^)]*\)/gi, '')
      .replace(/\s*\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|µg|μg|ug|ml|iu|u|%|meq|mmol)(?![a-z])/gi, '')
      .split(/[+,]/)
      .map(function (x) { return x.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean);
    return { display: parts.join(' + '), parts: parts };
  }

  function create(data) {
    var P = data.pairs;
    var table = (data.products && data.products.products) || data.products;
    var prodMeta = (data.products && data.products.meta) || {};
    var ingrName = P.ingredients || {};

    /* 성분 쌍 색인 (방향 없음) */
    var pairIdx = {}, ingrWithPair = {};
    P.pairs.forEach(function (p) {
      var a = p[0], b = p[1];
      ingrWithPair[a] = true; ingrWithPair[b] = true;
      var k = a < b ? a + '|' + b : b + '|' + a;
      (pairIdx[k] = pairIdx[k] || []).push({
        reason: P.reasons[p[2]], note: p[3] >= 0 ? P.notes[p[3]] : '', date: P.dates[p[4]]
      });
    });

    /* 성분코드별로 정리한 이름은 한 번만 계산 */
    var ingrInfo = {};
    function ingrOf(code) {
      if (!ingrInfo[code]) {
        var c = cleanIngr(ingrName[code]);
        ingrInfo[code] = { display: c.display, norms: c.parts.map(norm), joined: norm(c.display) };
      }
      return ingrInfo[code];
    }

    /* 제품 검색 색인 */
    var rows = [];
    Object.keys(table).forEach(function (code) {
      var v = table[code];
      rows.push({
        code: code, kind: v[4],
        nName: norm(v[0]), nIngr: ingrOf(v[3]).joined, ingrNorms: ingrOf(v[3]).norms, nCo: norm(v[2]), len: v[0].length
      });
    });

    var seqToCode = {}, codeToSeq = {};
    LEGACY.forEach(function (x) { seqToCode[x[0]] = x[1]; codeToSeq[x[1]] = x[0]; });

    function get(code) {
      var v = table[code];
      if (!v) return null;
      return {
        code: code, name: v[0], spec: v[1], company: v[2], ingr: v[3], ingrName: ingrOf(v[3]).display,
        kind: v[4] === 2 ? 'outside' : 'listed', category: CATEGORY[v[4]], route: v[5] || null,
        display: v[0] + (v[1] ? ' ' + v[1] : '')
      };
    }

    function search(query, opts) {
      opts = opts || {};
      var q = norm(query);
      if (!q) return [];
      var limit = opts.limit || 30;
      var hits = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i], s = null;               // null = 일치 없음
        if (r.nName.indexOf(q) === 0) s = 0;
        else if (r.nName.indexOf(q) > 0) s = 1;
        else if (r.ingrNorms.length === 1 && r.ingrNorms[0] === q) s = 2;   // 성분이 정확히 같은 단일 성분 제품
        else if (r.ingrNorms.indexOf(q) >= 0) s = 3;                         // 그 성분이 들어 있는 복합제
        else if (r.nIngr.indexOf(q) >= 0) s = 4;
        else if (r.nCo.indexOf(q) >= 0) s = 5;
        if (s === null) continue;
        if (opts.includeOutside === false && r.kind === 2) continue;
        hits.push({ r: r, s: s });
      }
      hits.sort(function (x, y) {
        return (x.s - y.s) || ((x.r.kind === 2) - (y.r.kind === 2)) || (x.r.len - y.r.len) || (x.r.code < y.r.code ? -1 : 1);
      });
      return hits.slice(0, limit).map(function (h) { return get(h.r.code); });
    }

    function evidenceByIngr(a, b) {
      if (!a || !b) return [];
      var k = a < b ? a + '|' + b : b + '|' + a;
      return (pairIdx[k] || []).map(function (e) {
        return { reason: e.reason, note: e.note, date: e.date };
      });
    }

    /* 제품코드 두 개 → 병용금기 근거 목록 (없으면 빈 배열) */
    function evidence(codeA, codeB) {
      var a = get(codeA), b = get(codeB);
      if (!a || !b) return [];
      return evidenceByIngr(a.ingr, b.ingr).map(function (e) {
        e.ingrA = a.ingrName; e.ingrB = b.ingrName; return e;
      });
    }

    /* 새 제품 하나를 이미 등록한 제품들과 견주어, 근거가 있는 것만 돌려줍니다 */
    function checkAgainst(code, otherCodes) {
      var out = [];
      (otherCodes || []).forEach(function (o) {
        if (o === code) return;
        var ev = evidence(code, o);
        if (ev.length) out.push({ withCode: o, items: ev });
      });
      return out;
    }

    /* 병용금기 목록에 이 제품의 성분이 한 번이라도 나오는가 (없으면 "병용금기 없음"으로 확인 가능) */
    function hasPairs(code) {
      var p = get(code);
      return !!(p && ingrWithPair[p.ingr]);
    }

    /* 제품 → 등록용 항목. 앱 저장소/엔진이 쓰는 모양입니다(id·times는 앱이 붙입니다). */
    function toItem(code, extra) {
      var p = get(code);
      if (!p) return null;
      var paren = /\(([^()]*)\)/.exec(p.name);
      var ko = paren && !/[\/+,]/.test(paren[1]) ? paren[1] : null;
      var item = {
        kind: 'drug', source: 'dur', productCode: p.code,
        name: p.name.split('(')[0] || p.name, display: p.display, nameFull: p.name,
        company: p.company, category: p.category, ingrCode: p.ingr,
        ingredientEn: p.ingrName, ingredientKo: ko, type: null
      };
      if (extra) Object.keys(extra).forEach(function (k) { item[k] = extra[k]; });
      return item;
    }

    function baseDate() {
      var m = /_(\d{4})(\d{2})(\d{2})/.exec((P.meta && P.meta.file) || '');
      return m ? m[1] + '-' + m[2] + '-' + m[3] : (P.meta && P.meta.generatedAt) || null;
    }

    /* 약 목록 적용일: 시트 이름(없으면 파일 이름)에 적힌 날짜를 읽는다 */
    function listDate() {
      var m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(prodMeta.sheet || prodMeta.file || '');
      return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : null;
    }

    function source(kind) {
      if (kind === 'list' || kind === 'product') {
        return { label: '약제급여목록 및 급여상한금액표 (공개용)', url: null, checkedAt: listDate() };
      }
      return { label: '병용금기약물 · 한국의약품안전관리원 (공공데이터포털)', url: PAIR_URL, checkedAt: baseDate() };
    }

    return {
      get: get, search: search, evidence: evidence, evidenceByIngr: evidenceByIngr,
      checkAgainst: checkAgainst, hasPairs: hasPairs, toItem: toItem,
      statusOf: function (code) { var p = get(code); return p ? p.kind : 'unknown'; },
      seqOf: function (code) { return codeToSeq[code] || null; },
      codeOf: function (seq) { return seqToCode[seq] || null; },
      source: source,
      license: function () { return (P.meta && P.meta.license) || ''; },
      stats: function () {
        return { products: rows.length, pairs: P.pairs.length, ingredientsWithPair: Object.keys(ingrWithPair).length, baseDate: baseDate() };
      }
    };
  }

  function load(baseUrl) {
    var base = (baseUrl || 'data/dur/').replace(/\/?$/, '/');
    function j(name) {
      return fetch(base + name).then(function (r) {
        if (!r.ok) throw new Error(name + ' ' + r.status);
        return r.json();
      });
    }
    return Promise.all([j('dur-pairs.json'), j('products.json')]).then(function (x) {
      return create({ pairs: x[0], products: x[1] });
    });
  }

  return { create: create, load: load, norm: norm, cleanIngr: cleanIngr };
});
