/*
 * 키핑 홈 화면 뷰모델 — 엔진 결과(KeepingCare.analyze)와 오늘의 체크 기록을 "화면이 그대로 그리면 되는 모양"으로 바꾼다.
 * 화면 코드는 이 결과만 그리면 되고, 묶음·문장·진행률 계산은 여기서 끝난다.
 *
 * 원칙 (docs/plan-v2.md, docs/ux-writing.md)
 *  - 체크 칸 = 묶음. 처방약은 진료과별("내과 처방약"), 약국약은 "약국약" 하나, 영양제는 이름 그대로 한 줄씩.
 *  - 주의 문장은 설명서가 말한 것을 전한다. "권장해요"는 간격 숫자가 있을 때만. 숫자가 없으면 "주의가 필요하다고 안내돼 있어요".
 *  - 시간을 정하지 않은 약은 홈에서 뺀다(엔진이 unscheduled로 따로 준다).
 *  - 건너뜀 상태는 없다. 체크했거나(true) 아니거나.
 *
 * 쓰는 법 (js/josa.js, js/greeting.js를 먼저 불러온다)
 *   var vm = KeepingHome.create({ greeting: KeepingGreeting.create(copyJson), productOf: function (item) { return dur.get(...) } });
 *   var model = vm.build({ nowMin, nickname, items, analysis: care.analyze(items, ctx), checks: { 'morning:rx:내과': true }, meals });
 *   model.header   → KeepingGreeting.state() 결과(line1, line2, card.{count, ratio, status, icon})
 *   model.rows[]   → 시간선 줄(시간대 카드 또는 식사 표시)
 *   model.sheets[flagId] / model.detail[groupId] → 근거 시트 / 약봉투 화면
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./greeting.js'));
  else root.KeepingHome = factory(root.KeepingGreeting);
})(typeof self !== 'undefined' ? self : this, function (Greeting) {
  'use strict';

  var MEAL_DEFAULT = { breakfast: '08:30', lunch: '12:30', dinner: '18:30' };
  var MEAL_LABEL = { breakfast: '아침 식사', lunch: '점심 식사', dinner: '저녁 식사' };
  var KIND_RANK = { rx: 0, otc: 1, other: 2, supp: 3 };
  var CATEGORY_LABEL = { rx: '처방약', otc: '약국약', other: '약', supp: '영양제' };

  function toMin(hhmm) { return Greeting.toMin(hhmm); }
  function dayMin(m) { return m < 240 ? m + 1440 : m; }
  /* '11:00' → '오전 11시', '13:30' → '오후 1시 30분' */
  function korTime(hhmm) {
    var m = toMin(hhmm); if (m == null) return '';
    var h = Math.floor(m / 60) % 24, mi = m % 60, ap = h < 12 ? '오전' : '오후', h12 = h % 12 === 0 ? 12 : h % 12;
    return ap + ' ' + h12 + '시' + (mi ? ' ' + mi + '분' : '');
  }
  function ivText(iv) {
    var h = iv.maxHours ? iv.minHours + '~' + iv.maxHours : String(iv.minHours);
    return (iv.qualifier === '최소' ? '최소 ' : '') + h + '시간 간격';
  }
  function uniq(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }

  function create(opts) {
    var g = opts.greeting, say = g.say;
    var productOf = opts.productOf || function () { return null; };

    function categoryOf(item) {
      if (item.kind === 'supp') return 'supp';
      var p = productOf(item), c = p && p.category;
      return c === '전문의약품' ? 'rx' : c === '일반의약품' ? 'otc' : 'other';
    }
    function nameOf(item) { return item.display || item.name || '이름 없는 약'; }
    function groupOf(item) {
      var cat = categoryOf(item);
      if (cat === 'supp') return { key: 'supp:' + item.id, kind: 'supp', icon: 'leaf', title: nameOf(item) };
      if (cat === 'rx') {
        var dept = (item.dept || '').trim();
        return { key: 'rx:' + dept, kind: 'rx', icon: 'pill', title: dept ? say('group_rx_dept', { dept: dept }) : say('group_rx') };
      }
      if (cat === 'otc') return { key: 'otc', kind: 'otc', icon: 'pill', title: say('group_otc') };
      return { key: 'other', kind: 'other', icon: 'pill', title: say('group_other') };
    }

    function build(input) {
      input = input || {};
      var items = input.items || [], byId = {};
      items.forEach(function (it) { byId[it.id] = it; });
      var A = input.analysis || { slots: [], suggestions: [], evidence: {}, unscheduled: [] };
      var checks = input.checks || {};
      var mealTimes = input.meals || {};

      function labelOf(id) { var it = byId[id]; return it ? groupOf(it).title : '약'; }
      function displayOf(id) { var it = byId[id]; return it ? nameOf(it) : '약'; }

      var sheets = {}, detail = {}, flagLines = {};   // flagLines: itemId → [line]
      var slotModels = [];

      /* ---- 주의 문장 한 줄 만들기 ---- */
      function lineOf(flag, ownerId) {
        var withIds = flag.withItemIds || [];
        var ownerLabel = labelOf(ownerId), withLabels = uniq(withIds.map(labelOf));
        var sameGroup = withLabels.length === 1 && withLabels[0] === ownerLabel;   // 같은 묶음끼리면 약 이름으로 말한다
        var subject = (sameGroup ? uniq(withIds.map(displayOf)) : withLabels).slice(0, 2).join('·');
        var object = sameGroup ? displayOf(ownerId) : ownerLabel;
        var text;
        if (flag.kind === 'pair') text = say('notice_official', { subject: subject, object: object });
        else if (flag.kind === 'interaction') text = flag.interval
          ? say('notice_interval', { subject: subject, object: object, interval: ivText(flag.interval) })
          : say('notice_caution', { subject: subject, object: object });
        else if (flag.kind === 'state') text = say('notice_state', { object: ownerLabel, text: flag.short });
        else return null;
        return { flagId: flag.id, text: text, grade: flag.grade, official: flag.grade === 'official' };
      }

      /* ---- 시간대 카드 ---- */
      A.slots.forEach(function (slot) {
        var gmap = {}, order = [];
        slot.items.forEach(function (x) {
          var it = byId[x.itemId]; if (!it) return;
          var gr = groupOf(it), id = slot.id + ':' + gr.key;
          var G = gmap[id];
          if (!G) { G = gmap[id] = { id: id, key: gr.key, kind: gr.kind, icon: gr.icon, title: gr.title, itemIds: [], items: [], time: x.time, hint: null, checked: !!checks[id] }; order.push(id); }
          if (G.itemIds.indexOf(x.itemId) < 0) { G.itemIds.push(x.itemId); G.items.push({ itemId: x.itemId, name: it.name, display: nameOf(it), time: x.time }); }
          if (toMin(x.time) < toMin(G.time)) G.time = x.time;
        });
        var groups = order.map(function (id) { return gmap[id]; });
        groups.sort(function (a, b) { return (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0); });
        groups.forEach(function (G) {
          G.count = G.itemIds.length;
          var latest = null;
          (A.suggestions || []).forEach(function (s) { if (G.itemIds.indexOf(s.itemId) >= 0 && (!latest || toMin(s.suggestTime) > toMin(latest))) latest = s.suggestTime; });
          if (latest) G.hint = say('hint_after', { time: korTime(latest), verb: G.kind === 'supp' ? '섭취' : '복용' });
        });

        // 주의 블록: 이 시간대 약들의 주의(음식 제외), 공식 지정 먼저
        var seen = {}, lines = [];
        slot.items.forEach(function (x) {
          (x.flags || []).forEach(function (f) {
            if (f.kind === 'food' || seen[f.id]) return;
            var ln = lineOf(f, f.ownerId || x.itemId); if (!ln) return;
            if (lines.some(function (l) { return l.text === ln.text; })) return;
            seen[f.id] = 1; lines.push(ln);
          });
        });
        lines.sort(function (a, b) { return (b.official ? 1 : 0) - (a.official ? 1 : 0); });
        var more = Math.max(0, lines.length - 2);
        var notice = lines.length ? { title: say('notice_title'), lines: lines.slice(0, 2), more: more, moreText: more ? say('notice_more', { more: more }) : '', all: lines } : null;

        var taken = groups.filter(function (G) { return G.checked; }).length;
        var cautionCount = (slot.summary && slot.summary.cautionCount) || 0;
        slotModels.push({
          type: 'slot', id: slot.id, label: slot.label, time: slot.time, groups: groups, notice: notice,
          total: groups.length, taken: taken, complete: groups.length > 0 && taken === groups.length,
          summary: { itemCount: slot.summary ? slot.summary.itemCount : slot.items.length, cautionCount: cautionCount,
                     text: say('slot_summary', { n: slot.summary ? slot.summary.itemCount : slot.items.length }) + (cautionCount ? ' · ' + say('slot_caution', { c: cautionCount }) : '') }
        });
      });

      /* ---- 근거 시트 / 약봉투 화면 재료 ---- */
      var foodMap = {}, foodOrder = [];
      A.slots.forEach(function (slot) {
        slot.items.forEach(function (x) {
          (x.foods || []).forEach(function (f) {
            var F = foodMap[f.ko] = foodMap[f.ko] || (foodOrder.push(f.ko), { ko: f.ko, flagIds: [], itemIds: [] });
            if (F.flagIds.indexOf(f.flagId) < 0) F.flagIds.push(f.flagId);
            if (F.itemIds.indexOf(x.itemId) < 0) F.itemIds.push(x.itemId);
          });
        });
      });
      A.slots.forEach(function (slot) {
        slot.items.forEach(function (x) {
          (x.flags || []).forEach(function (f) {
            if (f.kind === 'food' || sheets[f.id]) return;
            var ev = (A.evidence || {})[f.id]; if (!ev) return;
            var ownerId = f.ownerId || x.itemId, withIds = f.withItemIds || [];
            var related = [{ label: labelOf(ownerId), names: [displayOf(ownerId)] }];
            uniq(withIds.map(labelOf)).forEach(function (lb) {
              related.push({ label: lb, names: withIds.filter(function (id) { return labelOf(id) === lb; }).map(displayOf) });
            });
            var sug = (A.suggestions || []).filter(function (s) { return s.ruleId === f.id; })[0];
            sheets[f.id] = {
              flagId: f.id, grade: f.grade, intro: say(f.grade === 'official' ? 'sheet_intro_official' : 'sheet_intro'),
              headline: ev.headline, excerpt: ev.excerpt, where: ev.where, source: ev.source,
              relatedTitle: say('sheet_related'), related: related,
              hintLine: sug ? say('sheet_hint', { name: displayOf(sug.itemId), time: korTime(sug.suggestTime) }) : ''
            };
          });
        });
      });
      slotModels.forEach(function (S) {
        S.groups.forEach(function (G) {
          var itemsDetail = G.items.map(function (gi) {
            var it = byId[gi.itemId], p = productOf(it) || {};
            var notices = [];
            A.slots.forEach(function (slot) { slot.items.forEach(function (x) {
              (x.flags || []).forEach(function (f) {
                if (f.kind === 'food') return;
                var owner = f.ownerId || x.itemId;
                if (owner !== gi.itemId && (f.withItemIds || []).indexOf(gi.itemId) < 0) return;
                var ln = lineOf(f, owner);
                if (ln && !notices.some(function (n) { return n.text === ln.text; })) notices.push(ln);
              });
            }); });
            return { itemId: gi.itemId, name: it.name, display: gi.display, spec: p.spec || '', company: p.company || '', ingredient: p.ingrName || '',
                     category: CATEGORY_LABEL[categoryOf(it)], times: (it.times || []).slice(), notices: notices };
          });
          var foods = uniq(foodOrder.filter(function (ko) { return foodMap[ko].itemIds.some(function (id) { return G.itemIds.indexOf(id) >= 0; }); }));
          detail[G.id] = { groupId: G.id, title: G.title, kind: G.kind, items: itemsDetail, foodsTitle: say('foods_title'), foods: foods,
                           scope: say('detail_scope'), footer: say('detail_footer') };
        });
      });

      /* ---- 시간선 줄: 시간대 카드 + 식사 표시 ---- */
      var firstIncomplete = -1;
      slotModels.forEach(function (S, i) { if (firstIncomplete < 0 && !S.complete) firstIncomplete = i; });
      slotModels.forEach(function (S, i) { S.nodeState = S.complete ? 'done' : (i === firstIncomplete ? 'now' : 'up'); S.defaultOpen = S.nodeState === 'now'; });
      var rows = slotModels.slice();
      ['breakfast', 'lunch', 'dinner'].forEach(function (k) {
        rows.push({ type: 'meal', id: 'meal:' + k, label: MEAL_LABEL[k], time: mealTimes[k] || MEAL_DEFAULT[k] });
      });
      rows.sort(function (a, b) { return (dayMin(toMin(a.time)) - dayMin(toMin(b.time))) || ((a.type === 'meal' ? 0 : 1) - (b.type === 'meal' ? 0 : 1)); });
      var firstRow = firstIncomplete < 0 ? rows.length : rows.indexOf(slotModels[firstIncomplete]);
      rows.forEach(function (r, i) { r.lineDone = i < firstRow; r.last = i === rows.length - 1; });

      var header = g.state({ nowMin: input.nowMin, now: input.now, nickname: input.nickname, hasUntimed: (A.unscheduled || []).length > 0 || !!input.hasUntimed,
        slots: slotModels.map(function (S) { return { id: S.id, time: S.time, total: S.total, taken: S.taken }; }) });
      var foodsAll = foodOrder.map(function (ko) { return { ko: ko, groupTitles: uniq(foodMap[ko].itemIds.map(labelOf)) }; });

      return { header: header, rows: rows, foods: { title: say('foods_title'), items: foodsAll }, sheets: sheets, detail: detail,
               totals: { groups: header.card.total, taken: header.card.taken } };
    }
    return { build: build, categoryOf: categoryOf, groupOf: groupOf, korTime: korTime };
  }

  return { create: create, korTime: korTime };
});
