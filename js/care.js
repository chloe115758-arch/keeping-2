/*
 * 키핑 케어 엔진 — 허가사항에서 뽑은 규칙(data/care/care-pack.json)과 등록한 약·영양제로 "내 하루 복약 타임라인"을 계산한다.
 *
 * 원칙 (docs/plan-v2.md)
 *  - 근거 등급제: ① 공식 지정(DUR) ② 허가사항 근거. 근거가 없으면 말하지 않는다.
 *  - 문장을 만들지 않는다. 화면의 근거 문장은 허가사항 원문(excerpt)이다. 이 엔진이 만드는 짧은 문구는
 *    "누구와, 몇 시간 간격 안내"처럼 규칙이 가진 사실만 옮긴다.
 *  - severity는 'caution' 하나뿐이다(위험·안전 신호등 없음). "안전/괜찮/문제없" 같은 말을 만들지 않는다.
 *  - 복용 중단·용량 변경 지시를 만들지 않는다.
 *
 * 쓰는 법: var care = KeepingCare.create({ pack: carePackJson, dur: durInstance, groups: groupsJson });
 *          var model = care.analyze(items, { meals: {...}, states: ['pregnant'] });
 * 출력 형식: docs/plan-v2.md 5-3장.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingCare = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SOURCE_LABEL = '의약품 허가사항 (식품의약품안전처)';
  var BANDS = [
    { id: 'morning', label: '아침약', from: 240, to: 660 },
    { id: 'lunch', label: '점심약', from: 660, to: 900 },
    { id: 'dinner', label: '저녁약', from: 900, to: 1260 },
    { id: 'bedtime', label: '자기 전', from: 1260, to: 1680 }   // 21:00 ~ 다음 날 04:00
  ];
  // 약효 분류(ATC) 앞부분으로 분류 표현("제산제", "PPI")에 속하는지 본다. 분류 표현은 이 표에 적힌 것과만 연결한다.
  var ATC_GROUPS = { ppi: ['A02BC'], antacid: ['A02A'], aluminumAntacid: ['A02AB', 'A02AD'], cholestyramine: ['C10AC01'] };

  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function toHHMM(min) {
    var m = ((min % 1440) + 1440) % 1440;
    return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
  }
  function circGap(a, b) { var d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); }
  function bandOf(min) {
    var m = min < 240 ? min + 1440 : min;
    for (var i = 0; i < BANDS.length; i++) if (m >= BANDS[i].from && m < BANDS[i].to) return BANDS[i];
    return BANDS[3];
  }
  function ivText(iv) {
    var h = iv.maxHours ? iv.minHours + '~' + iv.maxHours : String(iv.minHours);
    return (iv.qualifier === '최소' ? '최소 ' : '') + h + '시간 간격';
  }
  function minGap(aTimes, bTimes) {
    var best = null, pair = null;
    (aTimes || []).forEach(function (a) { (bTimes || []).forEach(function (b) {
      var ma = toMin(a), mb = toMin(b); if (ma == null || mb == null) return;
      var g = circGap(ma, mb); if (best == null || g < best) { best = g; pair = [ma, mb]; }
    }); });
    return best == null ? null : { minutes: best, a: pair[0], b: pair[1] };
  }

  function create(opts) {
    var pack = (opts.pack && opts.pack.entries) ? opts.pack : { entries: {} };
    var dur = opts.dur;
    var groups = (opts.groups && opts.groups.groups) || {};

    function productOf(item) {
      if (!dur || !item || item.kind !== 'drug') return null;
      var code = item.productCode || (item.itemSeq && dur.codeOf && dur.codeOf(item.itemSeq));
      return code ? dur.get(code) : null;
    }
    function entryOf(item) {
      var p = productOf(item);
      return p ? (pack.entries[String(p.ingrName || '').toLowerCase()] || null) : null;
    }
    function inGroup(item, key) {
      var e = entryOf(item), p = productOf(item);
      var atc = (e && e.atc) || '';
      if ((ATC_GROUPS[key] || []).some(function (pre) { return atc.indexOf(pre) === 0; })) return true;
      var g = groups[key]; var name = p ? String(p.ingrName || '').toLowerCase() : '';
      return !!(g && name && (g.ingredientPrefixes || []).some(function (pre) { return name.indexOf(pre) === 0; }));
    }
    function nameOf(item) { return item.display || item.name || '이름 없는 약'; }

    function analyze(items, ctx) {
      ctx = ctx || {};
      var states = ctx.states || [];
      var drugs = items.filter(function (i) { return i.kind === 'drug'; });
      var supps = items.filter(function (i) { return i.kind === 'supp'; });
      var perItem = {}, evidence = {}, suggestions = [], uncovered = [], okList = [];
      items.forEach(function (i) { perItem[i.id] = { flags: [], meal: null }; });

      function addFlag(ownerId, flag, ev) {
        var list = perItem[ownerId].flags;
        if (list.some(function (f) { return f.id === flag.id; })) return;
        list.push(flag); evidence[flag.id] = ev;
      }

      /* ① 공식 지정: 병용금기(DUR) */
      if (dur) {
        for (var i = 0; i < drugs.length; i++) for (var j = i + 1; j < drugs.length; j++) {
          var pa = productOf(drugs[i]), pb = productOf(drugs[j]);
          if (!pa || !pb) continue;
          dur.evidence(pa.code, pb.code).forEach(function (e, k) {
            var id = 'dur-' + pa.code + '-' + pb.code + '-' + k;
            var src = dur.source('pair');
            [[drugs[i], drugs[j]], [drugs[j], drugs[i]]].forEach(function (ab) {
              addFlag(ab[0].id, { id: id, grade: 'official', severity: 'caution', kind: 'pair',
                short: nameOf(ab[1]) + '와 같이 복용하지 않도록 지정된 조합', withItemIds: [ab[1].id] },
                { grade: 'official', headline: '병용금기로 지정된 조합', detail: e.note || '', excerpt: e.reason,
                  where: '병용금기 · 고시 ' + e.date, source: { label: src.label, url: src.url, checkedAt: src.checkedAt } });
            });
          });
        }
      }

      /* ② 허가사항 근거: 약마다 추출된 규칙을 본다 */
      drugs.forEach(function (owner) {
        var e = entryOf(owner);
        if (!e) { uncovered.push({ itemId: owner.id, reason: 'care_missing' }); return; }
        if (!(e.rules || []).length) uncovered.push({ itemId: owner.id, reason: 'no_rules' });
        var src = { label: SOURCE_LABEL, url: (e.docUrls && e.docUrls.nb) || null, checkedAt: e.fetchedAt || null };
        var stateRules = { pregnant: [], elderly: [] };

        (e.rules || []).forEach(function (r) {
          if (r.kind === 'timing') {
            if (!perItem[owner.id].meal) perItem[owner.id].meal = { label: r.meal, grade: 'label', ruleId: r.id };
            evidence[r.id] = { grade: 'label', headline: '복용 시점 안내', detail: '', excerpt: r.excerpt, where: r.where, source: src };
            return;
          }
          if (r.kind === 'state_pregnancy') { stateRules.pregnant.push(r); return; }
          if (r.kind === 'state_elderly') { stateRules.elderly.push(r); return; }

          // interaction / note: 걸린 키마다 상대를 찾는다
          var withIds = [], foodKos = [], wholeOk = true, gapInfo = null;
          (r.matched || []).forEach(function (m) {
            if (m.kind === 'food') { foodKos.push(m.ko); return; }
            var others = m.kind === 'supplement'
              ? supps.filter(function (s) { return (s.ingredientKeys || []).indexOf(m.key) >= 0; })
              : drugs.filter(function (d) { return d.id !== owner.id && inGroup(d, m.key); });
            others.forEach(function (o) {
              if (withIds.indexOf(o.id) < 0) withIds.push(o.id);
              if (r.interval && r.interval.minHours) {
                var g = minGap(owner.times, o.times);
                if (g) {
                  if (g.minutes < r.interval.minHours * 60) {
                    gapInfo = gapInfo && gapInfo.minutes <= g.minutes ? gapInfo : { minutes: g.minutes, ownerMin: g.a, otherMin: g.b, other: o };
                  } else { okList.push({ ruleId: r.id, itemIds: [owner.id, o.id], gapHours: Math.round(g.minutes / 6) / 10 }); wholeOk = true; }
                }
              }
            });
          });

          var hasPair = withIds.length > 0, hasFood = foodKos.length > 0;
          if (!hasPair && !hasFood) return;
          var intervalOk = r.interval && r.interval.minHours && hasPair && !gapInfo &&
            withIds.every(function (id) { var o = items.filter(function (x) { return x.id === id; })[0]; return minGap(owner.times, o.times); });
          if (hasPair && intervalOk && !hasFood) return;   // 안내된 간격 이상으로 떨어져 있으면 경고하지 않는다

          var who = withIds.map(function (id) { return nameOf(items.filter(function (x) { return x.id === id; })[0]); });
          var short;
          if (hasPair && r.interval) short = who.slice(0, 2).join('·') + '와 ' + ivText(r.interval) + ' 안내';
          else if (hasPair) short = who.slice(0, 2).join('·') + ': 병용 주의 안내';
          else short = foodKos.join('·') + ': 주의 안내';
          if (gapInfo) short += ' · 지금 ' + (Math.round(gapInfo.minutes / 6) / 10) + '시간';
          addFlag(owner.id, { id: r.id, grade: 'label', severity: 'caution', kind: hasPair ? 'interaction' : 'food',
            short: short, withItemIds: withIds },
            { grade: 'label', headline: short, detail: r.subject || '', excerpt: r.excerpt, where: r.where, source: src });

          if (gapInfo && r.interval && r.interval.minHours) {   // 시간 제안: 상대(영양제·다른 약)를 안내된 간격 뒤로
            var want = gapInfo.ownerMin + Math.ceil(r.interval.minHours * 2) * 30;
            if (want < 1440) suggestions.push({ ruleId: r.id, itemId: gapInfo.other.id, suggestTime: toHHMM(want), grade: 'label',
              message: nameOf(gapInfo.other) + ' 시간을 ' + toHHMM(want) + ' 이후로 옮기면 안내된 간격(' + ivText(r.interval) + ') 이상이에요' });
          }
        });

        // 임신·고령자 상태는 사용자가 골랐을 때만
        [['pregnant', '임신 중 복용에 관한 안내가 있어요'], ['elderly', '고령자 복용에 관한 안내가 있어요']].forEach(function (st) {
          if (states.indexOf(st[0]) < 0 || !stateRules[st[0]].length) return;
          var first = stateRules[st[0]][0];
          addFlag(owner.id, { id: 'state-' + st[0] + '-' + (owner.id), grade: 'label', severity: 'caution', kind: 'state', short: st[1], withItemIds: [] },
            { grade: 'label', headline: st[1], detail: first.subject || '', excerpt: stateRules[st[0]].map(function (x) { return x.excerpt; }).join(' '),
              where: first.where, source: src });
        });
      });

      /* 시간표: 시간대(아침약·점심약·저녁약·자기 전)로 묶는다 */
      var slotMap = {}, unscheduled = [];
      items.forEach(function (it) {
        var ts = (it.times || []).filter(function (t) { return toMin(t) != null; });
        if (!ts.length) { unscheduled.push(it.id); return; }
        ts.forEach(function (t) {
          var b = bandOf(toMin(t));
          var s = slotMap[b.id] = slotMap[b.id] || { id: b.id, label: b.label, time: t, items: [] };
          if (toMin(t) < toMin(s.time) && b.id !== 'bedtime') s.time = t;
          s.items.push({ itemId: it.id, kind: it.kind, name: it.name, display: nameOf(it), time: t,
            mealRelation: perItem[it.id].meal, flags: perItem[it.id].flags });
        });
      });
      var slots = BANDS.map(function (b) { return slotMap[b.id]; }).filter(Boolean);
      slots.forEach(function (s) {
        s.items.sort(function (a, b) { return toMin(a.time) - toMin(b.time); });
        var ids = {}; s.items.forEach(function (x) { x.flags.forEach(function (f) { ids[f.id] = 1; }); });
        s.summary = { itemCount: s.items.length, cautionCount: Object.keys(ids).length };
        var meals = ctx.meals || {}; var key = { morning: 'breakfast', lunch: 'lunch', dinner: 'dinner' }[s.id];
        if (key && meals[key]) s.meal = { label: { breakfast: '아침 식사', lunch: '점심 식사', dinner: '저녁 식사' }[key], time: meals[key] };
      });
      var all = {}; Object.keys(perItem).forEach(function (k) { perItem[k].flags.forEach(function (f) { all[f.id] = 1; }); });
      return { summary: { cautionCount: Object.keys(all).length, itemCount: items.length }, slots: slots, suggestions: suggestions,
               evidence: evidence, uncovered: uncovered, unscheduled: unscheduled, ok: okList };
    }

    return { analyze: analyze, entryOf: entryOf, stats: function () { return { entries: Object.keys(pack.entries).length }; } };
  }

  function load(baseUrl, dur) {
    var base = (baseUrl || 'data/care/').replace(/\/?$/, '/');
    function j(name) { return fetch(base + name).then(function (r) { if (!r.ok) throw new Error(name + ' ' + r.status); return r.json(); }); }
    return Promise.all([j('care-pack.json'), j('groups.json')]).then(function (x) { return create({ pack: x[0], groups: x[1], dur: dur }); });
  }

  return { create: create, load: load, toMin: toMin, bandOf: bandOf };
});
