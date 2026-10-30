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
    tab: 'domestic', q: '', oq: '', results: null, remote: null, overseas: null,
    chips: [], manualName: '', searchToken: 0,
    dur: { status: 'loading' },
    care: { status: 'loading', engine: null, notice: true }, open: {}
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
      '<div class="stepbar" role="img" aria-label="3단계 중 ' + n + '단계"><i style="width:' + Math.round(n * 100 / 3) + '%"></i></div></div>';
  }
  function stepChip(n) { return '<span class="stepchip">' + n + '/3</span>'; }
  function actionBar(inner, cls) { return '<div class="actionbar' + (cls ? ' ' + cls : '') + '">' + inner + '</div>'; }
  function skipBtn(view) {
    return '<button type="button" class="cta outline skipbtn" data-act="skip" data-view="' + view + '"><span>건너뛰기</span><small>언제든 수정할 수 있어요</small></button>';
  }
  function nav(cur) {
    function b(v, label, ic, scope) {
      return '<button type="button" data-act="nav" data-view="' + v + '"' + (scope ? ' data-scope="' + scope + '"' : '') + (cur === v ? ' aria-current="page" class="on"' : '') + '>' + icon(ic, 28) + '<span>' + label + '</span></button>';
    }
    return '<nav class="nav" aria-label="주 메뉴">' + b('home', '홈', 'home') + b('list', '내 약', 'list') + b('settings', '마이', 'user') + '</nav>';
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
    if (!ui.q.trim()) return '';
    if (kind === 'drug' && ui.dur.status === 'loading') return ''; // 안내는 #durstat에 있고, 로딩이 끝나면 자동으로 다시 찾는다
    if (r === null) return '<p class="muted pad">불러오는 중…</p>';
    var html = '';
    if (ui.remote && ui.remote.status === 'error') html += '<p class="note">서버 검색에 연결하지 못했어요. 확인 범위 안의 결과만 보여드려요.</p>';
    if (!r.length) {
      if (kind === 'drug') {
        html += '<div class="empty"><p><b>"' + esc(ui.q) + '"</b> 검색 결과가 없어요.</p><p class="muted">이름 그대로 등록할 수 있어요. 이 경우 겹침 확인은 되지 않고 "확인 못 함"으로 표시돼요.</p><button type="button" class="cta ghost small" data-act="manualDrug">"' + esc(ui.q) + '" 이름으로 등록</button></div>';
      } else {
        html += '<div class="empty"><p><b>"' + esc(ui.q) + '"</b> 검색 결과가 없어요.</p><p class="muted">해외 제품이거나 목록에 없는 제품이에요? 아래에서 등록할 수 있어요.</p><div class="row2"><button type="button" class="cta ghost small" data-act="tab" data-tab="overseas">해외 제품 검색</button><button type="button" class="cta ghost small" data-act="tab" data-tab="manual">직접 입력</button></div></div>';
      }
      return html;
    }
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
    return '<div class="search"><label class="sr" for="q">' + (kind === 'drug' ? '약 이름 검색' : '영양제 이름 검색') + '</label><div class="inp">' + icon('search', 20) + '<input id="q" type="search" inputmode="search" autocomplete="off" placeholder="' + ph + '" value="' + esc(ui.q) + '" data-input="search"></div>' + (kind === 'drug' ? '<div id="durstat" aria-live="polite">' + durHtml() + '</div>' : '') + '<div id="results" aria-live="polite">' + resultsHtml(kind) + '</div></div>';
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
      if (['home', 'list', 'detail', 'sheet', 'settings'].indexOf(ui.view) > -1) render(false); // 확인 결과가 달라질 수 있는 화면만 다시 그린다
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
      if (['home', 'list', 'detail', 'sheet', 'settings', 'onb-supps', 'times'].indexOf(ui.view) > -1) render(false);
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
      if (it.kind === 'drug') return { id: it.id, kind: 'drug', productCode: it.productCode || undefined, itemSeq: it.itemSeq || undefined, name: it.name, display: nm(it), times: activeTimes(it) };
      return { id: it.id, kind: 'supp', ingredientKeys: (it.ingredientKeys || []).slice(), name: it.name, display: nm(it), times: activeTimes(it) };
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
    return ui.view === 'onb-drugs' || ui.view === 'add' || (ui.view === 'onb-supps' && ui.tab === 'domestic');
  }
  function runSearch() {
    if (!needsSearch()) return;
    var kind = currentKind();
    var token = ++ui.searchToken;
    var q = ui.q.trim();
    if (!q) { ui.results = []; ui.remote = null; ui.more = false; refreshLists(); return; }
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
    return '<main class="screen splash" data-act="skipSplash"><p class="splash-tag">내가 먹는 약과 영양제, 겹치는 것만</p><h1 class="splash-logo" data-focus>키핑</h1><p class="splash-hint">화면을 누르면 바로 시작해요</p></main>';
  };

  VIEWS.welcome = function () {
    return '<main class="screen welcome"><p class="brand">키핑</p><h1 class="h xl" data-focus>내가 먹는 약과 영양제,<br>겹치는 것만 알려드려요</h1><p class="sub">약을 새로 받을 때마다 지금 먹는 것과 겹치는 내용만 골라서 보여드려요. 건강정보는 이 기기에만 저장돼요.</p><p class="fine">키핑은 의료 조언이 아니에요. 공식 자료에서 확인한 범위만 보여드리고, 판단은 약사에게 확인해 주세요.</p></main>' +
      actionBar('<button type="button" class="cta" data-act="start">시작하기</button><button type="button" class="linkbtn" data-act="demo">예시 사용자로 체험하기</button>', 'col');
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
        : skipBtn('onb-supps') + '<button type="button" id="nextbtn" class="cta" data-act="to" data-view="onb-supps"' + (n ? '' : ' disabled') + '>다음</button>');
  };

  function suppTabs() {
    function t(id, label) { return '<button type="button" role="tab" aria-selected="' + (ui.tab === id) + '" class="tab' + (ui.tab === id ? ' on' : '') + '" data-act="tab" data-tab="' + id + '">' + label + '</button>'; }
    return '<div class="tabs" role="tablist">' + t('domestic', '국내 제품') + t('overseas', '해외 제품') + t('manual', '직접 입력') + '</div>';
  }
  function overseasHtml() {
    var o = ui.overseas, body = '';
    if (o) {
      if (o.status === 'loading') body = '<p class="muted pad">검색하는 중…</p>';
      else if (o.status === 'off') body = '<p class="note">이 버전에서는 해외 제품 검색이 연결돼 있지 않아요. "직접 입력"에서 이름과 성분을 골라 등록해 주세요.</p><button type="button" class="cta ghost small" data-act="tab" data-tab="manual">직접 입력으로 등록</button>';
      else if (o.status === 'error') body = '<p class="note">해외 제품 검색에 연결하지 못했어요. "직접 입력"으로 등록할 수 있어요.</p><button type="button" class="cta ghost small" data-act="tab" data-tab="manual">직접 입력으로 등록</button>';
      else if (o.status === 'empty') body = '<p class="note">검색 결과가 없어요. "직접 입력"으로 등록할 수 있어요.</p><button type="button" class="cta ghost small" data-act="tab" data-tab="manual">직접 입력으로 등록</button>';
      else body = o.results.map(function (x, i) { return '<button type="button" class="res" data-act="pickOverseas" data-i="' + i + '"><span class="res-main"><b>' + esc(x.name) + '</b><span class="muted">' + esc(x.brand || '') + '</span></span><span class="res-act">' + icon('plus') + '추가</span></button>'; }).join('');
    }
    return '<div class="panel"><p class="sub small">미국에서 판매되는 제품은 NIH 영양제 라벨 DB에서 찾아볼 수 있어요.</p><div class="inp"><label class="sr" for="oq">해외 제품 이름</label><input id="oq" type="search" autocomplete="off" placeholder="제품 이름 (예: Now Foods Inositol)" value="' + esc(ui.oq) + '" data-input="oq"></div><button type="button" class="cta ghost" data-act="searchOverseas">검색</button><div id="oresults" aria-live="polite">' + body + '</div></div>';
  }
  function manualHtml() {
    var idx = {};
    Pack.supplementKeyList.forEach(function (k) { idx[k.id] = k; });
    var chips = Pack.chipKeys.map(function (k) {
      return '<button type="button" class="chip' + (ui.chips.indexOf(k) > -1 ? ' on' : '') + '" aria-pressed="' + (ui.chips.indexOf(k) > -1) + '" data-act="chip" data-k="' + k + '">' + esc(idx[k].ko) + '</button>';
    }).join('');
    return '<div class="panel"><label class="lbl" for="mname">제품 이름</label><input id="mname" class="ta" autocomplete="off" placeholder="예: 나우푸드 이노시톨" value="' + esc(ui.manualName) + '" data-input="mname"><p class="lbl">들어 있는 성분 (아는 것만 골라 주세요)</p><div class="chips">' + chips + '</div><p class="note">성분을 고르면 설명서와 겹치는지 확인할 수 있어요. 모르면 비워도 등록돼요.</p><button type="button" class="cta" data-act="manualSupp">등록하기</button></div>';
  }
  VIEWS['onb-supps'] = function () {
    var panel = ui.tab === 'domestic' ? searchBlock('supp') : (ui.tab === 'overseas' ? overseasHtml() : manualHtml());
    var more = ui.params.mode === 'more', n = selectedItems('supp').length;
    return '<main class="screen has-bar">' + (more ? topbar() : obHead(2) + stepChip(2)) +
      '<h1 class="h' + (more ? '' : ' ob') + '" data-focus>같이 먹는 영양제가 있나요?</h1><p class="sub' + (more ? '' : ' ob') + '">어떤 영양제든 등록할 수 있어요. 국내 제품은 검색하고, 해외 제품이나 못 찾은 제품은 직접 입력해 주세요.</p>' +
      suppTabs() + panel +
      '<p class="lbl">고른 영양제 <span class="count" id="selcount">' + n + '</span></p><div id="selected">' + selectedHtml('supp') + '</div></main>' +
      actionBar(more
        ? '<button type="button" class="cta" data-act="to" data-view="times" data-all="1">복용 시간 입력하고 마치기</button>'
        : skipBtn('times') .replace('data-view="times"', 'data-view="times" data-mode="onb"') + '<button type="button" id="nextbtn" class="cta" data-act="to" data-view="times" data-mode="onb"' + (n ? '' : ' disabled') + '>다음</button>');
  };

  function timeRow(it) {
    var ts = (it.times && it.times.length) ? it.times : [''];
    var sub = it.productCode ? [it.ingredientEn, it.category].filter(Boolean).join(' · ') : kindLabel(it);
    return '<li class="pcard"><div class="pc-head"><div class="pc-title"><b>' + esc(nm(it)) + '</b>' + (sub ? '<span class="pc-sub">' + esc(sub) + '</span>' : '') + '</div></div><div class="tin">' + icon('clock', 20) +
      ts.map(function (t, i) { return '<input type="time" class="time" aria-label="' + esc(nm(it)) + ' 복용 시간 ' + (i + 1) + '" data-input="time" data-id="' + it.id + '" data-i="' + i + '" value="' + esc(t) + '">'; }).join('') +
      '<button type="button" class="mini" data-act="addTime" data-id="' + it.id + '" aria-label="' + esc(nm(it)) + ' 시간 추가">' + icon('plus') + '</button></div></li>';
  }
  VIEWS.times = function () {
    var p = ui.params, b = p.batch || null;
    var list = state.items.filter(function (i) { return p.all ? true : (i.batch || null) === b; });
    var onb = p.mode === 'onb';
    var foods = '';
    if (onb || p.all) {
      foods = '<p class="lbl">먹는 음식 (선택)</p><div class="inrow"><label class="sr" for="fq">음식 이름</label><input id="fq" class="ta" autocomplete="off" placeholder="예: 커피, 우유, 자몽"><button type="button" class="add" data-act="addFood">추가</button></div><div class="chips">' +
        state.foods.map(function (f) { return '<span class="chip food">' + esc(f.name) + '<button type="button" data-act="rmFood" data-id="' + f.id + '" aria-label="' + esc(f.name) + ' 삭제">' + icon('x', 12) + '</button></span>'; }).join('') +
        '</div><p class="note">음식과 약의 상호작용 확인은 준비 중이에요. 지금은 기록만 해요.</p>';
    }
    var nextLabel = onb ? '끝내고 홈으로 가기' : (p.all ? '저장하고 돌아가기' : '저장하고 결과 보기');
    return '<main class="screen has-bar">' + (onb ? obHead(3) + stepChip(3) : topbar()) +
      '<h1 class="h' + (onb ? ' ob' : '') + '" data-focus>언제 드시나요?</h1><p class="sub' + (onb ? ' ob' : '') + '">시간을 입력하면 하루 시간표가 만들어지고, 설명서에 복용 간격이 적힌 약은 간격도 볼 수 있어요. 나중에 입력해도 돼요.</p>' +
      (list.length ? '<ul class="tlist pcards">' + list.map(timeRow).join('') + '</ul>' : '<p class="muted">등록한 것이 없어요.</p>') + foods + '</main>' +
      actionBar('<button type="button" class="cta" data-act="timesDone">' + nextLabel + '</button>');
  };

  /* ---------- 홈: 하루 복약 타임라인 (docs/plan-v2.md 3-2) ----------
     케어 엔진(care.analyze)의 결과만 읽는다. 깊이 0 = 시간대 행, 깊이 1 = 약별 한 줄, 깊이 2 = 근거 시트. */
  function fmtTime(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? (+m[1]) + ':' + m[2] : t; }
  var GRADE = { official: ['공식 지정', 'official'], label: ['설명서 근거', 'label'], reference: ['참고', 'ref'] };
  function badge(g) { var x = GRADE[g] || ['확인 못 함', 'none']; return '<span class="badge ' + x[1] + '">' + x[0] + '</span>'; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : null; }
  function loadingNow() { return ui.dur.status === 'loading' || ui.care.status === 'loading'; }
  /* 약 앞 이미지 칸: 연한 회색 알약 아이콘 하나로 고정(모양·색에 따라 바꾸지 않는다) */
  var PILL = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/></svg>';
  /* 새 처방으로 추가한 약(batch가 있는 항목)에는 "새 처방" 표시만 붙인다 */
  function newRxBadge(it) { return it && it.batch ? '<span class="badge newrx">새 처방</span>' : ''; }
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
  function tline(kind, ic, text, act, data) {
    return '<button type="button" class="tline ' + kind + '" data-act="' + act + '" ' + data + '>' + icon(ic, 16) + '<span>' + esc(text) + '</span></button>';
  }
  /* 깊이 1: 약별 한 줄 */
  function timelineRow(r, m, ix, shown) {
    var it = findItem(r.itemId); if (!it) return '';
    var lines = '', nf = nonFood(r.flags);
    if (r.mealRelation && m.evidence[r.mealRelation.ruleId]) {
      lines += '<button type="button" class="tline meal" data-act="sheet" data-id="' + esc(r.mealRelation.ruleId) + '" data-item="' + r.itemId + '" aria-label="식사 관계 ' + esc(r.mealRelation.label) + ' 근거 보기">' + badge('label') + '<span>' + esc(r.mealRelation.label) + '</span></button>';
    }
    if (nf.length) {
      lines += '<div class="tline-row">' + tline('red', 'tri', nf[0].short, 'sheet', 'data-id="' + esc(nf[0].id) + '" data-item="' + r.itemId + '"') +
        (nf.length > 1 ? '<button type="button" class="tmore" data-act="detail" data-id="' + r.itemId + '">외 ' + (nf.length - 1) + '건</button>' : '') + '</div>';
    }
    if (r.foods && r.foods.length) {
      lines += tline('info', 'info', '음식: ' + r.foods.map(function (f) { return f.ko; }).join('·') + ' 주의', 'sheet', 'data-id="' + esc(r.foods[0].flagId) + '" data-item="' + r.itemId + '"');
    }
    if (ix.unc[r.itemId] && !shown['u' + r.itemId]) { shown['u' + r.itemId] = 1; lines += '<p class="tline info plain">' + icon('info', 16) + '<span>' + esc(uncoveredText(it, ix.unc[r.itemId])) + '</span></p>'; }
    return '<li class="titem"><div class="thead"><span class="tname"><span class="pillico" aria-hidden="true">' + PILL + '</span><b>' + esc(nm(it)) + (it.kind === 'supp' ? '<small>영양제</small>' : '') + '</b>' + newRxBadge(it) + '</span><time>' + esc(r.time) + '</time></div>' + lines + '</li>';
  }
  /* 깊이 0: 시간대 행 */
  function slotHtml(s, m, ix, shown) {
    var open = !!ui.open[s.id];
    var title = s.label + ' · ' + s.time + ' · 약 ' + s.summary.itemCount + '개' + (s.summary.cautionCount ? ' · 주의 ' + s.summary.cautionCount : '');
    return '<li class="slot' + (open ? ' open' : '') + '"><button type="button" class="slot-head" data-act="toggleSlot" data-id="' + s.id + '" aria-expanded="' + open + '" aria-controls="slot-' + s.id + '"><span class="slot-title"><b>' + esc(title) + '</b>' + (s.meal ? '<small>' + esc(s.meal.label + ' ' + s.meal.time) + '</small>' : '') + '</span>' +
      '<svg class="ic chev-dn" width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg></button>' +
      '<ul class="tbody" id="slot-' + s.id + '"' + (open ? '' : ' hidden') + '>' + s.items.map(function (r) { return timelineRow(r, m, ix, shown); }).join('') + '</ul></li>';
  }
  VIEWS.home = function () {
    var m = careModel(), ix = m ? indexModel(m) : null;
    var d0 = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    var sum;
    if (!state.items.length) sum = '<p class="prog-msg">먹는 약과 영양제를 등록하면 하루 복약 시간표를 만들어 드려요</p>';
    else if (loadingNow()) sum = '<p class="sumline" aria-live="polite"><b>오늘 주의 확인 중…</b></p>';
    else sum = '<p class="sumline"><b>오늘 주의 ' + (m ? m.summary.cautionCount : 0) + '개</b></p>';
    var body = '';
    if (m && state.items.length) {
      var shown = {};
      body += m.slots.length ? '<ol class="tl">' + m.slots.map(function (s) { return slotHtml(s, m, ix, shown); }).join('') + '</ol>' : '';
      if (m.unscheduled.length) {
        body += '<section class="rsec"><h2>복용 시간을 정해 주세요</h2><ul class="rlist">' + m.unscheduled.map(function (id) {
          var it = findItem(id); if (!it) return '';
          var u = ix.unc[id];
          return '<li class="rcard"><button type="button" class="rmain" data-act="to" data-view="times" data-all="1" style="padding-left:14px"><span class="rhead"><b>' + esc(nm(it)) + '</b>' + newRxBadge(it) + '</span><span class="rline info">' + icon('clock', 16) + '<span>복용 시간을 정해 주세요</span></span>' +
            (u ? '<span class="rline info">' + icon('info', 16) + '<span>' + esc(uncoveredText(it, u)) + '</span></span>' : '') + '</button></li>';
        }).join('') + '</ul></section>';
      }
      body += '<p class="fine">병용금기(공식 지정)와 설명서에서 찾은 안내만 보여드려요. 찾지 못했다고 안전하다는 뜻은 아니에요. 키핑은 의료 조언이 아니에요.</p>';
    } else if (state.items.length) {
      body += '<p class="note">설명서 기반 안내를 쓸 수 없어요. 등록한 약과 영양제는 내 약에서 볼 수 있어요.</p>';
    }
    return '<main class="screen home"><div class="home-bar">키핑</div>' +
      '<div class="home-card"><div><h1 data-focus>안녕하세요</h1><p class="home-date">' + esc(d0) + '</p></div>' + sum + '</div>' +
      '<div class="home-body">' + careStatHtml() +
      (state.example ? '<p class="banner">예시 사용자예요. 복용 이력은 가정이고, 약 정보는 실제 공식 자료예요.</p>' : '') +
      body +
      '<div class="home-actions">' +
      (!state.items.length ? '<button type="button" class="cta" data-act="to" data-view="onb-drugs">처음 설정 시작하기</button>' : '') +
      '<button type="button" class="cta ' + (state.example ? 'ghost' : '') + '" data-act="newRx">새 약 추가하기</button>' +
      (state.example ? '<button type="button" class="cta" data-act="demoRx">새 처방 알림 시연 보기</button>' : '') + '</div></div></main>' + nav('home');
  };

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
    var n = selectedItems('drug').length;
    return '<main class="screen has-bar">' + topbar() + '<h1 class="h" data-focus>새로 받은 약을 추가해요</h1><p class="sub">받은 약을 모두 추가하면, 지금 먹는 것과 겹치는 내용만 골라서 보여드려요.</p>' +
      searchBlock('drug') + '<p class="lbl">이번에 받은 약 <span class="count" id="selcount">' + n + '</span></p><div id="selected">' + selectedHtml('drug') + '</div></main>' +
      actionBar('<button type="button" id="nextbtn" class="cta" data-act="confirmAdd"' + (n ? '' : ' disabled') + '>추가하기</button>');
  };

  VIEWS.notify = function () {
    return '<main class="screen lockscreen"><p class="clock-date">' + esc(new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })) + '</p>' +
      '<button type="button" class="push" data-act="demoConfirm"><span class="app"><i></i>키핑 · 지금</span><span class="ptxt">새 처방약이 등록됐어요.<br>이번에 받은 약 4개를 시간표에 넣어 볼까요?</span></button>' +
      '<p class="hint">알림을 눌러 보세요</p><p class="fine light">시연 화면이에요. 실제 처방 정보 연동은 구현하지 않았어요.</p>' +
      '<button type="button" class="cta ghost light" data-act="back">돌아가기</button></main>';
  };

  /* ---------- 깊이 2: 근거 시트 / 약 상세 ---------- */
  function metaRow(label, value, tipHtml) {
    return '<div class="meta"><b>' + esc(label) + '</b><span>' + value + '</span>' + (tipHtml || '') + '</div>';
  }
  function dateOf(x) { return x ? String(x).slice(0, 10) : null; }
  /* 근거 카드: 등급 배지 · 헤드라인 · 조건/항목 · 원문 그대로 · 위치 · 출처 · 확인일. 요약하지 않는다. */
  function evidenceCard(ev) {
    var url = safeUrl(ev.source && ev.source.url), chk = dateOf(ev.source && ev.source.checkedAt);
    return '<article class="evcard">' + badge(ev.grade) + '<h2 class="evh">' + esc(ev.headline) + '</h2>' +
      (ev.detail ? '<p class="evd"><b>' + (ev.grade === 'official' ? '조건' : '항목') + '</b> ' + esc(ev.detail) + '</p>' : '') +
      (ev.excerpt ? '<blockquote class="evq"><small>원문' + (ev.where ? ' · ' + esc(ev.where) : '') + '</small><p>' + esc(ev.excerpt) + '</p></blockquote>' : '') +
      '<p class="src"><span>' + esc((ev.source && ev.source.label) || '') + '</span>' + (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener">원문 보기</a>' : '') + '<small>확인일 ' + esc(chk || '확인하지 못했어요') + '</small></p></article>';
  }
  var HELP_FOOT = '<p class="evfoot">이상 증상이 있으면 약사·의사에게 물어보세요.</p>';
  VIEWS.sheet = function () {
    var m = careModel(), ev = m && m.evidence[ui.params.id];
    if (!ev) return VIEWS.home();
    var flag = null;
    m.slots.forEach(function (s) { s.items.forEach(function (r) { r.flags.forEach(function (f) { if (f.id === ui.params.id && !flag) flag = f; }); }); });
    var owner = findItem(ui.params.item);
    var withNames = flag ? flag.withItemIds.map(function (id) { var x = findItem(id); return x ? nm(x) : ''; }).filter(Boolean) : [];
    return '<main class="screen sheet">' + topbar('근거') +
      (owner ? '<p class="evwho">' + esc(nm(owner)) + (withNames.length ? ' · 함께 등록한 것: ' + esc(withNames.join(', ')) : '') + '</p>' : '') +
      evidenceCard(ev).replace('<h2 class="evh">', '<h1 class="evh" data-focus>').replace('</h2>', '</h1>') + HELP_FOOT + '</main>';
  };
  VIEWS.detail = function () {
    var item = findItem(ui.params.id);
    if (!item) return VIEWS.home();
    var m = careModel(), ix = m ? indexModel(m) : null, r = ix && ix.rows[item.id] ? ix.rows[item.id][0] : null;
    var t = activeTimes(item);
    var html = '<main class="screen">' + topbar() + '<h1 class="h" data-focus>' + esc(nm(item)) + '</h1><p class="sub">' + esc(kindLabel(item)) + ' · ' + esc(t.length ? t.join(' · ') : '시간 미정') + '</p>';
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
      '<p class="fine">키핑은 의료 조언이 아니에요. 약과 영양제를 함께 복용해도 되는지는 약사나 의사에게 확인해 주세요. 출처: 식약처 의약품 제품 허가정보, DUR, 의약품안전나라, 식품안전나라.</p></main>' + nav('settings');
  };

  /* ---------- 흐름 ---------- */
  var splashTimer = null;
  function render(top) {
    var y = window.scrollY;
    var v = (VIEWS[ui.view] || VIEWS.home)();
    root.innerHTML = v;
    clearTimeout(splashTimer);
    if (ui.view === 'splash') splashTimer = setTimeout(function () { if (ui.view === 'splash') go('welcome'); }, 1600);
    if (top === false) window.scrollTo(0, y);
    else {
      window.scrollTo(0, 0);
      var h = root.querySelector('[data-focus]');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }
  function go(view, params, keepScroll) {
    ui.prev = { view: ui.view, params: ui.params };
    ui.view = view; ui.params = params || {};
    ui.more = false;
    ui.q = ''; ui.oq = ''; ui.results = null; ui.remote = null; ui.overseas = null; ui.chips = []; ui.manualName = '';
    if (view !== 'onb-supps') ui.tab = 'domestic';
    render(!keepScroll);
    runSearch();
  }
  function newBatchId() { return 'rx-' + Date.now().toString(36); }

  /* 시연용 약 하나를 만든다. 전체 약 목록이 있으면 dur.search로 찾은 제품코드 항목, 없으면 데이터 팩(itemSeq) 항목. */
  function demoDrug(query, seq, time, extra) {
    var hit = Pack.dur && Pack.dur.search(query, { limit: 1 })[0];
    if (hit) return newItem(Object.assign(Pack.dur.toItem(hit.code), { times: [time] }, extra || {}));
    var r = Pack.drugs.filter(function (d) { return d.itemSeq === seq; })[0];
    return newItem(Object.assign({ kind: 'drug', source: 'pack', itemSeq: seq, name: r.display || r.name, times: [time] }, extra || {}));
  }
  function loadExample() {
    state = Store.fresh(); state.example = true;
    var itra = demoDrug('이트코나졸캡슐', '200000913', '08:30');   // 수출용 코니트라캡슐 대신 급여목록 제품(전체 약 목록이 없을 때만 코니트라캡슐)
    var s = Pack.supplements[0];
    var vitc = newItem({ kind: 'supp', source: 'domestic', name: s.name, reportNo: s.reportNo, company: s.company, ingredientRaw: s.ingredientRaw, ingredientKeys: s.ingredientKeys.slice(), times: ['13:30'] });
    var iron = newItem({ kind: 'supp', source: 'manual', name: '철분제 (예시)', ingredientKeys: ['iron'], times: ['09:30'] });
    state.items = [itra, vitc, iron];
    state.foods = [{ id: Store.uid(), name: '커피' }];
    save();
  }
  function addDemoBatch() {
    var b = 'rx-demo';
    state.items = state.items.filter(function (i) { return i.batch !== b; });
    [['시바스', '200403126', '21:00'], ['이텍스시메티딘', '200402420', '09:00'], ['알마겔에프', '199000541', '08:00'], ['후로스판', '198801649', '12:30']].forEach(function (p) {
      state.items.push(demoDrug(p[0], p[1], p[2], { batch: b }));
    });
    state.lastBatch = b; save();
    return b;
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
      var id = t.dataset.id; ui.open[id] = !ui.open[id];
      t.setAttribute('aria-expanded', String(!!ui.open[id]));
      var b = document.getElementById('slot-' + id);
      if (b) { if (ui.open[id]) b.removeAttribute('hidden'); else b.setAttribute('hidden', ''); }
      var li = t.closest('.slot'); if (li) li.classList.toggle('open', !!ui.open[id]);
    },
    sheet: function (t) { go('sheet', { id: t.dataset.id, item: t.dataset.item }); },
    demo: function () {
      function run() { loadExample(); go('home'); }
      if (ui.dur.status !== 'loading') return run();
      toast('약 목록을 불러오는 중이에요. 끝나면 바로 시작할게요');
      bootPromise.then(run);
    },
    to: function (t) {
      var v = t.dataset.view, p = {};
      if (t.dataset.mode) p.mode = t.dataset.mode;
      if (t.dataset.all) p.all = true;
      if (t.dataset.batch) p.batch = t.dataset.batch;
      go(v, p);
    },
    nav: function (t) { var p = {}; if (t.dataset.scope) p.scope = t.dataset.scope; go(t.dataset.view, p); },
    back: function () { var p = ui.prev; if (!p || p.view === ui.view) go(state.items.length ? 'home' : 'welcome'); else go(p.view, p.params); },
    detail: function (t) { go('detail', { id: t.dataset.id }); },
    newRx: function (t) { go('add', { batch: t.dataset.batch || newBatchId() }); },
    demoRx: function () { go('notify'); },
    demoConfirm: function () { var b = addDemoBatch(); go('home'); },
    confirmAdd: function () {
      if (!selectedItems('drug').length) { toast('추가한 약이 없어요'); return; }
      state.lastBatch = ui.params.batch; save();
      go('home');
    },
    pick: function (t) {
      var x = ui.results && ui.results[+t.dataset.i]; if (!x) return;
      var b = batchOf();
      if (currentKind() === 'drug' && x.source === 'dur') {
        var di = Pack.dur && Pack.dur.toItem(x.code);
        if (!di) { toast('이 약을 불러오지 못했어요'); return; }
        state.items.push(newItem(Object.assign(di, { batch: b })));
      } else if (currentKind() === 'drug') {
        state.items.push(newItem({ kind: 'drug', source: x.source, itemSeq: x.itemSeq, name: x.name, ingredientKo: x.ingredientKo || null, type: x.type || null, batch: b }));
      } else {
        var s = x.supp;
        state.items.push(newItem({ kind: 'supp', source: 'domestic', name: s.name, reportNo: s.reportNo, company: s.company, ingredientRaw: s.ingredientRaw, ingredientKeys: (s.ingredientKeys || []).slice(), batch: b }));
      }
      save(); toast(x.name + ' 추가했어요'); refreshLists();
    },
    manualDrug: function () {
      var name = ui.q.trim(); if (!name) return;
      state.items.push(newItem({ kind: 'drug', source: 'manual', name: name, batch: batchOf() }));
      save(); toast(name + ' 등록했어요'); ui.q = ''; var q = document.getElementById('q'); if (q) q.value = '';
      runSearch(); refreshLists();
    },
    remove: function (t) { state.items = state.items.filter(function (i) { return i.id !== t.dataset.id; }); save(); refreshLists(); },
    removeAsk: function (t) {
      var it = findItem(t.dataset.id); if (!it) return;
      if (window.confirm(nm(it) + '을(를) 목록에서 지울까요?')) { state.items = state.items.filter(function (i) { return i.id !== it.id; }); save(); render(false); }
    },
    tab: function (t) { ui.tab = t.dataset.tab; ui.results = null; ui.q = ''; render(false); runSearch(); },
    chip: function (t) {
      var k = t.dataset.k, i = ui.chips.indexOf(k);
      if (i > -1) ui.chips.splice(i, 1); else ui.chips.push(k);
      t.classList.toggle('on', i < 0); t.setAttribute('aria-pressed', String(i < 0));
    },
    manualSupp: function () {
      var inp = document.getElementById('mname'); var name = (inp ? inp.value : ui.manualName).trim();
      if (!name && !ui.chips.length) { toast('이름이나 성분을 하나 입력해 주세요'); return; }
      if (!name) name = ui.chips.map(function (k) { return Pack.supplementKeyList.filter(function (x) { return x.id === k; })[0].ko; }).join(' · ');
      state.items.push(newItem({ kind: 'supp', source: 'manual', name: name, ingredientKeys: ui.chips.slice(), batch: batchOf() }));
      save(); toast(name + ' 등록했어요');
      ui.chips = []; ui.manualName = ''; render(false);
    },
    searchOverseas: function () {
      var inp = document.getElementById('oq'); var q = (inp ? inp.value : ui.oq).trim();
      if (!q) { toast('제품 이름을 입력해 주세요'); return; }
      ui.overseas = { status: 'loading', results: [] };
      render(false);
      Api.searchOverseas(q).then(function (res) { ui.overseas = res; render(false); });
    },
    pickOverseas: function (t) {
      var x = ui.overseas && ui.overseas.results[+t.dataset.i]; if (!x) return;
      var keys = []; (x.ingredients || []).forEach(function (n) { var k = E.mapIngredient(n, Pack); if (k && keys.indexOf(k) < 0) keys.push(k); });
      state.items.push(newItem({ kind: 'supp', source: 'dsld', name: x.name, company: x.brand || '', ingredientKeys: keys, batch: batchOf() }));
      save(); toast(x.name + ' 추가했어요'); render(false);
    },
    addTime: function (t) { var it = findItem(t.dataset.id); if (!it) return; it.times = it.times && it.times.length ? it.times.concat(['']) : ['', '']; save(); render(false); },
    timesDone: function () {
      var p = ui.params;
      if (p.mode === 'onb') go('home');
      else if (p.all) go('home');
      else go('home');
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

  root.addEventListener('click', function (e) {
    if (!e.target.closest('.tipwrap')) closeTips();
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var f = Acts[t.getAttribute('data-act')];
    if (f) f(t, e);
  });
  root.addEventListener('input', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-input');
    if (k === 'search') { ui.q = t.value; clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 150); }
    else if (k === 'mname') ui.manualName = t.value;
    else if (k === 'oq') ui.oq = t.value;
  });
  root.addEventListener('change', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-input');
    if (k === 'time') {
      var it = findItem(t.dataset.id); if (!it) return;
      var i = +t.dataset.i; it.times = it.times && it.times.length ? it.times.slice() : [''];
      it.times[i] = t.value; it.updatedAt = new Date().toISOString(); save();
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
    else if (id === 'oq') Acts.searchOverseas();
    else if (id === 'mname') Acts.manualSupp();
  });

  ui.view = state.items.length ? 'home' : 'splash';
  var durReady = bootDur();   // 약 목록은 첫 화면과 상관없이 바로 불러오기 시작
  var careReady = bootCare(); // 설명서 기반 안내 데이터는 약 목록이 온 뒤 읽는다
  /* 첫 화면은 글꼴(SUIT)이 도착한 뒤에 그린다(최대 1.2초). 글꼴이 늦게 와서 문단이 다시 줄바꿈되며 화면이 튀는 것을 막는다. */
  var booted = false;
  function boot() { if (booted) return; booted = true; render(true); }
  if (document.fonts && document.fonts.load) {
    Promise.race([Promise.all([400, 500, 600, 700].map(function (w) { return document.fonts.load(w + ' 16px SUIT'); })), new Promise(function (r) { setTimeout(r, 1200); })]).then(boot, boot);
  } else boot();
  window.KeepingApp = { state: function () { return state; }, go: go, ui: ui, bootDur: bootDur, bootCare: bootCare, careModel: careModel, careItems: careItems };
})();
