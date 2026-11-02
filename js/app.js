/*
 * 키핑 앱 — 화면과 흐름
 * 원칙: 판정하지 않는다 · 공통은 숨기고 예외만 보여준다 · 없음은 안전이 아니다 · 등록은 항상 된다
 */
(function () {
  'use strict';

  var Pack = window.KEEPING_DATA, E = window.KeepingEngine, Store = window.KeepingStore, Api = window.KeepingApi;
  var root = document.getElementById('app');
  var state = Store.load();
  var ui = {
    view: 'welcome', params: {}, prev: null,
    q: '', results: null, remote: null, manualOpen: false, manualCompany: '',
    chips: [], manualName: '', searchToken: 0,
    dur: { status: 'loading' },
    care: { status: 'loading', engine: null, notice: true }, open: {},
    noticeOpen: {}, sheet: null, nowMin: null, prevRatio: null, homeSig: '', logo: '', deptEdit: null, homeScroll: 0,
    copy: { status: 'loading' }, draft: null, supp: { products: 'loading', source: '' }
  };
  var searchTimer = null;

  /* ---------- 도구 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 약제급여목록 이용 조건은 아직 확인하지 못했다. 확인하면 이 문구만 바꾸면 된다. */
  var LIST_LICENSE_NOTE = '약제급여목록의 이용 조건은 확인하지 못했어요.';
  var ICONS = {
    chev: '<path d="M6 3l5 5-5 5"/>', back: '<path d="M10 3L5 8l5 5"/>',
    check: '<path d="M3 8.5l3.2 3.2L13 4.5"/>', plus: '<path d="M8 3v10M3 8h10"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>', alert: '<path d="M8 3.5v5.5"/><path d="M8 12.2h.01"/>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
    info: '<circle cx="10" cy="10" r="8"/><path d="M10 9v5"/><path d="M10 6.3h.01"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>',
    list: '<path d="M3 4h10M3 8h10M3 12h10"/>',
    pill: '<path d="M7 13.7a3.3 3.3 0 0 1-4.7-4.7l6.7-6.7a3.3 3.3 0 0 1 4.7 4.7z"/><path d="M5.7 5.7l4.6 4.6"/>',
    home: '<path d="M2.5 7.5L8 2.5l5.5 5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z"/><path d="M6.5 13.5V9.5h3v4"/>',
    user: '<circle cx="8" cy="5.5" r="2.7"/><path d="M2.8 13.5c.6-2.6 2.6-3.8 5.2-3.8s4.6 1.2 5.2 3.8"/>',
    tri: '<path d="M8 2.5l6 10.5H2z"/><path d="M8 6.5v3"/><path d="M8 11.2h.01"/>',
    checkc: '<circle cx="8" cy="8" r="6"/><path d="M5.3 8.2l1.9 1.9 3.5-3.7"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4"/>'
  };
  function icon(n, size) {
    var vb = n === 'info' ? '0 0 20 20' : '0 0 16 16';
    size = size || 16;
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="' + vb + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
  }
  function save() { Store.save(state); }
  function nm(it) { return E.nameOf(it, Pack); }
  function activeTimes(it) { return (it.times || []).filter(Boolean); }
  function findItem(id) { return state.items.filter(function (i) { return i.id === id; })[0] || null; }
  function newItem(p) {
    var t = new Date().toISOString();
    return Object.assign({ id: Store.uid(), times: [], batch: null, addedAt: t, updatedAt: t }, p);
  }
  function fmtGap(h) { return String(Math.round(h * 10) / 10).replace(/\.0$/, ''); }
  function kindLabel(it) {
    if (it.kind === 'supp') return it.company || '직접 입력';
    if (it.productCode) return [it.company, it.category].filter(Boolean).join(' · ') || '업체 정보 없음';
    var r = E.record(it, Pack);
    return r ? [r.category, r.type].filter(Boolean).join(' · ') : '확인 범위 밖';
  }
  function toast(msg) {
    var d = document.createElement('div');
    d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { d.classList.add('out'); }, 1800);
    setTimeout(function () { d.remove(); }, 2300);
  }
  function tip(id, text) {
    return '<span class="tipwrap"><button type="button" class="tipbtn" data-act="tip" data-tip="' + id + '" aria-expanded="false" aria-controls="tip-' + id + '" aria-label="설명 보기">' + icon('info', 20) + '</button><span class="tip" id="tip-' + id + '" role="tooltip" hidden>' + esc(text) + '</span></span>';
  }

  /* ---------- 공통 조각 ---------- */
  function topbar(title) {
    return '<div class="topbar"><button type="button" class="back" data-act="back" aria-label="이전 화면으로">' + icon('back', 20) + '<span>이전</span></button>' + (title ? '<span class="top-title">' + esc(title) + '</span>' : '') + '</div>';
  }
  /* 온보딩 3단계: 시안의 상단(뒤로 + 진행 막대)과 단계 칩 */
  function obHead(n) {
    return '<div class="obhead"><button type="button" class="back" data-act="back" aria-label="이전 화면으로">' + icon('back', 20) + '</button>' +
      '<div class="stepbar" role="img" aria-label="2단계 중 ' + n + '단계"><i style="width:' + Math.round(n * 100 / 2) + '%"></i></div></div>';
  }
  function stepChip(n) { return '<span class="stepchip">' + n + '/2</span>'; }
  function actionBar(inner, cls) { return '<div class="actionbar' + (cls ? ' ' + cls : '') + '">' + inner + '</div>'; }
  function skipBtn(view) {
    return '<button type="button" class="cta outline skipbtn" data-act="skip" data-view="' + view + '"><span>건너뛰기</span><small>언제든 수정할 수 있어요</small></button>';
  }
  function nav(cur) {
    function b(v, label, ic, scope) {
      return '<button type="button" data-act="nav" data-view="' + v + '"' + (scope ? ' data-scope="' + scope + '"' : '') + (cur === v ? ' aria-current="page" class="on"' : '') + '>' + icon(ic, 24) + '<span>' + label + '</span></button>';
    }
    return '<nav class="nav" aria-label="주 메뉴">' + b('home', '홈', 'home') + b('list', '내 약', 'pill') + b('settings', '마이', 'user') + '</nav>';
  }
  /* 제품코드로 등록한 약은 전체 약 목록(DUR)이 와야 확인할 수 있다. 오는 중에는 "확인 범위 밖"이 아니라 "불러오는 중". */
  function durPending(it) { return !!(it && it.kind === 'drug' && it.productCode && !Pack.dur && ui.dur.status === 'loading'); }
  /* ---------- 검색 ---------- */
  function currentKind() { return ui.view === 'onb-supps' ? 'supp' : 'drug'; }
  function batchOf() { return ui.view === 'add' ? (ui.params.batch || null) : null; }
  function isAdded(kind, x) {
    return state.items.some(function (it) {
      if ((it.batch || null) !== batchOf()) return false;
      if (kind === 'drug') return it.kind === 'drug' && ((it.itemSeq && it.itemSeq === x.itemSeq) || (it.productCode && it.productCode === x.code));
      return it.kind === 'supp' && it.reportNo && x.supp && it.reportNo === x.supp.reportNo;
    });
  }
  function resultsHtml(kind) {
    var r = ui.results;
    if (!ui.q.trim() && kind === 'drug') return '';   // 영양제는 검색창이 비어도 자주 찾는 성분을 보여 준다
    if (kind === 'drug' && ui.dur.status === 'loading') return ''; // 안내는 #durstat에 있고, 로딩이 끝나면 자동으로 다시 찾는다
    if (r === null) return '<p class="muted pad">불러오는 중…</p>';
    var html = '';
    if (ui.remote && ui.remote.status === 'error') html += '<p class="note">서버 검색에 연결하지 못했어요. 확인 범위 안의 결과만 보여드려요.</p>';
    if (!r.length) {
      if (kind === 'drug') {
        html += '<div class="empty"><p><b>"' + esc(ui.q) + '"</b> 검색 결과가 없어요.</p><p class="muted">이름 그대로 등록할 수 있어요. 이 경우 겹침 확인은 되지 않고 "확인 못 함"으로 표시돼요.</p><button type="button" class="cta ghost small" data-act="manualDrug">"' + esc(ui.q) + '" 이름으로 등록</button></div>';
      } else {
        html += '<div class="empty"><p><b>"' + esc(ui.q) + '"</b> 검색 결과가 없어요.</p><p class="muted">못 찾은 제품은 직접 입력해 주세요.</p><button type="button" class="cta ghost small" data-act="manualOpen">직접 입력</button></div>';
      }
      return html;
    }
    if (kind === 'drug') html += '<p class="res-hint">함량이 달라도 주의 안내는 같은 성분 기준으로 찾아요</p>';
    html += r.map(function (x, i) {
      var added = isAdded(kind, x);
      return '<button type="button" class="res' + (added ? ' done' : '') + '" data-act="pick" data-i="' + i + '"' + (added ? ' disabled' : '') + '><span class="res-main"><b>' + esc(x.name) + '</b><span class="muted">' + esc(x.sub) + (x.outside ? ' <span class="pill soft">목록 밖</span>' : '') + '</span></span><span class="res-act">' + (added ? '추가됨' : icon('plus') + '추가') + '</span></button>';
    }).join('');
    if (kind === 'drug' && ui.more) html += '<p class="note">결과가 ' + 20 + '개를 넘어요. 더 좁혀 입력해 주세요.</p>';
    if (kind === 'drug') html += '<button type="button" class="row ghostrow" data-act="manualDrug"><span class="row-main"><b>"' + esc(ui.q.trim()) + '" 이름 그대로 등록</b><span class="sub2">목록에 없는 약이에요? 이름만 등록돼요. 겹침 확인은 되지 않고 "확인 못 함"으로 표시돼요.</span></span>' + icon('plus') + '</button>';
    return html;
  }
  function searchBlock(kind) {
    var ph = kind === 'drug' ? '약 이름 (예: 시바스정)' : '제품 이름 (예: 메가도스)';
    return '<div class="search"><label class="sr" for="q">' + (kind === 'drug' ? '약 이름 검색' : '영양제 이름 검색') + '</label><div class="inp">' + icon('search', 20) + '<input id="q" type="search" inputmode="search" autocomplete="off" placeholder="' + ph + '" value="' + esc(ui.q) + '" data-input="search"></div>' + (kind === 'drug' ? '<div id="durstat" aria-live="polite">' + durHtml() + '</div>' : manualBlock()) + '<div id="results" aria-live="polite">' + resultsHtml(kind) + '</div></div>';
  }
  /* ---------- 전체 약 목록(DUR) 불러오기 ----------
     실패해도 기존 데이터 팩 모드로 계속 동작한다. 약 4MB, 처음 한 번만 걸린다. */
  function durHtml() {
    if (ui.dur.status === 'loading') return '<p class="muted">약 목록을 불러오는 중…</p>';
    if (ui.dur.status === 'error') return '<p class="note">전체 약 검색을 쓸 수 없어요. 키핑이 근거를 확인하는 약 안에서만 검색돼요. 목록에 없는 약은 이름 그대로 등록할 수 있어요.</p>';
    return '';
  }
  var bootPromise = Promise.resolve();
  function bootDur() {
    ui.dur = { status: 'loading' };
    var st = document.getElementById('durstat'); if (st) st.innerHTML = durHtml();
    if (!window.KeepingDur || typeof fetch !== 'function') { ui.dur = { status: 'error' }; bootPromise = Promise.resolve(); return bootPromise; }
    bootPromise = window.KeepingDur.load('data/dur/').then(function (dur) {
      Pack.dur = dur; ui.dur = { status: 'ready' };
    }).catch(function () {
      delete Pack.dur; ui.dur = { status: 'error' };
    }).then(function () {
      var el = document.getElementById('durstat'); if (el) el.innerHTML = durHtml();
      if (needsSearch() && currentKind() === 'drug' && ui.q.trim()) runSearch(); // 로딩 중에 입력한 검색을 이어서 실행
      if (['home', 'bag', 'list', 'detail', 'settings'].indexOf(ui.view) > -1) render(false); // 확인 결과가 달라질 수 있는 화면만 다시 그린다
    });
    return bootPromise;
  }

  /* ---------- 설명서 기반 안내 데이터(care-pack) 불러오기 ----------
     약 목록(DUR)이 온 뒤에 읽는다(엔진이 제품 → 성분을 DUR로 찾는다). 실패하면 병용금기만으로 동작한다. */
  function emptyCare() {
    return window.KeepingCare ? window.KeepingCare.create({ pack: { entries: {} }, dur: Pack.dur, groups: {} }) : null;
  }
  /* 설명서 데이터를 못 읽었거나 읽는 중이면 병용금기(DUR)만 보는 엔진. 약 목록이 늦게 와도 그때의 Pack.dur로 다시 만든다. */
  function careEngine() { return ui.care.status === 'ready' && ui.care.engine ? ui.care.engine : emptyCare(); }
  var carePromise = Promise.resolve();
  function mergeExtraKeys(extra) {
    ((extra && extra.keys) || []).forEach(function (k) {
      if (Pack.supplementKeyList.some(function (x) { return x.id === k.id; })) return;
      Pack.supplementKeyList.push({ id: k.id, ko: k.ko, scope: !!k.scope, aliases: (k.aliases || []).slice() });
      if (Pack.chipKeys.indexOf(k.id) < 0) Pack.chipKeys.push(k.id);
    });
  }
  function bootCare() {
    ui.care = { status: 'loading', engine: null, notice: true };
    function fin() {
      if (['home', 'bag', 'list', 'detail', 'settings', 'onb-supps', 'times'].indexOf(ui.view) > -1) render(false);
    }
    function fail() { ui.care = { status: 'error', engine: null, notice: true }; }
    if (typeof fetch !== 'function' || !window.KeepingCare) { fail(); carePromise = Promise.resolve(); return carePromise; }
    var extra = fetch('data/care/supplement-keys-extra.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(mergeExtraKeys).catch(function () {});
    carePromise = Promise.all([bootPromise, extra]).then(function () {
      if (!Pack.dur) throw new Error('dur');
      return window.KeepingCare.load('data/care/', Pack.dur);
    }).then(function (engine) {
      ui.care = { status: 'ready', engine: engine, notice: false, latest: null, count: engine.stats().entries };
      /* 설정 화면에 쓸 설명서 데이터 확인일: care-pack 항목의 fetchedAt 가운데 가장 늦은 날 (같은 파일이라 브라우저 캐시에서 읽는다) */
      return fetch('data/care/care-pack.json').then(function (r) { return r.json(); }).then(function (pk) {
        var latest = null;
        Object.keys((pk && pk.entries) || {}).forEach(function (k) { var d = String(pk.entries[k].fetchedAt || '').slice(0, 10); if (d && (!latest || d > latest)) latest = d; });
        ui.care.latest = latest;
      }).catch(function () {});
    }, fail).then(fin);
    return carePromise;
  }
  function careStatHtml() {
    var c = ui.care;
    if (c.status === 'loading') return '<p class="muted carestat" aria-live="polite">설명서 기반 안내를 준비 중이에요…</p>';
    if (c.status === 'error' && c.notice) return '<div class="note carenote" role="status"><span>설명서 기반 안내를 불러오지 못했어요.' + (Pack.dur ? ' 병용금기만 확인했어요.' : '') + '</span><button type="button" class="mini txt" data-act="closeCareNote">닫기</button></div>';
    return '';
  }
  /* 등록한 약·영양제 → 케어 엔진 입력 (docs/plan-v2.md 5-3b) */
  /* 식사 시간은 기본값으로 고정한다(입력 화면 없음) */
  function mealsOf() { return { breakfast: '08:30', lunch: '12:30', dinner: '18:30' }; }
  function statesOf() { return (state.states || []).filter(function (x) { return x === 'pregnant' || x === 'elderly'; }); }
  function careItems() {
    return state.items.map(function (it) {
      if (it.kind === 'drug') return { id: it.id, kind: 'drug', productCode: it.productCode || undefined, itemSeq: it.itemSeq || undefined, name: it.name, display: nm(it), times: activeTimes(it), dept: it.dept || undefined, dose: it.dose || undefined };
      return { id: it.id, kind: 'supp', ingredientKeys: (it.ingredientKeys || []).slice(), name: it.name, display: nm(it), times: activeTimes(it), dose: it.dose || undefined };
    });
  }
  function careModel() {
    var eng = careEngine();
    return eng ? eng.analyze(careItems(), { meals: mealsOf(), states: statesOf() }) : null;
  }

  function selectedItems(kind) {
    var b = (ui.view === 'add') ? (ui.params.batch || null) : null;
    return state.items.filter(function (it) { return it.kind === kind && (it.batch || null) === b; });
  }
  function ingredientNames(it) {
    return (it.ingredientKeys || []).map(function (k) { var o = Pack.supplementKeyList.filter(function (x) { return x.id === k; })[0]; return o ? o.ko : ''; }).filter(Boolean).join(', ');
  }
  function pcard(it) {
    var sub = it.productCode ? [it.ingredientEn, it.category].filter(Boolean).join(' · ') : kindLabel(it);
    var rows = '';
    if (it.company) rows += '<div><dt>업체</dt><dd>' + esc(it.company) + '</dd></div>';
    if (it.kind === 'supp' && ingredientNames(it)) rows += '<div><dt>성분</dt><dd>' + esc(ingredientNames(it)) + '</dd></div>';
    var t = activeTimes(it);
    rows += '<div><dt>복용 시간</dt><dd>' + (t.length ? esc(t.join(' · ')) : '아직 정하지 않았어요') + '</dd></div>';
    return '<li class="pcard"><div class="pc-head"><div class="pc-title"><b>' + esc(nm(it)) + '</b>' + (sub ? '<span class="pc-sub">' + esc(sub) + '</span>' : '') + '</div>' +
      '<button type="button" class="rm" data-act="remove" data-id="' + it.id + '" aria-label="' + esc(nm(it)) + ' 삭제">' + icon('x') + '</button></div><dl class="kv">' + rows + '</dl></li>';
  }
  function selectedHtml(kind) {
    var list = selectedItems(kind);
    if (!list.length) return '<p class="muted">아직 고른 것이 없어요.</p>';
    return '<ul class="pcards">' + list.map(pcard).join('') + '</ul>';
  }
  function refreshLists() {
    var kind = currentKind();
    var r = document.getElementById('results'); if (r) r.innerHTML = resultsHtml(kind);
    var s = document.getElementById('selected'); if (s) s.innerHTML = selectedHtml(kind);
    var n = document.getElementById('nextbtn');
    if (n && (ui.view === 'add' || ui.view === 'onb-drugs')) n.disabled = selectedItems('drug').length === 0;
    if (n && ui.view === 'onb-supps') n.disabled = selectedItems('supp').length === 0;
    var c = document.getElementById('selcount'); if (c) c.textContent = selectedItems(kind).length;
  }
  function needsSearch() {
    return ui.view === 'onb-drugs' || ui.view === 'add' || ui.view === 'onb-supps';
  }
  function runSearch() {
    if (!needsSearch()) return;
    var kind = currentKind();
    var token = ++ui.searchToken;
    var q = ui.q.trim();
    if (!q && kind === 'drug') { ui.results = []; ui.remote = null; ui.more = false; refreshLists(); return; }
    if (kind === 'drug' && ui.dur.status === 'loading') return;
    (kind === 'drug' ? Api.searchDrugs(q) : Api.searchSupplements(q)).then(function (res) {
      if (token !== ui.searchToken) return;
      ui.results = res.results; ui.remote = res.remote; ui.more = !!res.more;
      refreshLists();
    });
  }

  /* ---------- 화면 ---------- */
  var VIEWS = {};

  VIEWS.splash = function () {
    return '<main class="screen splash" data-act="skipSplash"><p class="splash-tag">내 하루 복약, 근거 있게 챙겨요</p><h1 class="splash-logo" data-focus>키핑</h1><p class="splash-hint">화면을 누르면 바로 시작해요</p></main>';
  };

  VIEWS.welcome = function () {
    return '<main class="screen welcome"><p class="brand">키핑</p><h1 class="h xl" data-focus>내 하루 복약,<br>근거 있게 챙겨요</h1><p class="sub">먹는 약과 영양제를 담으면 아침·점심·저녁 타임라인을 만들어요. 공식 자료에서 근거가 확인된 주의만 보여드리고, 건강정보는 이 기기에만 저장돼요.</p><p class="fine">키핑은 의료 조언이 아니에요. 공식 자료에서 확인한 범위만 보여드리고, 판단은 약사에게 확인해 주세요.</p></main>' +
      actionBar('<button type="button" class="cta" data-act="start">시작하기</button>', 'col');
  };

  /* 약관 동의 자리: 시안의 약관 문구는 가져오지 않고, 이 서비스의 사실만 안내하고 동의를 받는다 */
  VIEWS.consent = function () {
    var on = !!ui.agree;
    return '<main class="screen has-bar">' + topbar() + '<h1 class="h" data-focus>이 기기에만 저장돼요</h1><p class="sub">등록하는 정보는 키핑이 아니라 이 기기 안에 보관돼요.</p>' +
      '<button type="button" class="agree' + (on ? ' on' : '') + '" role="checkbox" aria-checked="' + on + '" data-act="agree"><span class="box">' + (on ? icon('check', 14) : '') + '</span><span>이해했고 동의해요</span></button>' +
      '<ul class="facts">' +
      '<li>' + icon('check', 16) + '<span>등록한 약, 영양제, 복용 시간은 이 기기 안에만 있어요.</span></li>' +
      '<li>' + icon('check', 16) + '<span>키핑 서버로 보내지 않아요.</span></li>' +
      '<li>' + icon('check', 16) + '<span>기기를 바꾸거나 브라우저 데이터를 지우면 사라져요.</span></li>' +
      '<li>' + icon('check', 16) + '<span>키핑은 의료 조언이 아니에요. 공식 자료에서 확인한 범위만 보여드려요.</span></li></ul></main>' +
      actionBar('<button type="button" id="agreenext" class="cta" data-act="agreeNext"' + (on ? '' : ' disabled') + '>다음</button>');
  };

  VIEWS['onb-drugs'] = function () {
    var edit = ui.params.mode === 'edit', n = selectedItems('drug').length;
    return '<main class="screen has-bar">' + (edit ? topbar() : obHead(1) + stepChip(1)) +
      '<h1 class="h' + (edit ? '' : ' ob') + '" data-focus>' + (edit ? '지금 먹는 약' : '복용 중인 약을 검색해서 추가해 주세요') + '</h1><p class="sub' + (edit ? '' : ' ob') + '">' + (edit ? '먹는 약을 더하거나 뺄 수 있어요.' : '약 이름이나 성분명으로 찾을 수 있어요.') + '</p>' +
      searchBlock('drug') +
      '<p class="lbl">고른 약 <span class="count" id="selcount">' + n + '</span></p><div id="selected">' + selectedHtml('drug') + '</div></main>' +
      actionBar(edit
        ? '<button type="button" class="cta" data-act="nav" data-view="list">완료</button>'
        : '<button type="button" id="nextbtn" class="cta" data-act="to" data-view="onb-supps"' + (n ? '' : ' disabled') + '>다음</button>');
  };

  /* 검색창 바로 아래의 작은 칩 "+ 직접 입력". 누르면 제품 이름 · 업체 이름 · 들어 있는 성분을 적는 칸이 펼쳐진다. */
  function manualBlock() {
    var idx = {}, open = !!ui.manualOpen;
    Pack.supplementKeyList.forEach(function (k) { idx[k.id] = k; });
    var head = '<button type="button" class="chip small manual-chip' + (open ? ' on' : '') + '" aria-expanded="' + open + '" aria-controls="manualpanel" data-act="manualToggle">' + icon('plus', 14) + '직접 입력</button>';
    if (!open) return '<div class="manual">' + head + '</div>';
    var chips = Pack.chipKeys.map(function (k) {
      return '<button type="button" class="chip' + (ui.chips.indexOf(k) > -1 ? ' on' : '') + '" aria-pressed="' + (ui.chips.indexOf(k) > -1) + '" data-act="chip" data-k="' + k + '">' + esc(idx[k].ko) + '</button>';
    }).join('');
    return '<div class="manual">' + head + '<div class="panel" id="manualpanel"><label class="lbl" for="mname">제품 이름</label><input id="mname" class="ta" autocomplete="off" placeholder="예: 나우푸드 이노시톨" value="' + esc(ui.manualName) + '" data-input="mname">' +
      '<label class="lbl" for="mcompany">업체 이름 <span class="opt">선택</span></label><input id="mcompany" class="ta" autocomplete="off" placeholder="예: 나우푸드" value="' + esc(ui.manualCompany) + '" data-input="mcompany">' +
      '<p class="lbl">들어 있는 성분 (아는 것만 골라 주세요)</p><div class="chips">' + chips + '</div><p class="note">성분을 고르면 설명서와 겹치는지 확인할 수 있어요. 모르면 비워도 등록돼요.</p><button type="button" class="cta" data-act="manualSupp">등록하기</button></div></div>';
  }
  VIEWS['onb-supps'] = function () {
    var more = ui.params.mode === 'more', n = selectedItems('supp').length;
    return '<main class="screen has-bar">' + (more ? topbar() : obHead(2) + stepChip(2)) +
      '<h1 class="h' + (more ? '' : ' ob') + '" data-focus>같이 먹는 영양제가 있나요?</h1><p class="sub' + (more ? '' : ' ob') + '">' + (ui.supp.products === 'ready' ? '제품 이름이나 성분 이름으로 찾아 보세요. 못 찾은 제품은 직접 입력해 주세요.' : '어떤 영양제든 등록할 수 있어요. 못 찾은 제품은 직접 입력해 주세요.') + '</p>' + (ui.supp.products === 'off' ? '<p class="time-msg">제품 목록은 아직 준비 중이에요</p>' : '') +
      searchBlock('supp') +
      '<p class="lbl">고른 영양제 <span class="count" id="selcount">' + n + '</span></p><div id="selected">' + selectedHtml('supp') + '</div></main>' +
      actionBar(more
        ? '<button type="button" class="cta" data-act="to" data-view="times" data-all="1">복용 시간 입력하고 마치기</button>'
        : skipBtn('home') + '<button type="button" id="nextbtn" class="cta" data-act="to" data-view="home"' + (n ? '' : ' disabled') + '>다음</button>');
  };

  function timeRow(it) {
    var ts = (it.times && it.times.length) ? it.times : [''];
    var sub = it.productCode ? [it.ingredientEn, it.category].filter(Boolean).join(' · ') : kindLabel(it);
    return '<li class="pcard"><div class="pc-head"><div class="pc-title"><b>' + esc(nm(it)) + '</b>' + (sub ? '<span class="pc-sub">' + esc(sub) + '</span>' : '') + '</div></div><div class="tin">' + icon('clock', 20) +
      ts.map(function (t, i) { return '<input type="text" inputmode="numeric" autocomplete="off" placeholder="07:30" class="time" aria-label="' + esc(nm(it)) + ' 복용 시간 ' + (i + 1) + '" data-input="time" data-id="' + it.id + '" data-i="' + i + '" value="' + esc(t) + '">'; }).join('') +
      '<button type="button" class="mini" data-act="addTime" data-id="' + it.id + '" aria-label="' + esc(nm(it)) + ' 시간 추가">' + icon('plus') + '</button></div><p class="time-msg" id="tmsg-' + it.id + '" aria-live="polite"></p></li>';
  }
  VIEWS.times = function () {
    var p = ui.params, b = p.batch || null;
    var list = state.items.filter(function (i) { return p.all ? true : (i.batch || null) === b; });
    var foods = '';
    if (p.all) {
      foods = '<p class="lbl">먹는 음식 (선택)</p><div class="inrow"><label class="sr" for="fq">음식 이름</label><input id="fq" class="ta" autocomplete="off" placeholder="예: 커피, 우유, 자몽"><button type="button" class="add" data-act="addFood">추가</button></div><div class="chips">' +
        state.foods.map(function (f) { return '<span class="chip food">' + esc(f.name) + '<button type="button" data-act="rmFood" data-id="' + f.id + '" aria-label="' + esc(f.name) + ' 삭제">' + icon('x', 12) + '</button></span>'; }).join('') +
        '</div><p class="note">음식과 약의 상호작용 확인은 준비 중이에요. 지금은 기록만 해요.</p>';
    }
    var nextLabel = p.all ? '저장하고 돌아가기' : '저장하고 결과 보기';
    return '<main class="screen has-bar">' + topbar() +
      '<h1 class="h" data-focus>언제 드시나요?</h1><p class="sub">시간을 입력하면 하루 시간표가 만들어지고, 설명서에 복용 간격이 적힌 약은 간격도 볼 수 있어요. 나중에 입력해도 돼요.</p>' +
      (list.length ? '<ul class="tlist pcards">' + list.map(timeRow).join('') + '</ul>' : '<p class="muted">등록한 것이 없어요.</p>') + foods + '</main>' +
      actionBar('<button type="button" class="cta" data-act="timesDone">' + nextLabel + '</button>');
  };

  /* ---------- 홈 (docs/home-ui-spec.md) ----------
     묶음·문장·진행률·노드 상태의 계산은 js/homevm.js(KeepingHome.build)가 끝낸다. 여기서는 그 결과만 그린다. */
  var GRADE = { official: ['공식 지정', 'official'], label: ['설명서 근거', 'label'], reference: ['참고', 'ref'] };
  function badge(g) { var x = GRADE[g] || ['확인 못 함', 'none']; return '<span class="badge ' + x[1] + '">' + x[0] + '</span>'; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : null; }
  function loadingNow() { return ui.dur.status === 'loading' || ui.care.status === 'loading'; }
  function nonFood(flags) { return (flags || []).filter(function (f) { return f.kind !== 'food'; }); }
  function indexModel(m) {
    var ix = { rows: {}, unc: {}, unsched: {} };
    m.slots.forEach(function (s) { s.items.forEach(function (r) { (ix.rows[r.itemId] = ix.rows[r.itemId] || []).push(r); }); });
    m.uncovered.forEach(function (u) { ix.unc[u.itemId] = u.reason; });
    m.unscheduled.forEach(function (id) { ix.unsched[id] = true; });
    return ix;
  }
  /* 근거를 찾지 못한 약: 이유별 문구 */
  function uncoveredText(item, reason) {
    if (loadingNow()) return '약 목록과 설명서 기반 안내를 준비하는 중이에요';
    if (reason === 'no_rules') return '설명서에서 복용 시점·상호작용 안내를 찾지 못했어요. 안전하다는 뜻은 아니에요';
    if (reason === 'route_mismatch') return '이 제품과 투여 방식이 다른 약의 설명서라 안내를 붙이지 않았어요';
    var code = item.productCode || (item.itemSeq && Pack.dur && Pack.dur.codeOf && Pack.dur.codeOf(item.itemSeq));
    if (!item.productCode && !item.itemSeq) return '키핑이 확인한 범위 밖이에요. 등록은 됐고, 약사에게 확인해 주세요';
    if (!Pack.dur) return '전체 약 목록을 불러오지 못해서 확인하지 못했어요';
    if (!code) return '키핑이 확인한 범위 밖이에요. 등록은 됐고, 약사에게 확인해 주세요';   // 예전 저장 데이터 중 제품코드로 이어지지 않는 약
    return '설명서 기반 안내를 아직 준비하지 못했어요(병용금기는 확인했어요)';
  }

  /* 오늘의 체크: kp:checks:YYYY-MM-DD → { "morning:rx:내과": true }. 체크한 것만 true, 해제하면 키를 지운다. */
  var CHECKS_PREFIX = 'kp:checks:';
  var memChecks = {}, checksMemOnly = false;   // localStorage를 쓸 수 없을 때(읽기·쓰기 실패)만 임시 보관본을 쓴다
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function checksKey() { var d = new Date(); return CHECKS_PREFIX + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function loadChecks() {
    var key = checksKey(), out = {};
    if (checksMemOnly) return Object.assign({}, memChecks[key]);
    try {
      var raw = window.localStorage.getItem(key);
      var o = raw ? (JSON.parse(raw) || {}) : {};
      Object.keys(o).forEach(function (k) { if (o[k] === true) out[k] = true; });
      return out;
    } catch (e) { checksMemOnly = true; return Object.assign({}, memChecks[key]); }
  }
  function saveChecks(c) {
    var key = checksKey();
    memChecks = {}; memChecks[key] = Object.assign({}, c);
    if (checksMemOnly) return;
    try { window.localStorage.setItem(key, JSON.stringify(c)); } catch (e) { checksMemOnly = true; }
  }
  function nowMin() {
    if (ui.nowMin != null) return ui.nowMin;   // 시험·스크린샷용: 지금 시각을 고정할 때만 쓴다
    var d = new Date(); return d.getHours() * 60 + d.getMinutes();
  }

  /* 홈 문구(data/copy/greeting.json)와 로고는 첫 화면과 상관없이 따로 읽는다 */
  function bootCopy() {
    ui.copy = { status: 'loading' };
    if (typeof fetch !== 'function') { ui.copy = { status: 'error' }; return Promise.resolve(); }
    return fetch('data/copy/greeting.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { ui.copy = { status: 'ready', json: j }; }, function () { ui.copy = { status: 'error' }; })
      .then(function () { if (ui.view === 'home' || ui.view === 'bag') render(false); });
  }
  function bootLogo() {
    if (typeof fetch !== 'function') return Promise.resolve();
    return fetch('assets/brand/keeping-logo.svg').then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(t) || /<script|on\w+\s*=/i.test(t)) return;
        ui.logo = t.replace(/^\s*<\?xml[^>]*>\s*/, '');
        if (ui.view === 'home') render(false);
      }, function () {});
  }
  function homeVm() {
    var json = ui.copy.status === 'ready' ? ui.copy.json : { copy: {} };
    return window.KeepingHome.create({
      greeting: window.KeepingGreeting.create(json),
      entryOf: function (item) { return careEngine().entryOf(item); },   // 약봉투 화면의 "약 설명서 안내"
      productOf: function (item) {
        if (!Pack.dur) return null;
        var c = item.productCode || (item.itemSeq && Pack.dur.codeOf(item.itemSeq));
        return c ? Pack.dur.get(c) : null;
      }
    });
  }
  /* "새 처방" 칩: 새 약을 등록한 날에만, 그때 등록한 약 id들을 build()에 넘긴다 */
  function markNewRx(ids, append) {
    var day = checksKey().slice(CHECKS_PREFIX.length), keep = append && state.newRx && state.newRx.day === day ? state.newRx.ids : [];
    state.newRx = { day: day, ids: keep.concat(ids) }; save();
  }
  function newItemIds() {
    var n = state.newRx, ids = (n && n.day === checksKey().slice(CHECKS_PREFIX.length)) ? n.ids : [];
    return ids.filter(function (id) { return !!findItem(id); });
  }
  function homeModel() {
    return homeVm().build({ nowMin: nowMin(), newItemIds: newItemIds(), nickname: state.nickname || '', items: careItems(), analysis: careModel() || undefined, checks: loadChecks(), meals: mealsOf() });
  }

  /* 아이콘(24칸, 선) */
  var KP_ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    pill: '<path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
    leaf: '<path d="M20 4C10 4 4 9 4 16a4 4 0 0 0 4 4c7 0 12-6 12-16z"/><path d="M4 20c3-6 7-10 12-13"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5"/><path d="M12 17.4h.01"/>',
    down: '<path d="M6 9l6 6 6-6"/>', right: '<path d="M9 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', okcircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function kpIcon(n, size, cls) {
    return '<svg class="kp-ic' + (cls ? ' ' + cls : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + KP_ICONS[n] + '</svg>';
  }
  function pct(r) { return (Math.max(0, Math.min(1, r)) * 100).toFixed(2).replace(/\.?0+$/, '') + '%'; }

  function slotOpen(S) { return ui.open[S.id] != null ? !!ui.open[S.id] : !!S.defaultOpen; }
  function groupHtml(G) {
    return '<div class="kp-grp' + (G.checked ? ' is-checked' : '') + '">' +
      '<button type="button" class="kp-grp-main" data-act="openBag" data-id="' + esc(G.id) + '"><span class="kp-ico kp-ico--' + esc(G.icon) + '">' + kpIcon(G.icon, 22) + '</span>' +
      '<span class="kp-grp-txt"><b>' + esc(G.title) + (G.isNew ? '<span class="kp-newchip">' + esc(G.newLabel) + '</span>' : '') + '</b>' + (G.hint ? '<small>' + esc(G.hint) + '</small>' : '') + '</span></button>' +
      '<button type="button" class="kp-check" role="checkbox" aria-checked="' + !!G.checked + '" aria-label="' + esc(G.title) + ' 확인" data-act="toggleCheck" data-id="' + esc(G.id) + '"><span class="kp-box">' + kpIcon('check', 16) + '</span></button></div>';
  }
  /* 주의 블록: 첫 줄 버튼 안에 제목을 넣고(눌러서 근거 시트), 나머지 줄은 각자 버튼. 블록 안에 배지는 넣지 않는다. */
  function noticeHtml(S) {
    var n = S.notice, open = !!ui.noticeOpen[S.id], lines = open ? n.all : n.lines;
    var html = lines.map(function (l, i) {
      var attrs = ' type="button" data-act="openSheet" data-flag="' + esc(l.flagId) + '"';
      return i === 0
        ? '<button class="kp-notice-first"' + attrs + '><b>' + esc(n.title) + '</b><span>' + esc(l.text) + '</span>' + kpIcon('right', 18) + '</button>'
        : '<button class="kp-notice-line"' + attrs + '>' + esc(l.text) + '</button>';
    }).join('');
    if (n.more > 0 && !open) html += '<button type="button" class="kp-notice-more" data-act="toggleNotice" data-id="' + esc(S.id) + '" aria-expanded="false">' + esc(n.moreText) + '</button>';
    return '<div class="kp-notice">' + kpIcon('warn', 20) + '<div class="kp-notice-main">' + html + '</div></div>';
  }
  /* 주의가 없을 때의 작은 안내 블록(kind 'none'·'unknown' 모두). 빨강은 주의 전용이라 쓰지 않는다. */
  function statusLineHtml(L) {
    if (!L) return '';
    return '<div class="kp-status-line kp-status-line--' + esc(L.kind) + '">' + kpIcon('okcircle', 18) + '<div><p class="kp-status-line-text">' + esc(L.text) + '</p>' + (L.sub ? '<p class="kp-status-line-sub">' + esc(L.sub) + '</p>' : '') + '</div></div>';
  }
  function slotRowHtml(S) {
    var open = slotOpen(S), id = esc(S.id), parts = S.summary.text.split(' · ');
    var sum = esc(parts[0]) + (S.summary.cautionCount > 0 && parts.length > 1 ? ' · <span class="kp-red">' + esc(parts.slice(1).join(' · ')) + '</span>' : '');
    var ic = S.id === 'bedtime' ? 'moon' : 'sun';
    return '<li class="kp-row kp-row--slot' + (S.lineDone ? ' is-line-done' : '') + (S.last ? ' is-last' : '') + '" data-slot="' + id + '" data-node="' + S.nodeState + '">' +
      '<span class="kp-time">' + esc(S.time) + '</span><span class="kp-rail"><i class="kp-node kp-node--' + S.nodeState + '">' + (S.nodeState === 'done' ? kpIcon('check', 14) : '') + '</i></span>' +
      '<section class="kp-slot' + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="kp-slot-head" data-act="toggleSlot" data-id="' + id + '" aria-expanded="' + open + '" aria-controls="kp-slot-' + id + '">' +
      '<span class="kp-slot-ico kp-slot-ico--' + ic + '">' + kpIcon(ic, 22) + '</span><span class="kp-slot-title"><b>' + esc(S.label) + '</b><small>' + sum + '</small></span>' + kpIcon('down', 22, 'kp-chev') + '</button>' +
      '<div class="kp-slot-body" id="kp-slot-' + id + '"' + (open ? '' : ' hidden') + '>' + S.groups.map(groupHtml).join('') + (S.notice ? noticeHtml(S) : statusLineHtml(S.statusLine)) + (S.uncoveredNote ? '<p class="kp-uncovered">' + esc(S.uncoveredNote) + '</p>' : '') + '</div></section></li>';
  }
  function mealRowHtml(R) {
    return '<li class="kp-row kp-row--meal' + (R.lineDone ? ' is-line-done' : '') + (R.last ? ' is-last' : '') + '"><span class="kp-time">' + esc(R.time) + '</span>' +
      '<span class="kp-rail"><i class="kp-node kp-node--meal"></i></span><span class="kp-meal-label">' + esc(R.label) + '</span></li>';
  }
  function topbarHome() {
    var logo = ui.logo ? ui.logo : 'Keeping';
    return '<div class="kp-top"><span class="kp-logo" aria-label="Keeping">' + logo + '</span></div>';
  }
  VIEWS.home = function () {
    if (ui.copy.status === 'loading') return '<main class="screen kp-home">' + topbarHome() + '<p class="kp-stat" aria-live="polite">불러오는 중…</p></main>' + nav('home');
    var m = homeModel(), h = m.header, c = h.card, slots = m.rows.filter(function (r) { return r.type === 'slot'; });
    var from = ui.prevRatio != null ? ui.prevRatio : c.ratio;
    var hello = '<section class="kp-hello"><h1 class="kp-line1" data-focus>' + esc(h.line1) + '</h1><p class="kp-line2">' + esc(h.line2) + '</p>' +
      '<div class="kp-today"><span class="kp-today-title">' + esc(c.title) + kpIcon(c.icon, 16, 'kp-ic--' + c.icon) + '</span><span class="kp-count">' + esc(c.count) + '</span></div>' +
      '<div class="kp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + Math.max(c.total, 1) + '" aria-valuenow="' + c.taken + '" aria-label="' + esc(h.aria) + '"><i class="kp-fill" data-ratio="' + c.ratio + '" style="width:' + pct(from) + '"></i></div>' +
      '<p class="kp-status">' + esc(c.status) + '</p></section>';
    var body = careStatHtml().replace(/class="(muted )?carestat"/, 'class="kp-stat"');
    if (slots.length) body += '<ol class="kp-tl">' + m.rows.map(function (r) { return r.type === 'slot' ? slotRowHtml(r) : mealRowHtml(r); }).join('') + '</ol>';
    var acts = (!state.items.length ? '<button type="button" class="kp-add" data-act="to" data-view="onb-drugs">처음 설정 시작하기</button>' : '') +
      '<button type="button" class="kp-add' + (!state.items.length ? ' is-ghost' : '') + '" data-act="newRx">새 약 추가하기</button>';
    return '<main class="screen kp-home">' + topbarHome() + hello + body + '<div class="kp-add-wrap">' + acts + '</div></main>' + nav('home');
  };
  /* 다시 그릴 때 진행 바 폭만 빼고 비교한다(바는 그린 뒤에 새 폭으로 움직이므로) */
  function homeSig(html) { return html.replace(/style="width:[^"]*"/, ''); }
  function afterHome() {
    var f = root.querySelector('.kp-fill'); if (!f) return;
    var r = +f.getAttribute('data-ratio'), want = pct(r);
    if (f.style.width !== want) { void f.offsetWidth; f.style.width = want; }   // 이전 폭에서 새 폭으로 0.3초 움직인다
    ui.prevRatio = r;
  }

  /* ---------- 약봉투 화면: model.detail[group.id] ---------- */
  function bagNotice(n) {
    return '<button type="button" class="kp-notice" data-act="openSheet" data-flag="' + esc(n.flagId) + '">' + kpIcon('warn', 20) +
      '<span class="kp-notice-main"><span class="kp-notice-first" style="display:block;min-height:44px">' + esc(n.text) + kpIcon('right', 18) + '</span></span></button>';
  }
  /* 약 카드 안의 "약 설명서 안내"(model general): 기본 펼침. 설명서에서 자동으로 뽑은 원문 문장이라 출처·확인일을 함께 보여 준다. */
  function generalHtml(g) {
    if (!g) return '';
    var body;
    if (g.empty) body = '<p class="kp-gempty">' + esc(g.empty) + '</p>';
    else {
      var url = safeUrl(g.source && g.source.url), chk = g.source && g.source.checkedAt ? String(g.source.checkedAt).slice(0, 10) : '확인하지 못했어요';
      body = g.sections.map(function (sec) {
        return '<section class="kp-gsec"><h4>' + esc(sec.title) + '</h4><ul>' + sec.items.map(function (x) {
          var chips = (x.interval ? '<span class="kp-chip">' + esc(x.interval) + '</span>' : '') + (x.meal ? '<span class="kp-chip">' + esc(x.meal) + '</span>' : '');
          return '<li class="kp-gitem">' + (x.where ? '<small class="kp-gwhere">' + esc(x.where) + '</small>' : '') + '<p class="kp-gtext">' + esc(x.text) + '</p>' +
            (x.kos && x.kos.length ? '<p class="kp-gkos">관련: ' + esc(x.kos.join(' · ')) + '</p>' : '') + (chips ? '<div class="kp-gchips">' + chips + '</div>' : '') + '</li>';
        }).join('') + '</ul></section>';
      }).join('') + '<p class="kp-gfoot"><span>' + esc(g.auto) + '</span><span class="kp-src-row">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">원문 보기</a>' : '') + '<span>확인일 ' + esc(chk) + '</span></span></p>';
    }
    return '<details class="kp-gen" open><summary>' + esc(g.title) + kpIcon('down', 18, 'kp-gen-chev') + '</summary>' + body + '</details>';
  }
  VIEWS.bag = function () {
    var m = homeModel(), d = m.detail[ui.params.id];
    if (!d) { ui.view = 'home'; return VIEWS.home(); }
    var cards = d.items.map(function (it) {
      var sub = [it.spec, it.company].filter(Boolean).join(' · ');
      return '<article class="kp-bagcard"><h2 class="kp-bag-name">' + esc(it.display) + '</h2>' + (sub ? '<p class="kp-bag-sub">' + esc(sub) + '</p>' : '') +
        '<span class="kp-chip">' + esc(it.category) + '</span>' +
        (it.times && it.times.length ? '<p class="kp-bag-times"><span>먹는 시간</span>' + esc(it.times.join(' · ')) + '</p>' : '') +
        (it.doseText ? '<p class="kp-bag-times"><span>먹는 양</span>' + esc(it.doseText) + '</p>' : '') +
        (it.ingredient ? '<p class="kp-bag-ingr">' + esc(it.ingredient) + '</p>' : '') +
        (it.notices && it.notices.length ? it.notices.map(bagNotice).join('') : '') + generalHtml(it.general) + '</article>';
    }).join('');
    var foods = d.foods && d.foods.length ? '<section class="kp-foods"><h2>' + esc(d.foodsTitle) + '</h2><div>' + d.foods.map(function (f) { return '<span class="kp-chip">' + esc(f) + '</span>'; }).join('') + '</div></section>' : '';
    return '<main class="screen kp-bag"><div class="kp-bar2"><button type="button" class="kp-icbtn" data-act="back" aria-label="뒤로 가기">' + kpIcon('left', 24) + '</button><h1 class="kp-bar2-title" data-focus>' + esc(d.title) + '</h1></div>' + '<div class="kp-bag-list">' + cards + '</div>' + foods +
      '<div class="kp-bag-foot"><p>' + esc(d.scope) + '</p><p>' + esc(d.footer) + '</p></div></main>';
  };

  /* ---------- 근거 시트(바텀시트): model.sheets[flagId] ---------- */
  var sheetLayer = null, sheetReturn = null;
  function sheetBody(s) {
    var url = safeUrl(s.source && s.source.url), chk = s.source && s.source.checkedAt ? String(s.source.checkedAt).slice(0, 10) : '확인하지 못했어요';
    var official = s.grade === 'official';
    return '<span class="kp-badge ' + (official ? 'is-official' : 'is-label') + '">' + (official ? '공식 지정' : '설명서 근거') + '</span>' +
      '<h3 class="kp-sheet-h">' + esc(s.headline) + '</h3>' + (official && s.noteLine ? '<p class="kp-note">' + esc(s.noteLine) + '</p>' : '') + '<p class="kp-intro">' + esc(s.intro) + '</p>' +
      '<blockquote class="kp-quote">' + (s.where ? '<small>' + esc(s.where) + '</small>' : '') + '<p>' + esc(s.excerpt) + '</p></blockquote>' +
      '<section class="kp-rel"><h3>' + esc(s.relatedTitle) + '</h3><ul>' + (s.related || []).map(function (r) { return '<li><b>' + esc(r.label) + '</b>' + esc((r.names || []).join(', ')) + '</li>'; }).join('') + '</ul></section>' +
      (s.hintLine ? '<p class="kp-hintline">' + esc(s.hintLine) + '</p>' : '') +
      '<p class="kp-src"><span class="kp-src-label">' + esc((s.source && s.source.label) || '') + '</span><span class="kp-src-row">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">원문 보기</a>' : '') + '<span>확인일 ' + esc(chk) + '</span></span></p>' +
      '<p class="kp-help">이상 증상이 있으면 약사·의사에게 물어보세요.</p>';
  }
  function openSheet(flagId, trigger) {
    var s = homeModel().sheets[flagId];
    if (!s) { toast('근거를 불러오지 못했어요'); return; }
    closeSheet(true);
    sheetReturn = trigger ? { act: trigger.getAttribute('data-act'), flag: trigger.getAttribute('data-flag') } : null;
    ui.sheet = flagId;
    sheetLayer = document.createElement('div');
    sheetLayer.className = 'kp-layer';
    sheetLayer.innerHTML = '<div class="kp-scrim" data-act="closeSheet"></div>' +
      '<div class="kp-sheet" role="dialog" aria-modal="true" aria-labelledby="kp-sheet-title" tabindex="-1"><div class="kp-grab" aria-hidden="true"></div>' +
      '<div class="kp-sheet-bar"><h2 id="kp-sheet-title">근거</h2><button type="button" class="kp-icbtn" data-act="closeSheet" aria-label="닫기">' + kpIcon('x', 22) + '</button></div>' +
      '<div class="kp-sheet-body">' + sheetBody(s) + '</div><div class="kp-sheet-foot"><button type="button" class="kp-close" data-act="closeSheet">닫기</button></div></div>';
    document.body.appendChild(sheetLayer);
    document.body.style.overflow = 'hidden';
    root.setAttribute('aria-hidden', 'true'); root.setAttribute('inert', '');
    sheetLayer.addEventListener('click', onActClick);
    var x = sheetLayer.querySelector('.kp-icbtn'); if (x) x.focus({ preventScroll: true });
  }
  function closeSheet(silent) {
    if (!sheetLayer) return;
    sheetLayer.remove(); sheetLayer = null; ui.sheet = null;
    document.body.style.overflow = '';
    root.removeAttribute('aria-hidden'); root.removeAttribute('inert');
    var r = sheetReturn; sheetReturn = null;
    if (silent === true || !r) return;
    var back = root.querySelector('[data-act="' + r.act + '"]' + (r.flag ? '[data-flag="' + String(r.flag).replace(/["\\]/g, '\\$&') + '"]' : ''));
    if (back) back.focus({ preventScroll: true });
  }
  function sheetKeys(e) {
    if (!sheetLayer) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
    if (e.key !== 'Tab') return;
    var f = [].filter.call(sheetLayer.querySelectorAll('button,a[href]'), function (n) { return !n.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!sheetLayer.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- 진료과 한 줄 (처방약을 등록하는 단계 · 내 약 상세에서만) ---------- */
  var DEPTS = ['내과', '피부과', '이비인후과', '정형외과', '소아과'];
  function isRx(it) { return it.kind === 'drug' && homeVm().categoryOf(it) === 'rx'; }
  function deptHtml(it) {
    if (!isRx(it)) return '';
    var id = esc(it.id), custom = it.dept && DEPTS.indexOf(it.dept) < 0;
    if (ui.deptEdit === it.id) {
      return '<div class="deptq"><p class="lbl">어느 과에서 처방받았어요?</p><div class="dept-in"><label class="sr" for="deptin">진료과 직접 입력</label><input id="deptin" maxlength="20" autocomplete="off" placeholder="예: 신경과" value="' + esc(custom ? it.dept : '') + '">' +
        '<button type="button" class="add" data-act="deptSave" data-id="' + id + '">저장</button></div></div>';
    }
    var chips = DEPTS.map(function (d) {
      return '<button type="button" class="chip' + (it.dept === d ? ' on' : '') + '" aria-pressed="' + (it.dept === d) + '" data-act="deptPick" data-id="' + id + '" data-dept="' + esc(d) + '">' + esc(d) + '</button>';
    }).join('') +
      '<button type="button" class="chip' + (custom ? ' on' : '') + '" aria-pressed="' + !!custom + '" data-act="deptOther" data-id="' + id + '">' + (custom ? esc(it.dept) : '직접 입력') + '</button>' +
      '';
    return '<div class="deptq"><p class="lbl">어느 과에서 처방받았어요?</p><div class="chips">' + chips + '</div></div>';
  }

  VIEWS.list = function () {
    function group(label, items) {
      if (!items.length) return '';
      return '<p class="lbl">' + label + ' ' + items.length + '</p><ul class="mylist">' + items.map(function (it) {
        var t = activeTimes(it);
        return '<li><button type="button" class="mrow" data-act="detail" data-id="' + it.id + '"><span><b>' + esc(nm(it)) + '</b><small>' + esc(t.length ? t.join(' · ') : '시간 미정') + '</small></span>' + icon('chev') + '</button><button type="button" class="rm" data-act="removeAsk" data-id="' + it.id + '" aria-label="' + esc(nm(it)) + ' 삭제">' + icon('x') + '</button></li>';
      }).join('') + '</ul>';
    }
    var drugs = state.items.filter(function (i) { return i.kind === 'drug'; });
    var supps = state.items.filter(function (i) { return i.kind === 'supp'; });
    return '<main class="screen has-nav"><div class="hdr"><h1 class="h" data-focus>내가 먹는 것</h1><p class="sub">등록한 약과 영양제예요.</p></div>' +
      (state.items.length ? group('약', drugs) + group('영양제', supps) : '<p class="muted">아직 등록한 것이 없어요.</p>') +
      (state.foods.length ? '<p class="lbl">음식 ' + state.foods.length + '</p><div class="chips">' + state.foods.map(function (f) { return '<span class="chip food">' + esc(f.name) + '</span>'; }).join('') + '</div>' : '') +
      '<p class="lbl">내 설정 수정</p><div class="list">' +
        '<button type="button" class="row" data-act="to" data-view="onb-drugs" data-mode="edit"><span class="row-main"><b>지금 먹는 약</b><span class="sub2">약 더하기 · 빼기</span></span>' + icon('chev') + '</button>' +
        '<button type="button" class="row" data-act="to" data-view="onb-supps" data-mode="more"><span class="row-main"><b>영양제</b><span class="sub2">국내 · 해외 · 직접 입력</span></span>' + icon('chev') + '</button>' +
        '<button type="button" class="row" data-act="to" data-view="times" data-all="1"><span class="row-main"><b>복용 시간 · 음식</b><span class="sub2">시간표에 반영돼요</span></span>' + icon('chev') + '</button>' +
      '</div><div class="stack pad-top"><button type="button" class="cta" data-act="newRx">새 약 추가하기</button><button type="button" class="cta ghost" data-act="nav" data-view="questions">약사에게 물어볼 질문 보기</button><button type="button" class="cta ghost" data-act="to" data-view="onb-drugs">처음부터 다시 설정하기</button></div></main>' + nav('list');
  };

  VIEWS.add = function () {
    return '<main class="screen">' + topbar() + '<h1 class="h" data-focus>새로 받은 약을 추가해요</h1><p class="sub">약을 고르면 먹는 시간을 정해서 담아요. 지금 먹는 것과 근거가 확인된 주의만 골라서 보여드려요.</p>' +
      searchBlock('drug') + '</main>';
  };

  /* 담기 확인: 약을 고르면 한 화면에서 (처방약이면) 진료과 한 줄 + "언제 드세요?" 칩을 정하고 [담기]. 시간을 고르기 전에는 담기지 않는다. */
  /* 문구는 data/copy/greeting.json. 못 읽었을 때를 위한 대체 문구는 같은 내용이다. */
  var COPY_FALLBACK = { time_invalid: '시각을 다시 확인해 주세요 (예: 07:30)', time_band_hint: '{time}은 {band} 시간대로 들어가요', dose_label: '1회 먹는 양 (선택)', dose_hint: '내가 적어 두는 값이에요. 키핑은 양을 판단하지 않아요' };
  function say(key, vars) {
    if (ui.copy.status === 'ready' && window.KeepingGreeting) { var t = window.KeepingGreeting.create(ui.copy.json).say(key, vars); if (t) return t; }
    return String(COPY_FALLBACK[key] || '').replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }
  var DOSE_UNITS = ['정', '캡슐', '포', 'ml'];
  var SLOT_CHIPS = [['morning', '아침'], ['lunch', '점심'], ['dinner', '저녁'], ['bedtime', '자기 전']];
  function startDraft(item) {
    ui.draft = { item: item, slots: [], times: {}, blurred: {}, dose: { amount: '', unit: '정' }, dept: '', deptEdit: false, fromView: ui.view, fromParams: ui.params };
    go('confirm');
  }
  /* 칩에 보이는 시각: 고른 칩은 입력값(읽을 수 있을 때), 아니면 기본 시각 */
  function chipTime(d, id) { return (d.slots.indexOf(id) > -1 && window.KeepingTime.parse(d.times[id])) || window.KeepingTime.DEFAULTS[id]; }
  /* 입력칸을 벗어난 뒤에만 보여 준다(치는 중에는 비움). 빨강이 아니라 보조색 작은 글씨. */
  function timeMsg(d, id) {
    if (!d.blurred[id]) return '';
    var p = window.KeepingTime.parse(d.times[id]);
    if (p === null) return say('time_invalid');
    var m = window.KeepingTime.mismatch(id, p);
    return m ? say('time_band_hint', { time: p, band: m.label }) : '';
  }
  function draftReady(d) { return d.slots.length > 0 && d.slots.every(function (id) { return window.KeepingTime.parse(d.times[id]) !== null; }); }
  VIEWS.confirm = function () {
    var d = ui.draft;
    if (!d) { ui.view = 'home'; return VIEWS.home(); }
    d.times = d.times || {}; d.blurred = d.blurred || {}; d.dose = d.dose || { amount: '', unit: '정' };
    d.slots.forEach(function (id) { if (d.times[id] == null) d.times[id] = window.KeepingTime.DEFAULTS[id]; });
    var it = d.item, custom = d.dept && DEPTS.indexOf(d.dept) < 0, dept = '';
    if (isRx(it)) {
      var chips = d.deptEdit
        ? '<div class="dept-in"><label class="sr" for="ddeptin">진료과 직접 입력</label><input id="ddeptin" maxlength="20" autocomplete="off" placeholder="예: 신경과" value="' + esc(custom ? d.dept : '') + '"><button type="button" class="add" data-act="draftDeptSave">저장</button></div>'
        : '<div class="hscroll" role="group" aria-label="진료과">' + DEPTS.map(function (x) {
            return '<button type="button" class="chip' + (d.dept === x ? ' on' : '') + '" aria-pressed="' + (d.dept === x) + '" data-act="draftDept" data-dept="' + esc(x) + '">' + esc(x) + '</button>';
          }).join('') + '<button type="button" class="chip' + (custom ? ' on' : '') + '" aria-pressed="' + !!custom + '" data-act="draftDeptOther">' + (custom ? esc(d.dept) : '직접 입력') + '</button></div>';
      dept = '<p class="lbl">어느 과에서 처방받았어요? <span class="opt">선택</span></p>' + chips;
    }
    var slots = '<p class="lbl">언제 드세요?</p><div class="tacc-list" role="group" aria-label="먹는 시간">' + SLOT_CHIPS.map(function (c) {
      var a = d.slots.indexOf(c[0]) > -1;
      return '<div class="tacc' + (a ? ' on' : '') + '"><button type="button" class="tacc-h" role="checkbox" aria-checked="' + a + '" aria-expanded="' + a + '" data-act="draftSlot" data-slot="' + c[0] + '"><span class="tacc-box">' + (a ? kpIcon('check', 16) : '') + '</span><b>' + c[1] + '</b><span class="tacc-time" id="tc-' + c[0] + '">' + (a ? esc(chipTime(d, c[0])) : '') + '</span>' + kpIcon('down', 20, 'tacc-chev') + '</button>' +
        (a ? '<div class="tacc-p"><label class="tslot-l" for="dt-' + c[0] + '">' + c[1] + ' 시각</label><input id="dt-' + c[0] + '" class="tslot-in" type="text" inputmode="numeric" autocomplete="off" placeholder="07:30" data-input="dtime" data-slot="' + c[0] + '" value="' + esc(d.times[c[0]] || '') + '"><p class="time-msg" id="tm-' + c[0] + '" aria-live="polite">' + esc(timeMsg(d, c[0])) + '</p></div>' : '') + '</div>';
    }).join('') + '</div>';
    var dose = '<p class="lbl">' + esc(say('dose_label')) + '</p><div class="dose"><input id="ddose" class="ta" type="text" inputmode="decimal" autocomplete="off" aria-label="' + esc(say('dose_label')) + '" placeholder="1" data-input="ddose" value="' + esc(d.dose.amount) + '"><select id="dunit" class="ta" aria-label="단위" data-input="dunit">' +
      DOSE_UNITS.map(function (u) { return '<option' + (d.dose.unit === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div><p class="time-msg">' + esc(say('dose_hint')) + '</p>';
    return '<main class="screen has-bar">' + topbar() + '<h1 class="h" data-focus>담기 확인</h1>' +
      '<div class="pcard"><div class="pc-head"><div class="pc-title"><b>' + esc(nm(it)) + '</b><span class="pc-sub">' + esc(kindLabel(it)) + '</span></div></div>' + dept + slots + dose + '</div></main>' +
      actionBar('<button type="button" id="nextbtn" class="cta" data-act="dock"' + (draftReady(d) ? '' : ' disabled') + '>담기</button>');
  };

  /* ---------- 깊이 2: 근거 시트 / 약 상세 ---------- */
  function metaRow(label, value, tipHtml) {
    return '<div class="meta"><b>' + esc(label) + '</b><span>' + value + '</span>' + (tipHtml || '') + '</div>';
  }
  function dateOf(x) { return x ? String(x).slice(0, 10) : null; }
  /* 근거 카드: 등급 배지 · 헤드라인 · 조건/항목 · 원문 그대로 · 위치 · 출처 · 확인일. 요약하지 않는다. */
  function evidenceCard(ev, afterQuote) {
    var url = safeUrl(ev.source && ev.source.url), chk = dateOf(ev.source && ev.source.checkedAt);
    return '<article class="evcard">' + badge(ev.grade) + '<h2 class="evh">' + esc(ev.headline) + '</h2>' +
      (ev.detail ? '<p class="evd"><b>' + (ev.grade === 'official' ? '조건' : '항목') + '</b> ' + esc(ev.detail) + '</p>' : '') +
      (ev.excerpt ? '<blockquote class="evq"><small>원문' + (ev.where ? ' · ' + esc(ev.where) : '') + '</small><p>' + esc(ev.excerpt) + '</p></blockquote>' : '') + (afterQuote || '') +
      '<p class="src"><span>' + esc((ev.source && ev.source.label) || '') + '</span>' + (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener">원문 보기</a>' : '') + '<small>확인일 ' + esc(chk || '확인하지 못했어요') + '</small></p></article>';
  }
  var HELP_FOOT = '<p class="evfoot">이상 증상이 있으면 약사·의사에게 물어보세요.</p>';
  VIEWS.detail = function () {
    var item = findItem(ui.params.id);
    if (!item) return VIEWS.home();
    var m = careModel(), ix = m ? indexModel(m) : null, r = ix && ix.rows[item.id] ? ix.rows[item.id][0] : null;
    var t = activeTimes(item);
    var html = '<main class="screen">' + topbar() + '<h1 class="h" data-focus>' + esc(nm(item)) + '</h1><p class="sub">' + esc(kindLabel(item)) + ' · ' + esc(t.length ? t.join(' · ') : '시간 미정') + '</p><button type="button" class="cta ghost small" data-act="to" data-view="times" data-all="1">복용 시간 고치기</button>' + deptHtml(item);
    if (loadingNow()) {
      html += '<div class="card"><h4>준비 중이에요</h4><p>약 목록과 설명서 기반 안내를 불러오면 여기에 보여드려요.</p></div>';
    } else if (!m) {
      html += '<div class="card"><h4>설명서 기반 안내를 쓸 수 없어요</h4><p>등록은 됐어요. 약사에게 확인해 주세요.</p></div>';
    } else {
      var any = false;
      if (r && r.mealRelation && m.evidence[r.mealRelation.ruleId]) { any = true; html += '<p class="lbl">복용 시점</p>' + evidenceCard(m.evidence[r.mealRelation.ruleId]); }
      if (r) {
        var seen = {};
        nonFood(r.flags).forEach(function (f) { if (m.evidence[f.id] && !seen[f.id]) { seen[f.id] = 1; if (!any) html += ''; any = true; html += '<p class="lbl"><span class="red">' + icon('tri', 16) + '</span> ' + esc(f.short) + '</p>' + evidenceCard(m.evidence[f.id]); } });
        (r.foods || []).forEach(function (f) { if (m.evidence[f.flagId] && !seen[f.flagId]) { seen[f.flagId] = 1; any = true; html += '<p class="lbl">음식: ' + esc(f.ko) + '</p>' + evidenceCard(m.evidence[f.flagId]); } });
      }
      if (!r && ix.unsched[item.id]) html += '<button type="button" class="row" data-act="to" data-view="times" data-all="1"><span class="row-main"><b>복용 시간을 정해 주세요</b><span class="sub2">시간을 정하면 간격과 식사 관계를 볼 수 있어요</span></span>' + icon('chev') + '</button>';
      if (ix.unc[item.id]) html += '<div class="card"><h4>' + (item.kind === 'drug' ? '설명서 기반 안내' : '확인 결과') + '</h4><p>' + esc(uncoveredText(item, ix.unc[item.id])) + '</p></div>';
      else if (!any && r) html += '<div class="card"><h4>찾은 안내가 없어요</h4><p>등록한 것들 사이에서 병용금기·설명서 안내를 찾지 못했어요. 안전하다는 뜻은 아니에요.</p></div>';
    }
    return html + HELP_FOOT + '</main>';
  };

  function allQuestions() {
    var out = [], seen = {};
    E.analyze(state.items, Pack).forEach(function (a) {
      E.questionsFor(a, state.items, Pack).forEach(function (q) { if (!seen[q]) { seen[q] = 1; out.push({ text: q, saved: state.questions.some(function (s) { return s.text === q; }) }); } });
    });
    state.questions.forEach(function (s) { if (!seen[s.text]) { seen[s.text] = 1; out.push({ text: s.text, saved: true, mine: true, id: s.id }); } });
    return out;
  }
  VIEWS.questions = function () {
    var qs = allQuestions();
    return '<main class="screen">' + topbar() + '<h1 class="h" data-focus>약사에게 물어볼 질문</h1><p class="sub">겹치는 내용에서 뽑은 질문이에요. 약국이나 병원에서 그대로 보여주세요.</p>' +
      (qs.length ? '<ol class="qlist">' + qs.map(function (q) { return '<li>' + esc(q.text) + (q.mine ? '<button type="button" class="rm" data-act="rmQ" data-id="' + q.id + '" aria-label="질문 삭제">' + icon('x') + '</button>' : '') + '</li>'; }).join('') + '</ol>' : '<p class="muted">아직 질문이 없어요. 겹치는 내용이 있으면 여기에 모아져요.</p>') +
      '<p class="lbl">내가 궁금한 점 추가</p><div class="inrow"><label class="sr" for="cq">질문</label><input id="cq" class="ta" autocomplete="off" placeholder="예: 커피는 같이 마셔도 되나요?"><button type="button" class="add" data-act="addQ">추가</button></div>' +
      '<div class="actions"><button type="button" class="cta" data-act="copyQ"' + (qs.length ? '' : ' disabled') + '>질문 복사하기</button></div></main>';
  };

  function stateToggle(k, label) {
    var on = statesOf().indexOf(k) > -1;
    return '<button type="button" class="row switchrow" role="switch" aria-checked="' + on + '" data-act="toggleState" data-k="' + k + '"><span class="row-main"><b>' + label + '</b></span><span class="sw' + (on ? ' on' : '') + '" aria-hidden="true"><i></i></span><span class="swtxt">' + (on ? '켜짐' : '꺼짐') + '</span></button>';
  }
  VIEWS.settings = function () {
    var inPack = Pack.drugs.filter(function (d) { return !d.partial; }).length;
    var dur = Pack.dur, st = dur && dur.stats(), care = ui.care;
    function fmt(n) { return n.toLocaleString('ko-KR'); }
    var range = dur
      ? metaRow('약 검색 범위', fmt(st.products) + '개 제품 · 병용금기 ' + fmt(st.pairs) + '쌍')
      : metaRow('근거를 확인하는 약', inPack + '개 (데모 범위)');
    var careReady = care.status === 'ready';
    var careDate = careReady && care.latest ? care.latest : '확인하지 못했어요';
    var sources = '';
    if (dur) {
      var ps = dur.source('pair'), ls = dur.source('list');
      sources = '<p class="lbl">출처</p>' +
        '<div class="card soft"><h4>설명서(허가사항)</h4><p>' + (careReady ? '의약품 허가사항 (식품의약품안전처 · 공공데이터포털 허가정보 API)<br>설명서 데이터 확인일 ' + esc(careDate) + ' · 성분 ' + fmt(care.count) + '개<br>설명서 문장은 규칙으로 골라낸 원문이에요. 틀릴 수 있어서 원문 링크를 함께 보여드려요.' : '설명서 기반 안내를 불러오지 못했어요.') + '</p></div>' +
        '<div class="card soft"><h4>병용금기</h4><p><a class="lnk" href="' + esc(ps.url) + '" target="_blank" rel="noopener">' + esc(ps.label) + '</a><br>병용금기 목록 기준일 ' + esc(ps.checkedAt) + '</p></div>' +
        '<div class="card soft"><h4>약 목록</h4><p>' + esc(ls.label) + '<br>약 목록 적용일 ' + esc(ls.checkedAt || '확인하지 못했어요') + '</p></div>' +
        '<div class="card soft"><h4>이용 조건</h4><p>' + esc(dur.license()) + '</p><p class="muted">' + esc(LIST_LICENSE_NOTE) + '</p></div>';
    } else {
      sources = '<p class="lbl">출처</p><div class="card soft"><h4>전체 약 목록을 불러오지 못했어요</h4><p>지금은 키핑이 근거를 확인한 약 ' + inPack + '개 안에서만 찾아요.</p></div>';
    }
    if (ui.supp.products === 'ready') sources += '<div class="card soft"><h4>영양제 제품 목록</h4><p>영양제 제품 목록: 식품안전나라 건강기능식품 품목제조신고(원재료)</p></div>';
    var scope = '<p class="lbl">이 서비스가 확인하는 범위</p>' +
      metaRow('병용금기 목록', dur ? '확인함 (제품 목록 기준)' : '데이터 팩의 약 ' + inPack + '개만 확인함') +
      metaRow('설명서 안내', careReady ? '성분 ' + fmt(care.count) + '개의 허가사항에서 찾은 문장만' : '불러오지 못했어요') +
      metaRow('영양제', '등록한 영양제의 성분 키로만 맞춰 봐요') +
      metaRow('음식 · 용량 · 건강 상태', '음식은 설명서에 적힌 것만 · 용량은 확인하지 않음 · 임신·고령자는 고른 경우만');
    return '<main class="screen has-nav"><div class="hdr"><h1 class="h" data-focus>설정</h1></div>' +
      '<div class="card soft"><h4>이 기기에만 저장돼요</h4><p>등록한 약, 영양제, 복용 시간은 이 기기 안에만 있어요. 키핑 서버로 보내지 않아요. 기기를 바꾸거나 브라우저 데이터를 지우면 사라져요.</p></div>' +
      '<div class="stack"><button type="button" class="cta ghost" data-act="to" data-view="onb-drugs">처음부터 다시 설정하기</button><button type="button" class="cta ghost" data-act="exportData">내보내기 (파일로 저장)</button><label class="cta ghost filebtn" for="imp">가져오기 (파일 선택)</label><input id="imp" class="sr" type="file" accept="application/json,.json" data-input="import"><button type="button" class="cta ghost danger" data-act="resetAll">모든 정보 지우기</button></div>' +
      '<p class="lbl">내 상태 (선택)</p>' + stateToggle('pregnant', '임신 중') + stateToggle('elderly', '만 65세 이상') +
      '<p class="note">켜면 설명서의 임부·고령자 항목을 함께 보여드려요. 꺼 두면 그 안내는 보여드리지 않아요. 이 기기에만 저장돼요.</p>' +
      '<p class="lbl">정보</p><div class="meta"><b>설명서 데이터 확인일</b><span>' + esc(careDate) + '</span></div>' +
      '<div class="meta"><b>병용금기 목록 기준일</b><span>' + esc(dur ? dur.source('pair').checkedAt : '확인하지 못했어요') + '</span></div>' +
      '<div class="meta"><b>약 목록 적용일</b><span>' + esc(dur ? (dur.source('list').checkedAt || '확인하지 못했어요') : '확인하지 못했어요') + '</span></div>' +
      '<div class="meta"><b>영양제 자료 확인일</b><span>' + esc(Pack.checkedAt) + '</span></div>' + range +
      '<div class="meta off"><b>계정 연결</b><span>2차 예정</span></div>' +
      scope + sources +
      '<p class="fine">키핑은 의료 조언이 아니에요. 약과 영양제를 함께 복용해도 되는지는 약사나 의사에게 확인해 주세요. 출처: 식약처 의약품 제품 허가정보, DUR, 의약품안전나라, 식품안전나라.</p>' +
      '</main>' + nav('settings');
  };

  /* ---------- 흐름 ---------- */
  var splashTimer = null;
  function render(top) {
    var y = window.scrollY;
    var v = (VIEWS[ui.view] || VIEWS.home)();
    root.innerHTML = v;
    if (ui.view === 'home') { ui.homeSig = homeSig(v); afterHome(); }
    clearTimeout(splashTimer);
    if (ui.view === 'splash') splashTimer = setTimeout(function () { if (ui.view === 'splash') go('welcome'); }, 1600);
    if (top === false) window.scrollTo(0, y);
    else {
      window.scrollTo(0, 0);
      var h = root.querySelector('[data-focus]');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }
  /* 화면 기록(히스토리): go()는 지금 화면을 쌓고 새 화면으로 간다. 홈·내 약·마이·환영은 뿌리 화면이라 기록을 비운다.
     이전(뒤로 가기)과 브라우저 뒤로 가기 모두 한 단계씩 쌓인 화면으로 돌아간다. 브라우저 기록(pushState)과 개수를 맞춘다. */
  var ROOT_VIEWS = ['welcome', 'home', 'list', 'settings'];
  ui.hist = []; ui.depth = 0;   // depth: 브라우저 기록에서 지금 칸의 번호(pushState 상태 {kp})
  function enter(view, params, keepScroll) {
    closeSheet(true);
    ui.prev = { view: ui.view, params: ui.params };
    ui.view = view; ui.params = params || {};
    ui.more = false;
    ui.q = ''; ui.results = null; ui.remote = null; ui.chips = []; ui.manualName = ''; ui.manualCompany = ''; ui.manualOpen = false;
    render(!keepScroll);
    runSearch();
  }
  function go(view, params, keepScroll) {
    if (ROOT_VIEWS.indexOf(view) > -1) ui.hist = [];
    else { ui.hist.push({ view: ui.view, params: ui.params }); ui.depth++; try { history.pushState({ kp: ui.depth }, ''); } catch (e) { /* 기록을 못 쌓아도 앱은 동작 */ } }
    enter(view, params, keepScroll);
  }
  /* 한 단계 뒤로: 쌓인 화면이 없으면 false */
  function popView() {
    var p = ui.hist.pop(); if (!p) return false;
    enter(p.view, p.params);
    if (p.view === 'home') window.scrollTo(0, ui.homeScroll || 0);
    return true;
  }
  function backOne() {
    if (!popView()) return false;
    ui.depth--; try { history.back(); } catch (e) { /* 앱 안의 이전은 이미 됐다 */ }   // 브라우저 기록도 한 칸 되돌린다(그때 오는 popstate는 칸 번호가 같아 아무 일도 안 한다)
    return true;
  }
  /* 브라우저 뒤로 가기: 도착한 칸 번호까지 쌓인 화면을 한 단계씩 되돌린다. 앞으로 가기는 화면을 바꾸지 않는다. */
  window.addEventListener('popstate', function (e) {
    var d = e.state && e.state.kp ? e.state.kp : 0, n = ui.depth - d;
    ui.depth = d;
    if (n <= 0) return;                                      // 앞으로 가기·같은 칸(우리가 되돌린 경우)은 화면 그대로
    while (n-- > 1 && ui.hist.length > 1) ui.hist.pop();     // 건너뛴 칸은 버리고
    popView();                                               // 마지막 한 칸만 화면을 바꾼다
  });
  function newBatchId() { return 'rx-' + Date.now().toString(36); }

  /* 예시 사용자(시험용 seedExample)의 약 하나를 만든다. 전체 약 목록이 있으면 dur.search로 찾은 제품코드 항목, 없으면 데이터 팩(itemSeq) 항목. */
  function exampleDrug(query, seq, time, extra) {
    var hit = Pack.dur && Pack.dur.search(query, { limit: 1 })[0];
    if (hit) return newItem(Object.assign(Pack.dur.toItem(hit.code), { times: [time] }, extra || {}));
    var r = Pack.drugs.filter(function (d) { return d.itemSeq === seq; })[0];
    return newItem(Object.assign({ kind: 'drug', source: 'pack', itemSeq: seq, name: r.display || r.name, times: [time] }, extra || {}));
  }
  function loadExample() {
    state = Store.fresh(); state.example = true;
    var itra = exampleDrug('이트코나졸캡슐', '200000913', '08:30');   // 수출용 코니트라캡슐 대신 급여목록 제품(전체 약 목록이 없을 때만 코니트라캡슐)
    var s = Pack.supplements[0];
    var vitc = newItem({ kind: 'supp', source: 'domestic', name: s.name, reportNo: s.reportNo, company: s.company, ingredientRaw: s.ingredientRaw, ingredientKeys: s.ingredientKeys.slice(), times: ['13:30'] });
    var iron = newItem({ kind: 'supp', source: 'manual', name: '철분제 (예시)', ingredientKeys: ['iron'], times: ['09:30'] });
    state.items = [itra, vitc, iron];
    state.foods = [{ id: Store.uid(), name: '커피' }];
    save();
  }
  var Acts = {
    start: function () { ui.agree = false; go('consent'); },
    skipSplash: function () { go('welcome'); },
    agree: function (t) {
      ui.agree = !ui.agree;
      t.classList.toggle('on', ui.agree); t.setAttribute('aria-checked', String(ui.agree));
      t.querySelector('.box').innerHTML = ui.agree ? icon('check', 14) : '';
      var n = document.getElementById('agreenext'); if (n) n.disabled = !ui.agree;
    },
    agreeNext: function () { if (!ui.agree) return; state.agreedAt = new Date().toISOString(); save(); go('onb-drugs'); },
    skip: function (t) { Acts.to(t); },
    toggleSlot: function (t) {
      var id = t.dataset.id, open = t.getAttribute('aria-expanded') !== 'true';
      ui.open[id] = open;
      t.setAttribute('aria-expanded', String(open));
      var b = document.getElementById('kp-slot-' + id);
      if (b) { if (open) b.removeAttribute('hidden'); else b.setAttribute('hidden', ''); }
      var sec = t.closest('.kp-slot'); if (sec) sec.classList.toggle('is-open', open);
      ui.homeSig = homeSig(VIEWS.home());
    },
    /* 체크: 해제하면 키를 지운다. 체크해도 카드가 갑자기 접히지 않도록 지금 보이는 펼침 상태를 먼저 고정한다. */
    toggleCheck: function (t) {
      var id = t.dataset.id, c = loadChecks();
      [].forEach.call(root.querySelectorAll('.kp-slot-head'), function (h) { ui.open[h.dataset.id] = h.getAttribute('aria-expanded') === 'true'; });
      if (c[id]) delete c[id]; else c[id] = true;
      saveChecks(c); renderKeepingFocus();
    },
    toggleNotice: function (t) { ui.noticeOpen[t.dataset.id] = !ui.noticeOpen[t.dataset.id]; renderKeepingFocus(); },
    openBag: function (t) { ui.homeScroll = window.scrollY; go('bag', { id: t.dataset.id }); },
    openSheet: function (t) { openSheet(t.dataset.flag, t); },
    closeSheet: function () { closeSheet(); },
    deptPick: function (t) { var it = findItem(t.dataset.id); setDept(t.dataset.id, it && it.dept === t.dataset.dept ? {} : { dept: t.dataset.dept }); },   // 선택한 칩을 다시 누르면 해제
    deptOther: function (t) { ui.deptEdit = t.dataset.id; redrawDept(); var i = document.getElementById('deptin'); if (i) i.focus(); },
    deptSave: function (t) {
      var i = document.getElementById('deptin'), v = i ? i.value.trim().slice(0, 20) : '';
      ui.deptEdit = null;
      if (v) setDept(t.dataset.id, { dept: v }); else redrawDept();
    },
    to: function (t) {
      var v = t.dataset.view, p = {};
      if (t.dataset.mode) p.mode = t.dataset.mode;
      if (t.dataset.all) p.all = true;
      if (t.dataset.batch) p.batch = t.dataset.batch;
      go(v, p);
    },
    nav: function (t) { var p = {}; if (t.dataset.scope) p.scope = t.dataset.scope; go(t.dataset.view, p); },
    back: function () {
      if (!backOne()) go(state.items.length ? 'home' : 'welcome');
      else if (ui.view === 'home') window.scrollTo(0, ui.homeScroll || 0);
    },
    detail: function (t) { go('detail', { id: t.dataset.id }); },
    newRx: function (t) { go('add', { batch: t.dataset.batch || newBatchId() }); },
    draftSlot: function (t) {
      var d = ui.draft; if (!d) return;
      var i = d.slots.indexOf(t.dataset.slot);
      if (i > -1) d.slots.splice(i, 1); else { d.slots.push(t.dataset.slot); if (d.times[t.dataset.slot] == null) d.times[t.dataset.slot] = window.KeepingTime.DEFAULTS[t.dataset.slot]; }
      renderKeepingFocus();
    },
    draftDept: function (t) { var d = ui.draft; if (!d) return; d.dept = d.dept === t.dataset.dept ? '' : t.dataset.dept; d.deptEdit = false; renderKeepingFocus(); },
    draftDeptOther: function () { var d = ui.draft; if (!d) return; d.deptEdit = true; render(false); var i = document.getElementById('ddeptin'); if (i) i.focus(); },
    draftDeptSave: function () {
      var d = ui.draft; if (!d) return;
      var i = document.getElementById('ddeptin'); d.dept = i ? i.value.trim().slice(0, 20) : d.dept; d.deptEdit = false; render(false);
    },
    /* 담기: 시간을 하나 이상 골랐을 때만. 새 약 추가에서는 홈으로, 처음 설정·약 수정에서는 검색 화면으로 돌아간다. */
    dock: function () {
      var d = ui.draft; if (!d || !d.slots.length) { toast('먹는 시간을 하나 이상 골라 주세요'); return; }
      if (!draftReady(d)) { toast(say('time_invalid')); return; }
      var it = d.item, add = d.fromView === 'add';
      it.times = SLOT_CHIPS.filter(function (c) { return d.slots.indexOf(c[0]) > -1; }).map(function (c) { return window.KeepingTime.parse(d.times[c[0]]); })
        .filter(function (t, i, a) { return a.indexOf(t) === i; });
      var amt = parseFloat(String(d.dose.amount).replace(',', '.'));
      if (amt > 0 && isFinite(amt)) it.dose = { amount: amt, unit: d.dose.unit }; else delete it.dose;   // 비우면 저장하지 않는다
      if (d.dept) it.dept = d.dept; else delete it.dept;
      if (add) { it.batch = (d.fromParams && d.fromParams.batch) || null; state.lastBatch = it.batch; }
      state.items.push(it);
      if (add) markNewRx([it.id], true); else save();
      ui.draft = null;
      if (add) { go('home'); toast(nm(it) + ' 담았어요'); } else { if (!backOne()) go(d.fromView, d.fromParams); toast(nm(it) + ' 담았어요'); }
    },
    pick: function (t) {
      var x = ui.results && ui.results[+t.dataset.i]; if (!x) return;
      if (currentKind() === 'drug') {
        var item;
        if (x.source === 'dur') {
          var di = Pack.dur && Pack.dur.toItem(x.code);
          if (!di) { toast('이 약을 불러오지 못했어요'); return; }
          item = newItem(di);
        } else item = newItem({ kind: 'drug', source: x.source, itemSeq: x.itemSeq, name: x.name, ingredientKo: x.ingredientKo || null, type: x.type || null });
        startDraft(item); return;
      }
      var s = x.supp;   // 제품을 고르면 reportNo·company·ingredientKeys가 함께 들어간다
      startDraft(newItem({ kind: 'supp', source: 'domestic', name: s.name, reportNo: s.reportNo, company: s.company, ingredientRaw: s.ingredientRaw, ingredientKeys: (s.ingredientKeys || []).slice() }));
    },
    manualDrug: function () {
      var name = ui.q.trim(); if (!name) return;
      startDraft(newItem({ kind: 'drug', source: 'manual', name: name }));
    },
    remove: function (t) { state.items = state.items.filter(function (i) { return i.id !== t.dataset.id; }); save(); refreshLists(); },
    removeAsk: function (t) {
      var it = findItem(t.dataset.id); if (!it) return;
      if (window.confirm(nm(it) + '을(를) 목록에서 지울까요?')) { state.items = state.items.filter(function (i) { return i.id !== it.id; }); save(); render(false); }
    },
    manualToggle: function () { ui.manualOpen = !ui.manualOpen; render(false); var i = document.getElementById('mname'); if (ui.manualOpen && i) i.focus(); },
    manualOpen: function () { ui.manualOpen = true; render(false); var i = document.getElementById('mname'); if (i) i.focus(); },
    chip: function (t) {
      var k = t.dataset.k, i = ui.chips.indexOf(k);
      if (i > -1) ui.chips.splice(i, 1); else ui.chips.push(k);
      t.classList.toggle('on', i < 0); t.setAttribute('aria-pressed', String(i < 0));
    },
    manualSupp: function () {
      var inp = document.getElementById('mname'); var name = (inp ? inp.value : ui.manualName).trim();
      if (!name && !ui.chips.length) { toast('이름이나 성분을 하나 입력해 주세요'); return; }
      if (!name) name = ui.chips.map(function (k) { return Pack.supplementKeyList.filter(function (x) { return x.id === k; })[0].ko; }).join(' · ');
      var co = document.getElementById('mcompany'); var company = (co ? co.value : ui.manualCompany).trim();
      startDraft(newItem({ kind: 'supp', source: 'manual', name: name, company: company, ingredientKeys: ui.chips.slice() }));
    },
    addTime: function (t) { var it = findItem(t.dataset.id); if (!it) return; it.times = it.times && it.times.length ? it.times.concat(['']) : ['', '']; save(); render(false); },
    timesDone: function () {
      go('home');
    },
    toggleState: function (t) {
      var k = t.dataset.k, cur = statesOf(), i = cur.indexOf(k);
      if (i > -1) cur.splice(i, 1); else cur.push(k);
      state.states = cur; save(); render(false);
      var again = root.querySelector('[data-act="toggleState"][data-k="' + k + '"]'); if (again) again.focus({ preventScroll: true });
    },
    closeCareNote: function () { ui.care.notice = false; render(false); },
    addFood: function () {
      var inp = document.getElementById('fq'); var v = inp ? inp.value.trim() : ''; if (!v) return;
      state.foods.push({ id: Store.uid(), name: v }); save(); render(false);
    },
    rmFood: function (t) { state.foods = state.foods.filter(function (f) { return f.id !== t.dataset.id; }); save(); render(false); },
    tip: function (t) {
      var id = 'tip-' + t.dataset.tip, el = document.getElementById(id); if (!el) return;
      var open = el.hasAttribute('hidden');
      closeTips();
      if (open) { el.removeAttribute('hidden'); t.setAttribute('aria-expanded', 'true'); }
    },
    saveQ: function (t) {
      var q = t.dataset.q, i = -1;
      state.questions.forEach(function (s, k) { if (s.text === q) i = k; });
      if (i > -1) { state.questions.splice(i, 1); t.textContent = '저장'; t.classList.remove('on'); t.setAttribute('aria-pressed', 'false'); }
      else { state.questions.push({ id: Store.uid(), text: q }); t.textContent = '저장됨'; t.classList.add('on'); t.setAttribute('aria-pressed', 'true'); toast('질문을 저장했어요'); }
      save();
    },
    addQ: function () {
      var inp = document.getElementById('cq'); var v = inp ? inp.value.trim() : ''; if (!v) return;
      state.questions.push({ id: Store.uid(), text: v }); save(); render(false);
    },
    rmQ: function (t) { state.questions = state.questions.filter(function (q) { return q.id !== t.dataset.id; }); save(); render(false); },
    copyQ: function () {
      var text = allQuestions().map(function (q, i) { return (i + 1) + '. ' + q.text; }).join('\n');
      function done() { toast('질문을 복사했어요'); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast('복사하지 못했어요'); });
      else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('복사하지 못했어요'); } ta.remove(); }
    },
    exportData: function () {
      var blob = new Blob([Store.exportJSON(state)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'keeping-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('파일로 저장했어요');
    },
    resetAll: function () {
      if (window.confirm('이 기기에 저장된 모든 정보를 지울까요? 되돌릴 수 없어요.')) { state = Store.reset(); go('welcome'); }
    }
  };

  function closeTips() {
    [].forEach.call(root.querySelectorAll('.tip'), function (e) { e.setAttribute('hidden', ''); });
    [].forEach.call(root.querySelectorAll('.tipbtn'), function (b) { b.setAttribute('aria-expanded', 'false'); });
  }

  function onActClick(e) {
    if (!e.target.closest('.tipwrap')) closeTips();
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var f = Acts[t.getAttribute('data-act')];
    if (f) f(t, e);
  }
  root.addEventListener('click', onActClick);

  /* 다시 그리되(체크·펼침·1분마다 갱신) 포커스가 있던 버튼으로 돌려놓는다 */
  function renderKeepingFocus() {
    var a = document.activeElement, sel = null;
    if (a && root.contains(a) && a.getAttribute && a.getAttribute('data-act')) {
      var q = function (v) { return String(v).replace(/["\\]/g, '\\$&'); };
      sel = '[data-act="' + q(a.getAttribute('data-act')) + '"]' + (a.dataset.id ? '[data-id="' + q(a.dataset.id) + '"]' : '') + (a.dataset.flag ? '[data-flag="' + q(a.dataset.flag) + '"]' : '') + (a.dataset.slot ? '[data-slot="' + q(a.dataset.slot) + '"]' : '') + (a.dataset.dept ? '[data-dept="' + q(a.dataset.dept) + '"]' : '');
    }
    render(false);
    var n = sel && root.querySelector(sel); if (n) n.focus({ preventScroll: true });
  }
  /* 앱을 열어 둔 동안 1분마다, 그리고 앱으로 돌아올 때 지금 시각을 다시 넣어 홈을 다시 그린다(달라진 것이 있을 때만) */
  function tickHome() {
    if (ui.view !== 'home' || ui.sheet || document.hidden || ui.copy.status === 'loading') return;
    if (homeSig(VIEWS.home()) !== ui.homeSig) renderKeepingFocus();
  }
  setInterval(tickHome, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tickHome(); });
  document.addEventListener('keydown', sheetKeys);

  /* 진료과 저장 */
  function setDept(id, o) {
    var it = findItem(id); if (!it) return;
    if (o.dept) it.dept = o.dept; else delete it.dept;
    it.updatedAt = new Date().toISOString(); save(); redrawDept();
  }
  function redrawDept() { if (document.getElementById('selected')) refreshLists(); else renderKeepingFocus(); }
  root.addEventListener('input', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-input');
    if (k === 'search') { ui.q = t.value; clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 150); }
    else if (k === 'mname') ui.manualName = t.value;
    else if (k === 'mcompany') ui.manualCompany = t.value;
    else if (k === 'dtime' && ui.draft) {          // 치는 중에는 값만 기억하고 안내는 비운다. 담기 버튼만 바로 갱신.
      ui.draft.times[t.dataset.slot] = t.value; ui.draft.blurred[t.dataset.slot] = false;
      var m = document.getElementById('tm-' + t.dataset.slot); if (m) m.textContent = '';
      var nb = document.getElementById('nextbtn'); if (nb) nb.disabled = !draftReady(ui.draft);
    } else if (k === 'ddose' && ui.draft) ui.draft.dose.amount = t.value;
  });
  /* 입력칸을 벗어나면 "19:30" 꼴로 고쳐 보여 준다 */
  root.addEventListener('focusout', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-input'), d = ui.draft;
    if (k !== 'dtime' || !d) return;
    var id = t.dataset.slot, p = window.KeepingTime.parse(t.value);
    if (p) { t.value = p; d.times[id] = p; } else d.times[id] = t.value;
    d.blurred[id] = true;
    var m = document.getElementById('tm-' + id); if (m) m.textContent = timeMsg(d, id);
    var c = document.getElementById('tc-' + id); if (c) c.textContent = chipTime(d, id);
    var nb = document.getElementById('nextbtn'); if (nb) nb.disabled = !draftReady(d);
  });
  root.addEventListener('change', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-input');
    if (k === 'dunit' && ui.draft) ui.draft.dose.unit = t.value;
    else if (k === 'time') {
      var it = findItem(t.dataset.id); if (!it) return;
      var i = +t.dataset.i; var prev = it.times && it.times.length ? it.times.slice() : [''];
      var next = prev.slice(), pt = window.KeepingTime.parse(t.value);
      var msg = document.getElementById('tmsg-' + it.id);
      if (t.value.trim() && pt === null) { t.value = prev[i] || ''; if (msg) msg.textContent = say('time_invalid'); return; }   // 읽을 수 없으면 저장하지 않는다
      if (msg) msg.textContent = '';
      t.value = pt || ''; next[i] = pt || '';
      if (!next.some(Boolean) && prev.some(Boolean)) { t.value = prev[i] || ''; toast('복용 시간이 하나는 있어야 해요'); return; }   // 시간이 없는 약은 만들지 않는다
      it.times = next; it.updatedAt = new Date().toISOString(); save();
    } else if (k === 'import') {    } else if (k === 'import') {
      var file = t.files && t.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { state = Store.importJSON(String(fr.result)); save(); toast('가져왔어요'); go(state.items.length ? 'home' : 'welcome'); }
        catch (err) { toast(err.message || '가져오지 못했어요'); }
      };
      fr.readAsText(file);
    }
  });
  root.addEventListener('keydown', function (e) {
    if (ui.view === 'splash' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go('welcome'); return; }
    if (e.key !== 'Enter') return;
    var id = e.target.id;
    if (id === 'fq') Acts.addFood();
    else if (id === 'cq') Acts.addQ();
    else if (id === 'mname' || id === 'mcompany') Acts.manualSupp();
    else if (id === 'deptin' && ui.deptEdit) Acts.deptSave({ dataset: { id: ui.deptEdit } });
    else if (id === 'ddeptin') Acts.draftDeptSave();
  });

  ui.view = state.items.length ? 'home' : 'splash';
  var durReady = bootDur();   // 약 목록은 첫 화면과 상관없이 바로 불러오기 시작
  var careReady = bootCare(); // 설명서 기반 안내 데이터는 약 목록이 온 뒤 읽는다
  Api.suppInfo().then(function (i) { ui.supp = i; if (ui.view === 'onb-supps' || ui.view === 'settings') render(false); });   // 영양제 제품 목록 유무(없어도 동작)
  var copyReady = bootCopy(); // 홈 문구(data/copy/greeting.json)
  bootLogo();                 // assets/brand/keeping-logo.svg 가 있을 때만 인라인으로 쓴다
  /* 첫 화면은 글꼴(Pretendard)이 도착한 뒤에 그린다(최대 1.2초). 글꼴이 늦게 와서 문단이 다시 줄바꿈되며 화면이 튀는 것을 막는다. */
  var booted = false;
  function boot() { if (booted) return; booted = true; render(true); }
  if (document.fonts && document.fonts.load) {
    Promise.race([Promise.all([400, 500, 600, 700].map(function (w) { return document.fonts.load(w + " 16px 'Pretendard Variable'"); })), new Promise(function (r) { setTimeout(r, 1200); })]).then(boot, boot);
  } else boot();
  window.KeepingApp = { state: function () { return state; }, go: go, ui: ui, bootDur: bootDur, bootCare: bootCare, bootCopy: bootCopy, careModel: careModel, careItems: careItems, homeModel: homeModel, seedExample: loadExample, generalHtml: generalHtml, loadChecks: loadChecks, render: render };
})();
