/*
 * 키핑 엔진 — 등록한 약·영양제끼리 "겹치는 것"만 찾습니다.
 * 판정하지 않습니다. 공식 자료에 적힌 근거만 모아서 돌려줍니다.
 *
 * 근거 종류
 *  - pair  (높음) DUR 병용금기 쌍으로 등록된 경우
 *  - name  (높음) 한쪽 설명서에 상대 약의 성분명이 직접 적힌 경우
 *  - class (낮음) 설명서가 약의 종류로 적은 표현에 상대 약이 해당할 수 있는 경우 → 약사 확인 권장
 *  - supp  (낮음) 설명서가 적은 표현이 등록한 영양제 성분과 겹칠 수 있는 경우 → 약사 확인 권장
 *
 * 상태
 *  - attention : 겹치는 근거를 찾음 (확인 필요)
 *  - none      : 확인한 자료 안에서 겹치는 것을 못 찾음 (안전하다는 뜻이 아님)
 *  - scope     : 영양제가 식약처 의약품 병용섭취정보 33종에 해당 (내용은 식약처 화면에서 확인)
 *  - unchecked : 키핑이 확인하는 범위 밖 (확인 못 함)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function norm(s) {
    return String(s == null ? '' : s).replace(/[\s·\-()\[\]]/g, '').toLowerCase();
  }

  function hasJong(word) {
    var w = String(word || '').trim();
    var c = w.charCodeAt(w.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
    return false;
  }
  function josa(word, withJong, without) {
    return word + (hasJong(word) ? withJong : without);
  }

  function toHours(t) {
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
    var p = t.split(':');
    return Number(p[0]) + Number(p[1]) / 60;
  }
  function circGap(a, b) {
    var d = Math.abs(a - b);
    return Math.min(d, 24 - d);
  }
  function minGapHours(timesA, timesB) {
    var best = null;
    (timesA || []).forEach(function (ta) {
      (timesB || []).forEach(function (tb) {
        var a = toHours(ta), b = toHours(tb);
        if (a == null || b == null) return;
        var g = circGap(a, b);
        if (best == null || g < best) best = g;
      });
    });
    return best;
  }

  /* ---------- 사전 / 색인 ---------- */
  function index(pack) {
    if (pack._idx) return pack._idx;
    var idx = { bySeq: {}, aliasToKey: {}, keys: {} };
    pack.drugs.forEach(function (d) { idx.bySeq[d.itemSeq] = d; });
    (pack.supplementKeyList || []).forEach(function (k) {
      idx.keys[k.id] = k;
      idx.aliasToKey[norm(k.ko)] = k.id;
      (k.aliases || []).forEach(function (a) { idx.aliasToKey[norm(a)] = k.id; });
    });
    pack._idx = idx;
    return idx;
  }

  /* 원재료 이름 → 성분 키. 정확히 일치하는 것만 인정합니다(부분 문자열 추측 금지). */
  function mapIngredient(raw, pack) {
    var k = index(pack).aliasToKey[norm(raw)];
    return k || null;
  }

  /* DUR 모듈(js/dur.js)이 연결돼 있으면 pack.dur로 받습니다. 없으면 기존 데이터 팩만 씁니다. */
  function productOf(item, pack) {
    var dur = pack && pack.dur;
    if (!dur || !item || item.kind !== 'drug') return null;
    var code = item.productCode || (item.itemSeq && dur.codeOf(item.itemSeq));
    return code ? dur.get(code) : null;
  }
  function record(item, pack) {
    if (!item || item.kind !== 'drug') return null;
    if (item.itemSeq) {
      var r = index(pack).bySeq[item.itemSeq];
      if (r) return r;
    }
    var dur = pack && pack.dur;
    if (dur && item.productCode) {
      var seq = dur.seqOf(item.productCode);
      if (seq) return index(pack).bySeq[seq] || null;
    }
    return null;
  }
  function labelOf(item, pack) {
    var r = record(item, pack);
    return (r && pack.labels && pack.labels[r.itemSeq]) || null;
  }
  function suppKeys(item) {
    return (item && item.kind === 'supp' && item.ingredientKeys) || [];
  }
  function ingrKo(item, pack) {
    var r = record(item, pack);
    return r ? r.ingredientKo : (item.ingredientKo || null);
  }
  function typeOf(item, pack) {
    var r = record(item, pack);
    return r ? r.type : (item.type || null);
  }
  function nameOf(item, pack) {
    var r = record(item, pack);
    return (r && (r.display || r.name)) || item.name || '이름 없음';
  }

  /* ---------- 근거 수집 ---------- */
  function sourceOf(pack, label) {
    return {
      label: '의약품 설명서 · 식약처 의약품안전나라',
      url: (label && label.url) || pack.sources.nedrug,
      fallbackUrl: pack.sources.nedrug,
      checkedAt: (label && label.checkedAt) || pack.checkedAt
    };
  }

  // owner의 설명서가 other에 대해 말하는 근거
  function labelEvidence(owner, other, pack) {
    var out = [];
    var lab = labelOf(owner, pack);
    if (!lab) return out;
    if (other.kind === 'drug') {
      var k = norm(ingrKo(other, pack));
      if (k && (lab.mentionNames || []).some(function (n) { return norm(n) === k; })) {
        out.push({
          kind: 'name', confidence: 'high', ownerId: owner.id, otherId: other.id,
          sectionTitle: lab.mentionSection, excerpt: lab.mentionExcerpt,
          mentioned: ingrKo(other, pack), source: sourceOf(pack, lab)
        });
      }
      var t = typeOf(other, pack);
      (lab.classRules || []).forEach(function (rule) {
        if (t && rule.drugTypes && rule.drugTypes.indexOf(t) > -1) {
          out.push({
            kind: 'class', confidence: 'low', ownerId: owner.id, otherId: other.id,
            phrase: rule.phrase, sectionTitle: rule.sectionTitle, excerpt: rule.excerpt,
            source: sourceOf(pack, lab)
          });
        }
      });
    } else if (other.kind === 'supp') {
      var keys = suppKeys(other);
      (lab.classRules || []).forEach(function (rule) {
        if (rule.suppKeys && rule.suppKeys.some(function (s) { return keys.indexOf(s) > -1; })) {
          out.push({
            kind: 'supp', confidence: 'low', ownerId: owner.id, otherId: other.id,
            phrase: rule.phrase, sectionTitle: rule.sectionTitle, excerpt: rule.excerpt,
            source: sourceOf(pack, lab)
          });
        }
      });
    }
    return out;
  }

  function pairEvidence(a, b, pack) {
    if (a.kind !== 'drug' || b.kind !== 'drug') return [];
    var pa = productOf(a, pack), pb = productOf(b, pack);
    if (pa && pb) {          // 병용금기 파일(성분 기준)로 확인
      return pack.dur.evidence(pa.code, pb.code).map(function (e) {
        return {
          kind: 'pair', confidence: 'high', ownerId: a.id, otherId: b.id,
          reason: e.reason, note: e.note, notified: e.date,
          source: pack.dur.source('pair')
        };
      });
    }
    var ra = record(a, pack), rb = record(b, pack);
    if (!ra || !rb || !ra.ingrCode || !rb.ingrCode) return [];
    return (pack.pairs || []).filter(function (p) {
      return (p.a === ra.ingrCode && p.b === rb.ingrCode) || (p.a === rb.ingrCode && p.b === ra.ingrCode);
    }).map(function (p) {
      return {
        kind: 'pair', confidence: 'high', ownerId: a.id, otherId: b.id,
        reason: p.reason, notified: p.notified,
        source: { label: '식약처 DUR 병용금기', url: pack.sources.dur, checkedAt: p.checkedAt }
      };
    });
  }

  function describe(f, subject, other, byId, pack) {
    var s = nameOf(subject, pack), o = nameOf(other, pack);
    var owner = byId[f.ownerId];
    var ownerName = owner ? nameOf(owner, pack) : '';
    if (f.kind === 'pair') {
      f.title = josa(o, '과', '와') + ' 병용금기로 등록돼 있어요';
      f.summary = '사유: ' + f.reason + (f.notified ? ' · 고시 ' + f.notified : '') + (f.note ? ' · 조건: ' + f.note : '');
    } else if (f.kind === 'name') {
      f.title = ownerName + ' 설명서에 ' + josa(f.mentioned, '이', '가') + ' 함께 쓸 때 주의할 약으로 나와 있어요';
      f.summary = (owner && owner.id === subject.id ? o : s) + '의 성분이에요.';
    } else if (f.kind === 'class' || f.kind === 'supp') {
      f.title = ownerName + ' 설명서가 "' + f.phrase + '"에 복용 간격을 안내해요';
      var who = (owner && owner.id === subject.id) ? o : s;
      f.summary = josa(who, '이', '가') + ' 여기에 해당하는지는 약사에게 확인해 주세요.';
    }
    f.withId = other.id;
    f.withName = o;
    return f;
  }

  function findingsFor(item, items, pack) {
    var byId = {};
    items.forEach(function (i) { byId[i.id] = i; });
    var out = [];
    items.forEach(function (other) {
      if (other.id === item.id) return;
      var raw = [].concat(
        pairEvidence(item, other, pack),
        labelEvidence(item, other, pack),
        labelEvidence(other, item, pack)
      );
      raw.forEach(function (f) { out.push(describe(f, item, other, byId, pack)); });
    });
    out.sort(function (a, b) { return (a.confidence === b.confidence) ? 0 : (a.confidence === 'high' ? -1 : 1); });
    return out;
  }

  /* ---------- 범위 / 상태 ---------- */
  function coverageOf(item, pack) {
    if (item.kind === 'drug') {
      var r = record(item, pack);
      var p = productOf(item, pack);
      if (!r && !p) return { inPack: false };
      return {
        inPack: true,
        dur: r ? !!r.dur : true,          // 제품 목록에 있으면 병용금기 파일로 확인한 것
        label: !!(r && pack.labels && pack.labels[r.itemSeq]),
        partial: r ? !!r.partial : false,
        product: p ? { code: p.code, category: p.category, ingrName: p.ingrName } : null
      };
    }
    var idx = index(pack);
    var keys = suppKeys(item);
    var scopeNames = keys.map(function (k) { return idx.keys[k]; })
      .filter(function (k) { return k && k.scope; })
      .map(function (k) { return k.ko; });
    return { inPack: keys.length > 0, scope: scopeNames.length > 0, scopeNames: scopeNames };
  }

  function analyzeItem(item, items, pack) {
    var findings = findingsFor(item, items, pack);
    var cov = coverageOf(item, pack);
    var status;
    if (findings.length) status = 'attention';
    else if (item.kind === 'drug') status = cov.inPack ? 'none' : 'unchecked';
    else status = cov.scope ? 'scope' : 'unchecked';
    return { item: item, findings: findings, coverage: cov, status: status };
  }

  function analyze(items, pack) {
    return items.map(function (it) { return analyzeItem(it, items, pack); });
  }

  /* ---------- 복용 간격 (설명서에 간격이 적힌 경우만) ---------- */
  function intervalChecks(items, pack) {
    var out = [];
    items.forEach(function (owner) {
      var lab = labelOf(owner, pack);
      if (!lab || !lab.interval) return;
      items.forEach(function (other) {
        if (other.id === owner.id) return;
        var ev = labelEvidence(owner, other, pack).filter(function (f) { return f.kind === 'class' || f.kind === 'supp'; });
        if (!ev.length) return;
        var gap = minGapHours(owner.times, other.times);
        if (gap == null) return;
        out.push({
          ownerId: owner.id, otherId: other.id,
          gapHours: gap, minH: lab.interval.minH, maxH: lab.interval.maxH,
          close: gap < lab.interval.minH,
          excerpt: lab.interval.excerpt, section: lab.interval.section,
          source: sourceOf(pack, lab)
        });
      });
    });
    return out;
  }

  /* ---------- 약사에게 물어볼 질문 (규칙 기반, 판단 없음) ---------- */
  function questionsFor(analysis, items, pack) {
    var qs = [];
    var seen = {};
    analysis.findings.forEach(function (f) {
      var a = nameOf(analysis.item, pack), b = f.withName;
      var q;
      if (f.kind === 'pair' || f.kind === 'name') q = josa(a, '과', '와') + ' ' + b + ', 같이 먹어도 되나요?';
      else q = josa(a, '과', '와') + ' ' + b + ', 복용 간격을 어떻게 두면 되나요?';
      var key = [a, b].sort().join('|') + '|' + (f.kind === 'pair' || f.kind === 'name' ? 'x' : 'i');
      if (!seen[key]) { seen[key] = 1; qs.push(q); }
    });
    return qs;
  }

  return {
    norm: norm, josa: josa, toHours: toHours, minGapHours: minGapHours,
    mapIngredient: mapIngredient, nameOf: nameOf, record: record,
    findingsFor: findingsFor, coverageOf: coverageOf,
    analyzeItem: analyzeItem, analyze: analyze,
    intervalChecks: intervalChecks, questionsFor: questionsFor
  };
});
