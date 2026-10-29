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
    chips: [], manualName: '', searchToken: 0, photo: null, photoToken: 0,
    dur: { status: 'loading' }
  };
  var searchTimer = null;

  /* ---------- 도구 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var ICONS = {
    chev: '<path d="M6 3l5 5-5 5"/>', back: '<path d="M10 3L5 8l5 5"/>',
    check: '<path d="M3 8.5l3.2 3.2L13 4.5"/>', plus: '<path d="M8 3v10M3 8h10"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>', alert: '<path d="M8 3.5v5.5"/><path d="M8 12.2h.01"/>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
    info: '<circle cx="10" cy="10" r="8"/><path d="M10 9v5"/><path d="M10 6.3h.01"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>',
    list: '<path d="M3 4h10M3 8h10M3 12h10"/>',
    camera: '<path d="M2 5.5h2.5L5.5 4h5l1 1.5H14v7H2z"/><circle cx="8" cy="9" r="2.2"/>',
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
  function stepbar(n) {
    return '<div class="stepbar" role="img" aria-label="3단계 중 ' + n + '단계">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= n ? 'on' : '') + '"></span>'; }).join('') + '</div>';
  }
  function nav(cur) {
    function b(v, label, ic) {
      return '<button type="button" data-act="nav" data-view="' + v + '"' + (cur === v ? ' aria-current="page" class="on"' : '') + '>' + icon(ic, 22) + '<span>' + label + '</span></button>';
    }
    return '<nav class="nav" aria-label="주 메뉴">' + b('home', '내 하루', 'clock') + b('list', '내 목록', 'list') + b('settings', '설정', 'gear') + '</nav>';
  }
  /* 제품코드로 등록한 약은 전체 약 목록(DUR)이 와야 확인할 수 있다. 오는 중에는 "확인 범위 밖"이 아니라 "불러오는 중". */
  function durPending(it) { return !!(it && it.kind === 'drug' && it.productCode && !Pack.dur && ui.dur.status === 'loading'); }
  function statusPill(a) {
    if (durPending(a.item)) return '<span class="pill soft">불러오는 중</span>';
    if (a.status === 'attention') return '<span class="pill flag"><i class="dot"></i>확인 필요</span>';
    if (a.status === 'unchecked') return '<span class="pill dashed">확인 못 함</span>';
    if (a.status === 'scope') return '<span class="pill soft">공식 정보 있음</span>';
    return '';
  }
  function counterpartLine(a) {
    var names = [];
    a.findings.forEach(function (f) { if (names.indexOf(f.withName) < 0) names.push(f.withName); });
    if (!names.length) return '';
    var s = E.josa(names[0], '과', '와') + ' 확인';
    if (names.length > 1) s = names[0] + ' 외 ' + (names.length - 1) + '개와 확인';
    return '<span class="sub2">' + esc(s) + '</span>';
  }
  function rowHtml(a) {
    var flag = a.status === 'attention';
    return '<button type="button" class="row' + (flag ? ' flag' : '') + '" data-act="detail" data-id="' + a.item.id + '"><span class="row-main"><b>' + esc(nm(a.item)) + '</b>' + (flag ? counterpartLine(a) : '') + '</span>' + statusPill(a) + icon('chev') + '</button>';
  }

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
    return '<div class="search"><label class="sr" for="q">' + (kind === 'drug' ? '약 이름 검색' : '영양제 이름 검색') + '</label><div class="inp">' + icon('search', 18) + '<input id="q" type="search" inputmode="search" autocomplete="off" placeholder="' + ph + '" value="' + esc(ui.q) + '" data-input="search"></div>' + photoBlock() + (kind === 'drug' ? '<div id="durstat" aria-live="polite">' + durHtml() + '</div>' : '') + '<div id="results" aria-live="polite">' + resultsHtml(kind) + '</div></div>';
  }
  /* ---------- 전체 약 목록(DUR) 불러오기 ----------
     실패해도 기존 데이터 팩 모드로 계속 동작한다. 약 4MB, 처음 한 번만 걸린다. */
  function durHtml() {
    if (ui.dur.status === 'loading') return '<p class="muted pad">약 목록을 불러오는 중…</p>';
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
      if (['home', 'list', 'result', 'detail', 'settings'].indexOf(ui.view) > -1) render(false); // 확인 결과가 달라질 수 있는 화면만 다시 그린다
    });
    return bootPromise;
  }

  /* ---------- 사진으로 찾기 (기기 안 글자 인식) ----------
     사진은 이 기기 안에서만 읽고 저장하지 않는다. 읽은 글자는 검색창을 채울 뿐, 등록은 사용자가 고른다. */
  var OCR_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  function photoBlock() {
    return '<div class="photo"><label class="cta ghost small photobtn" for="photo">' + icon('camera', 18) + '<span>사진으로 찾기</span></label><input id="photo" class="sr" type="file" accept="image/*" data-input="photo"></div>' +
      '<p class="muted">사진은 이 기기 안에서만 읽고 저장하지 않아요. 글자 인식은 틀릴 수 있어요.</p><div id="photostat" aria-live="polite">' + photoHtml() + '</div>';
  }
  function photoHtml() {
    var p = ui.photo; if (!p) return '';
    var img = p.url ? '<img class="ocr-img" src="' + p.url + '" alt="고른 사진 미리보기">' : '';
    if (p.status === 'loading') return '<div class="ocr-box">' + img + '<p class="muted" id="photomsg">' + esc(p.msg || '글자를 읽는 중…') + '</p></div>';
    if (p.status === 'error') return '<div class="ocr-box"><p class="note">' + esc(p.msg) + '</p></div>';
    var msg = !p.tokens.length ? '글자를 읽지 못했어요. 글자가 크게 보이게 밝은 곳에서 다시 찍어 보거나, 이름을 직접 입력해 주세요.'
      : (p.found ? '사진에서 읽은 글자로 검색했어요. 아래 결과에서 맞는 것을 눌러 추가해 주세요. 다르면 다른 글자를 눌러 보세요.'
        : '사진에서 찾는 이름을 찾지 못했어요. 읽은 글자 중 맞는 것을 눌러 보거나, 이름을 직접 입력해 주세요.');
    var chips = p.tokens.slice(0, 12).map(function (t) {
      return '<button type="button" class="chip' + (ui.q === t ? ' on' : '') + '" data-act="photoTok" data-t="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    return '<div class="ocr-box">' + img + '<p class="muted">' + msg + '</p>' + (chips ? '<div class="chips">' + chips + '</div>' : '') + '</div>';
  }
  function setPhotoStat() { var el = document.getElementById('photostat'); if (el) el.innerHTML = photoHtml(); }
  function resetPhoto() {
    ui.photoToken++;
    if (ui.photo && ui.photo.url) URL.revokeObjectURL(ui.photo.url);
    ui.photo = null;
  }
  function loadOcr() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise(function (res, rej) {
      var sc = document.createElement('script'); sc.src = OCR_SRC; sc.onload = res;
      sc.onerror = function () { rej(new Error('load')); };
      document.head.appendChild(sc);
    });
  }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var sc = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('blob')); }, 'image/jpeg', 0.92);
      };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('img')); };
      img.src = u;
    });
  }
  function extractTokens(text) {
    var seen = {}, out = [];
    function add(t) { if (t.length < 2 || /^\d+$/.test(t) || seen[t]) return; seen[t] = 1; out.push(t); }
    String(text || '').split(/\n/).forEach(function (line) {
      (line.match(/[가-힣A-Za-z0-9]{2,}/g) || []).forEach(add);
      (line.replace(/\s+/g, '').match(/[가-힣]{2,}/g) || []).forEach(add); // "시 바 스 정" 처럼 띄어 읽힌 글자
    });
    return out.slice(0, 30);
  }
  function findMatch(tokens, kind, i) {
    if (i >= tokens.length || i >= 12) return Promise.resolve(null);
    return (kind === 'drug' ? Api.searchDrugs : Api.searchSupplements)(tokens[i]).then(function (r) {
      return r.results.length ? tokens[i] : findMatch(tokens, kind, i + 1);
    });
  }
  function searchFor(q) {
    ui.q = q; ui.results = null;
    var inp = document.getElementById('q'); if (inp) inp.value = q;
    refreshLists(); runSearch();
  }
  function applyOcrText(text, tok) {
    var kind = currentKind(), tokens = extractTokens(text);
    var byLen = tokens.slice().sort(function (a, b) { return b.length - a.length; }); // 긴 글자가 이름일 가능성이 높다
    return findMatch(byLen, kind, 0).then(function (found) {
      if (tok !== ui.photoToken) return;
      if (ui.photo && ui.photo.url) { URL.revokeObjectURL(ui.photo.url); }
      ui.photo = { status: 'done', tokens: tokens, found: found, url: null };
      if (found) searchFor(found);
      setPhotoStat();
    });
  }
  function readPhoto(file) {
    resetPhoto();
    var tok = ui.photoToken;
    ui.photo = { status: 'loading', msg: '사진을 준비하는 중…', url: URL.createObjectURL(file) };
    setPhotoStat();
    function say(m) { if (tok !== ui.photoToken || !ui.photo) return; ui.photo.msg = m; var el = document.getElementById('photomsg'); if (el) el.textContent = m; }
    shrink(file).then(function (blob) {
      say('글자 인식 도구를 불러오는 중…');
      return loadOcr().then(function () {
        return window.Tesseract.recognize(blob, 'kor', { logger: function (m) {
          if (m.status === 'loading language traineddata') say('한글 인식 파일을 내려받는 중이에요. 처음 한 번만 받아요.');
          else if (m.status === 'recognizing text') say('글자를 읽는 중 ' + Math.round(m.progress * 100) + '%');
        } });
      });
    }).then(function (r) { return applyOcrText(r.data.text, tok); })
      .catch(function () {
        if (tok !== ui.photoToken) return;
        if (ui.photo && ui.photo.url) URL.revokeObjectURL(ui.photo.url);
        ui.photo = { status: 'error', msg: '사진을 읽지 못했어요. 인터넷 연결을 확인하고 다시 해 보거나, 이름을 직접 입력해 주세요.', url: null };
        setPhotoStat();
      });
  }
  function selectedItems(kind) {
    var b = (ui.view === 'add') ? (ui.params.batch || null) : null;
    return state.items.filter(function (it) { return it.kind === kind && (it.batch || null) === b; });
  }
  function selectedHtml(kind) {
    var list = selectedItems(kind);
    if (!list.length) return '<p class="muted">아직 고른 것이 없어요.</p>';
    return '<ul class="sel">' + list.map(function (it) {
      return '<li><span><b>' + esc(nm(it)) + '</b><small>' + esc(kindLabel(it)) + '</small></span><button type="button" class="rm" data-act="remove" data-id="' + it.id + '" aria-label="' + esc(nm(it)) + ' 삭제">' + icon('x') + '</button></li>';
    }).join('') + '</ul>';
  }
  function refreshLists() {
    var kind = currentKind();
    var r = document.getElementById('results'); if (r) r.innerHTML = resultsHtml(kind);
    var s = document.getElementById('selected'); if (s) s.innerHTML = selectedHtml(kind);
    var n = document.getElementById('nextbtn');
    if (n && ui.view === 'add') n.disabled = selectedItems('drug').length === 0;
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

  VIEWS.welcome = function () {
    return '<main class="screen welcome"><p class="brand">키핑</p><h1 class="h xl" data-focus>내가 먹는 약과 영양제,<br>겹치는 것만 알려드려요</h1><p class="sub">약을 새로 받을 때마다 지금 먹는 것과 겹치는 내용만 골라서 보여드려요. 건강정보는 이 기기에만 저장돼요.</p><div class="stack"><button type="button" class="cta" data-act="start">시작하기</button><button type="button" class="cta ghost" data-act="demo">예시 사용자로 체험하기</button></div><p class="fine">키핑은 의료 조언이 아니에요. 공식 자료에서 확인한 범위만 보여드리고, 판단은 약사에게 확인해 주세요.</p></main>';
  };

  VIEWS['onb-drugs'] = function () {
    var edit = ui.params.mode === 'edit';
    return '<main class="screen">' + topbar() + (edit ? '' : stepbar(1)) +
      '<h1 class="h" data-focus>' + (edit ? '지금 먹는 약' : '지금 먹는 약을 알려주세요') + '</h1><p class="sub">' + (edit ? '먹는 약을 더하거나 뺄 수 있어요.' : '약 이름을 검색해서 골라 주세요. 약 종류와 성분은 자동으로 채워져요.') + '</p>' +
      searchBlock('drug') +
      '<p class="soon">처방 정보를 자동으로 불러오는 기능은 준비 중이에요.</p>' +
      '<p class="lbl">고른 약</p><div id="selected">' + selectedHtml('drug') + '</div>' +
      '<div class="actions">' + (edit
        ? '<button type="button" class="cta" data-act="nav" data-view="list">완료</button>'
        : '<button type="button" class="cta" data-act="to" data-view="onb-supps">다음</button>') + '</div></main>';
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
    var more = ui.params.mode === 'more';
    return '<main class="screen">' + topbar() + (more ? '' : stepbar(2)) +
      '<h1 class="h" data-focus>같이 먹는 영양제가 있나요?</h1><p class="sub">어떤 영양제든 등록할 수 있어요. 국내 제품은 검색하고, 해외 제품이나 못 찾은 제품은 직접 입력해 주세요.</p>' +
      suppTabs() + panel +
      '<p class="lbl">고른 영양제</p><div id="selected">' + selectedHtml('supp') + '</div>' +
      '<div class="actions">' + (more
        ? '<button type="button" class="cta" data-act="to" data-view="times" data-all="1">복용 시간 입력하고 마치기</button>'
        : '<button type="button" class="cta" data-act="to" data-view="times" data-mode="onb">다음</button>') + '</div></main>';
  };

  function timeRow(it) {
    var ts = (it.times && it.times.length) ? it.times : [''];
    return '<li class="trow"><div class="tname"><b>' + esc(nm(it)) + '</b><small>' + esc(kindLabel(it)) + '</small></div><div class="tin">' +
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
    var nextLabel = onb ? '끝내고 내 하루 보기' : (p.all ? '저장하고 돌아가기' : '저장하고 결과 보기');
    return '<main class="screen">' + topbar() + (onb ? stepbar(3) : '') +
      '<h1 class="h" data-focus>언제 드시나요?</h1><p class="sub">시간을 입력하면 하루 시간표가 만들어지고, 설명서에 복용 간격이 적힌 약은 간격도 볼 수 있어요. 나중에 입력해도 돼요.</p>' +
      (list.length ? '<ul class="tlist">' + list.map(timeRow).join('') + '</ul>' : '<p class="muted">등록한 것이 없어요.</p>') + foods +
      '<div class="actions"><button type="button" class="cta" data-act="timesDone">' + nextLabel + '</button></div></main>';
  };

  function timelineHtml() {
    var T = 44, entries = [];
    state.items.forEach(function (it) { activeTimes(it).forEach(function (t) { entries.push({ it: it, t: t, h: E.toHours(t) }); }); });
    if (!entries.length) return '';
    var hs = entries.map(function (e) { return e.h; });
    var H0 = Math.min(6, Math.floor(Math.min.apply(null, hs))), H1 = Math.max(22, Math.ceil(Math.max.apply(null, hs)) + 1);
    var checks = E.intervalChecks(state.items, Pack), flag = {}, wins = '', seen = {};
    checks.forEach(function (c) {
      if (c.close) { flag[c.ownerId] = 1; flag[c.otherId] = 1; }
      var owner = findItem(c.ownerId);
      activeTimes(owner).forEach(function (t) {
        var k = c.ownerId + t; if (seen[k]) return; seen[k] = 1;
        wins += '<div class="win" style="top:' + ((E.toHours(t) - H0) * T) + 'px;height:' + (c.maxH * T) + 'px"><span>설명서 안내 간격 ' + c.minH + '~' + c.maxH + '시간</span></div>';
      });
    });
    entries.sort(function (a, b) { return a.h - b.h; });
    var lanes = [];
    entries.forEach(function (e) {
      var li = 0;
      while (li < lanes.length && lanes[li] > e.h) li++;
      lanes[li] = e.h + 0.9; e.lane = li;
    });
    var nl = Math.max(1, lanes.length);
    var evs = entries.map(function (e) {
      var cls = 'ev ' + (e.it.kind === 'drug' ? 'drug' : 'supp') + (flag[e.it.id] ? ' flag' : '');
      return '<button type="button" class="' + cls + '" data-act="detail" data-id="' + e.it.id + '" style="top:' + ((e.h - H0) * T) + 'px;left:' + (e.lane * 100 / nl) + '%;width:' + (100 / nl) + '%">' + (flag[e.it.id] ? icon('alert', 14) : '') + '<span class="ev-name">' + esc(nm(e.it)) + '</span><em>' + esc(e.t) + '</em></button>';
    }).join('');
    var hrs = '';
    for (var h = H0; h <= H1; h += 2) hrs += '<div class="hr" style="top:' + ((h - H0) * T) + 'px">' + String(h).padStart(2, '0') + '시</div>';
    return '<div class="tl" style="height:' + ((H1 - H0) * T) + 'px">' + hrs + wins + '<div class="evs">' + evs + '</div></div>';
  }

  VIEWS.home = function () {
    var checks = E.intervalChecks(state.items, Pack).filter(function (c) { return c.close; })
      .sort(function (a, b) { return a.gapHours - b.gapHours; }); // 가장 가까운 간격을 먼저
    var att = E.analyze(state.items, Pack).filter(function (a) { return a.status === 'attention'; });
    var tl = timelineHtml();
    var head, sub;
    if (checks.length) {
      var c = checks[0], o = nm(findItem(c.ownerId)), x = nm(findItem(c.otherId));
      head = E.josa(o, '과', '와') + ' ' + E.josa(x, '이', '가') + ' ' + fmtGap(c.gapHours) + '시간 차예요';
      sub = '설명서가 안내한 복용 간격(' + c.minH + '~' + c.maxH + '시간)보다 가까워요. 약사에게 확인해 보세요.' + (checks.length > 1 ? ' (외 ' + (checks.length - 1) + '건)' : '');
    } else if (tl) {
      head = '오늘의 복용 시간표';
      sub = '설명서에 적힌 복용 간격과 가까운 시간은 찾지 못했어요. 안전하다는 뜻은 아니에요.';
    } else {
      head = state.items.length ? '복용 시간을 입력해 보세요' : '아직 등록한 것이 없어요';
      sub = state.items.length ? '시간을 입력하면 하루 시간표가 만들어져요.' : '먹는 약과 영양제를 등록하면 겹치는 것만 알려드려요.';
    }
    var d = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    return '<main class="screen has-nav"><div class="hdr"><p class="tag">' + esc(d) + '</p><h1 class="h" data-focus>' + esc(head) + '</h1><p class="sub">' + esc(sub) + '</p></div>' +
      (state.example ? '<p class="banner">예시 사용자예요. 복용 이력은 가정이고, 약 정보는 실제 공식 자료예요.</p>' : '') +
      (att.length ? '<button type="button" class="row flag" data-act="nav" data-view="result" data-scope="all"><span class="row-main"><b>확인이 필요한 것 ' + att.length + '개</b><span class="sub2">눌러서 이유를 볼 수 있어요</span></span>' + icon('chev') + '</button>' : '') +
      tl +
      (!state.items.length ? '<button type="button" class="cta" data-act="to" data-view="onb-drugs">처음 설정 시작하기</button>' : '') +
      (!tl && state.items.length ? '<button type="button" class="cta" data-act="to" data-view="times" data-all="1">복용 시간 입력하기</button>' : '') +
      '<div class="stack pad-top"><button type="button" class="cta ' + (state.example ? 'ghost' : '') + '" data-act="newRx">새 약 추가하기</button>' +
      (state.example ? '<button type="button" class="cta" data-act="demoRx">새 처방 알림 시연 보기</button>' : '') + '</div></main>' + nav('home');
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
      '</div><div class="stack pad-top"><button type="button" class="cta" data-act="newRx">새 약 추가하기</button><button type="button" class="cta ghost" data-act="to" data-view="onb-drugs">처음부터 다시 설정하기</button></div></main>' + nav('list');
  };

  VIEWS.add = function () {
    var n = selectedItems('drug').length;
    return '<main class="screen">' + topbar() + '<h1 class="h" data-focus>새로 받은 약을 추가해요</h1><p class="sub">받은 약을 모두 추가하면, 지금 먹는 것과 겹치는 내용만 골라서 보여드려요.</p>' +
      searchBlock('drug') + '<p class="lbl">이번에 받은 약</p><div id="selected">' + selectedHtml('drug') + '</div>' +
      '<div class="actions"><button type="button" id="nextbtn" class="cta" data-act="confirmAdd"' + (n ? '' : ' disabled') + '>겹치는 내용 확인하기</button></div></main>';
  };

  VIEWS.notify = function () {
    return '<main class="screen lockscreen"><p class="clock-date">' + esc(new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })) + '</p>' +
      '<button type="button" class="push" data-act="demoConfirm"><span class="app"><i></i>키핑 · 지금</span><span class="ptxt">처방약을 받으셨네요.<br>이번에 받은 약 4개를 확인해 볼까요?</span></button>' +
      '<p class="hint">알림을 눌러 보세요</p><p class="fine light">시연 화면이에요. 실제 처방 정보 연동은 준비 중이에요.</p>' +
      '<button type="button" class="cta ghost light" data-act="back">돌아가기</button></main>';
  };

  VIEWS.result = function () {
    var all = E.analyze(state.items, Pack);
    var scopeAll = ui.params.scope === 'all';
    var batch = ui.params.batch || state.lastBatch || null;
    var rows = all.filter(function (a) { return a.item.kind === 'drug' && (scopeAll || (a.item.batch || null) === batch); });
    if (!rows.length) rows = all.filter(function (a) { return a.item.kind === 'drug'; });
    var supps = all.filter(function (a) { return a.item.kind === 'supp'; });
    var flagged = rows.filter(function (a) { return a.status === 'attention'; }).length;
    var suppFlag = supps.filter(function (a) { return a.status === 'attention'; }).length;
    var total = flagged + suppFlag;
    var title = scopeAll ? '내가 먹는 약' : '이번에 받은 약 ' + rows.length + '개';
    var pendingAny = rows.concat(supps).some(function (a) { return durPending(a.item); });
    var sub = pendingAny ? '약 목록을 불러오는 중이에요. 끝나면 겹치는 내용을 확인해서 보여드려요.' : total
      ? '<b class="red">' + (flagged + suppFlag) + '개</b>는 확인이 필요해요. 눌러서 이유를 볼 수 있어요.'
      : '확인한 자료에서 겹치는 내용을 찾지 못했어요.';
    var needTimes = rows.some(function (a) { return !activeTimes(a.item).length; });
    return '<main class="screen has-nav"><div class="hdr"><p class="tag">겹침 확인</p><h1 class="h" data-focus>' + esc(title) + '</h1><p class="sub">' + sub + '</p>' +
      '<p class="basis">등록한 ' + state.items.length + '개 기준이에요 ' + tip('basis', '등록하신 약과 영양제 사이에서만 찾은 결과예요. 찾지 못했다고 안전하다는 뜻은 아니에요. 등록하지 않은 약은 확인할 수 없어요.') + '</p></div>' +
      '<div class="list">' + rows.map(rowHtml).join('') + '</div>' +
      (supps.length ? '<p class="lbl">내가 먹는 영양제 ' + supps.length + '</p><div class="list">' + supps.map(rowHtml).join('') + '</div>' : '') +
      (rows.concat(supps).some(function (a) { return a.status === 'unchecked' && !durPending(a.item); }) ? '<p class="note">"확인 못 함"은 키핑이 확인한 범위 밖이라는 뜻이에요. 등록은 됐고, 다른 것과 겹치는지는 약사에게 확인해 주세요.</p>' : '') +
      (needTimes && !state.example ? '<button type="button" class="row" data-act="to" data-view="times" data-batch="' + esc(batch || '') + '"><span class="row-main"><b>복용 시간 입력하기</b><span class="sub2">입력하면 복용 간격도 볼 수 있어요</span></span>' + icon('chev') + '</button>' : '') +
      '<button type="button" class="row ghostrow" data-act="newRx" data-batch="' + esc(batch || '') + '"><span class="row-main"><b>빠진 약이 있나요?</b><span class="sub2">등록하지 않은 약은 확인할 수 없어요</span></span>' + icon('plus') + '</button>' +
      '<div class="stack pad-top"><button type="button" class="cta" data-act="nav" data-view="questions">약사에게 물어볼 질문 보기</button></div></main>' + nav('');
  };

  /* 병용금기 근거: 사유·고시일·조건(비고)을 원문 그대로. 요약하지 않는다. 비고는 있으면 반드시 보인다. */
  function pairFacts(f) {
    function r(k, v, cls) { return '<div class="' + (cls || '') + '"><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>'; }
    return '<dl class="pairfacts">' + r('사유', f.reason) + (f.notified ? r('고시일', f.notified) : '') + (f.note ? r('조건', f.note, 'cond') : '') + '</dl>';
  }
  function metaRow(label, value, tipHtml) {
    return '<div class="meta"><b>' + esc(label) + '</b><span>' + value + '</span>' + (tipHtml || '') + '</div>';
  }
  VIEWS.detail = function () {
    var item = findItem(ui.params.id);
    if (!item) return VIEWS.home();
    var a = E.analyzeItem(item, state.items, Pack);
    var r = E.record(item, Pack);
    var html = '<main class="screen">' + topbar() + '<h1 class="h" data-focus>' + esc(nm(item)) + '</h1><p class="sub">' + esc(kindLabel(item)) + '</p>';

    if (a.findings.length) {
      html += '<p class="lbl red"><i class="dot"></i>확인이 필요한 내용</p>';
      a.findings.forEach(function (f, i) {
        var kindText = { pair: '병용금기 목록에 있어요', name: '설명서에 성분 이름이 있어요', 'class': '설명서의 종류 표현 · 약사 확인 권장', supp: '설명서의 종류 표현 · 약사 확인 권장' }[f.kind];
        html += '<article class="fcard"><div class="fhead"><b>' + esc(f.withName) + '</b><span class="conf ' + f.confidence + '">' + kindText + '</span>' +
          (f.confidence === 'low' ? tip('c' + i, '설명서가 약의 종류로 적은 표현이에요. 이 약이 해당하는지는 설명서만으로 알 수 없어서, 약사에게 확인해 주세요.') : '') + '</div>' +
          '<p class="ftitle">' + esc(f.title) + '</p>' + (f.kind === 'pair' ? pairFacts(f) : (f.summary ? '<p class="muted">' + esc(f.summary) + '</p>' : '')) +
          (f.excerpt ? '<blockquote><small>' + esc(f.sectionTitle || '') + '</small><p>' + esc(f.excerpt) + '</p></blockquote>' : '') +
          '<p class="src"><a href="' + esc(f.source.url) + '" target="_blank" rel="noopener">' + esc(f.source.label) + ' 보기</a><small>확인일 ' + esc(f.source.checkedAt) + '</small></p></article>';
      });
    } else if (durPending(item)) {
      html += '<div class="card"><h4>약 목록을 불러오는 중이에요</h4><p>불러오면 겹치는 내용을 확인해서 여기에 보여드려요.</p></div>';
    } else if (item.kind === 'drug' && item.productCode && !a.coverage.inPack) {
      html += '<div class="card"><h4>확인하지 못했어요</h4><p>전체 약 목록을 불러오지 못해서 겹치는 내용을 확인하지 못했어요. 등록은 됐어요. 인터넷에 연결한 뒤 다시 열어 보거나, 약사에게 확인해 주세요.</p></div>';
    } else if (item.kind === 'drug' && !a.coverage.inPack) {
      html += '<div class="card"><h4>확인 범위 밖이에요</h4><p>이 약은 키핑이 근거를 확인하는 범위 밖이에요. 등록은 됐고, 다른 약과 겹치는지는 약사에게 확인해 주세요.</p></div>';
    } else if (item.kind === 'supp' && a.status === 'unchecked') {
      html += '<div class="card"><h4>확인할 자료가 없어요</h4><p>이 영양제는 약과의 병용 정보를 확인할 공식 자료를 찾지 못했어요. 등록은 됐고, 약사에게 확인해 주세요.</p></div>';
    } else if (a.status === 'none' && a.coverage.product && !a.coverage.label) {
      html += '<div class="card"><h4>병용금기 목록에서 겹치는 쌍을 찾지 못했어요</h4><p>등록하신 ' + state.items.length + '개와 병용금기 목록 안에서 찾지 못했다는 뜻이에요. 안전하다는 뜻은 아니에요. 설명서는 확인하지 못했어요.</p></div>';
    } else if (a.status === 'none') {
      html += '<div class="card"><h4>겹치는 내용을 찾지 못했어요</h4><p>등록하신 ' + state.items.length + '개와 확인한 자료 안에서 찾지 못했다는 뜻이에요. 안전하다는 뜻은 아니에요.</p></div>';
    }

    html += '<p class="lbl">확인한 것</p>';
    if (item.kind === 'drug') {
      var cv = a.coverage, d = r && r.dur, dp = cv.product && Pack.dur ? Pack.dur.hasPairs(cv.product.code) : false;
      var basis = r && r.ingrCode ? (Pack.pairs || []).filter(function (x) { return x.a === r.ingrCode || x.b === r.ingrCode; })[0] : null;
      var tabooText, tabooTip = '';
      if (durPending(item)) tabooText = '약 목록을 불러오는 중이에요';
      else if (cv.product && Pack.dur) {     // 병용금기 파일로 확인되는 약: 건수 없이 목록에 있는지만
        tabooText = dp ? '이 성분은 병용금기 목록에 있어요' : '이 성분은 목록에 나오지 않아요';
        tabooTip = tip('t1', dp ? '등록하신 것과 겹치는 것만 위에 보여드려요.' : '목록에 없다는 뜻이에요. 안전하다는 뜻은 아니에요.');
      } else if (d && !Pack.dur) {             // 전체 약 목록이 없을 때(데이터 팩 모드)만 예전 건수
        tabooText = d.usjntTaboo === 0 ? '공식 목록에 등록 없음' : d.usjntTaboo + '건 등록 (제품 기준)';
        tabooTip = d.usjntTaboo === 0 ? tip('t1', '공식 목록에 등록된 것이 없다는 뜻이에요. 안전하다는 뜻은 아니에요.') : tip('t1', '이 중 등록하신 것과 겹치는 것만 위에 보여드려요.');
      } else if (r && !cv.product && !d && basis) {   // 이 약의 목록은 조회한 적이 없고, 다른 약(시바스정) 조회에서 나온 쌍만 있다 (예: 수출용 코니트라캡슐)
        tabooText = '일부만 확인했어요 · 다른 약 조회에서 나온 쌍만 보여드려요 (식약처 DUR, ' + basis.checkedAt + ')';
        tabooTip = tip('t1', '이 약의 병용금기 목록은 직접 조회하지 않았어요. 시바스정을 조회할 때 나온 쌍만 보여드려요. 다른 약과의 병용금기는 약사에게 확인해 주세요.');
      } else tabooText = '확인하지 못했어요';
      html += metaRow('병용금기', tabooText, tabooTip);
      var efText = !d ? '확인하지 않았어요' : (d.efcyDplct === 0 ? '등록 없음' : (d.efcyDplct == null ? '확인하지 않았어요' : (r.series ? r.series + ' 계열 ' + d.efcyDplct + '건' : d.efcyDplct + '건')));
      html += metaRow('효능군중복', efText, (d && d.efcyDplct === 0) ? tip('t2', '같은 계열의 약이 겹쳐 등록돼 있지 않다는 뜻이에요. 안전하다는 뜻은 아니에요.') : '');
      html += metaRow('설명서', cv.label ? '확인했어요' : '확인하지 못했어요', cv.label ? '' : tip('t3', '이 약의 설명서는 키핑이 아직 읽어 두지 않았어요. 설명서는 의약품안전나라에서 볼 수 있어요.'));
      if (cv.product) {
        html += metaRow('구분', esc(cv.product.category || '급여목록 밖 (구분 정보 없음)'));
        if (cv.product.ingrName) html += metaRow('성분', esc(cv.product.ingrName));
      }
      if (r && r.note) html += '<p class="note">' + esc(r.note) + '</p>';
    } else if (item.kind === 'supp') {
      var names = (item.ingredientKeys || []).map(function (k) { var o = Pack.supplementKeyList.filter(function (x) { return x.id === k; })[0]; return o ? o.ko : k; });
      html += metaRow('성분', names.length ? esc(names.join(', ')) : '선택하지 않았어요');
      html += metaRow('식약처 병용섭취정보', a.coverage.scope ? '있는 원료예요' : '이 성분은 목록에 없어요', a.coverage.scope ? tip('t4', '식약처가 약과의 병용 정보를 제공하는 원료예요. 내용은 식약처 화면에서 확인해 주세요.') : tip('t4', '식약처가 병용 정보를 제공하는 원료 33종 중에 없다는 뜻이에요. 안전하다는 뜻은 아니에요.'));
      if (a.coverage.scope) html += '<p class="src"><a href="' + esc(Pack.sources.hid) + '" target="_blank" rel="noopener">식약처 건강기능식품 종합정보 서비스 보기</a></p>';
      var ps = Pack.supplements.filter(function (s) { return s.reportNo === item.reportNo; })[0];
      if (ps) {
        html += metaRow('섭취 방법', esc(ps.intake));
        html += '<div class="card soft"><h4>제품 주의사항</h4><p>' + esc(ps.cautions) + '</p><small class="muted">식품안전나라 품목제조신고 · 신고번호 ' + esc(ps.reportNo) + ' · 보고일 ' + esc(ps.reportedAt) + '</small></div>';
      }
    }

    var qs = E.questionsFor(a, state.items, Pack);
    if (!qs.length && state.items.length > 1) qs = ['지금 먹는 것들과 ' + nm(item) + ', 같이 먹어도 되나요?'];
    if (qs.length) {
      html += '<p class="lbl">약사에게 물어볼 질문</p><div class="qbox">' + qs.map(function (q) {
        var saved = state.questions.some(function (s) { return s.text === q; });
        return '<div class="qrow"><p>' + esc(q) + '</p><button type="button" class="mini txt' + (saved ? ' on' : '') + '" data-act="saveQ" data-q="' + esc(q) + '"' + (saved ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + (saved ? '저장됨' : '저장') + '</button></div>';
      }).join('') + '</div>';
    }
    return html + '<p class="fine">키핑은 의료 조언이 아니에요. 공식 자료에서 확인한 범위만 보여드려요.</p></main>';
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

  VIEWS.settings = function () {
    var inPack = Pack.drugs.filter(function (d) { return !d.partial; }).length;
    var dur = Pack.dur, st = dur && dur.stats();
    var labelCount = Object.keys(Pack.labels || {}).length;
    var scopeCount = Pack.supplementKeyList.filter(function (k) { return k.scope; }).length;
    function fmt(n) { return n.toLocaleString('ko-KR'); }
    var range = dur
      ? metaRow('약 검색 범위', fmt(st.products) + '개 제품 · 병용금기 ' + fmt(st.pairs) + '쌍')
      : metaRow('근거를 확인하는 약', inPack + '개 (데모 범위)');
    var sources = '';
    if (dur) {
      var ps = dur.source('pair');
      sources = '<p class="lbl">출처</p>' +
        '<div class="card soft"><h4>병용금기</h4><p><a class="lnk" href="' + esc(ps.url) + '" target="_blank" rel="noopener">' + esc(ps.label) + '</a><br>기준일 ' + esc(ps.checkedAt) + '</p></div>' +
        '<div class="card soft"><h4>약 목록</h4><p>약제급여목록 및 급여상한금액표 (2026-11-01 적용, 공개용)</p></div>' +
        '<div class="card soft"><h4>이용 조건</h4><p>' + esc(dur.license()) + '</p><p class="muted">약제급여목록의 이용 조건은 확인하지 못했어요.</p></div>';
    } else {
      sources = '<p class="lbl">출처</p><div class="card soft"><h4>전체 약 목록을 불러오지 못했어요</h4><p>지금은 키핑이 근거를 확인한 약 ' + inPack + '개 안에서만 찾아요.</p></div>';
    }
    var scope = '<p class="lbl">이 서비스가 확인하는 범위</p>' +
      metaRow('병용금기 목록', dur ? '확인함 (제품 목록 기준)' : '데이터 팩의 약 ' + inPack + '개만 확인함') +
      metaRow('설명서 상호작용', '일부 약만 (' + labelCount + '개)') +
      metaRow('영양제', '식약처 병용섭취정보 원료 ' + scopeCount + '종에 해당하는지만') +
      metaRow('음식 · 용량 · 건강 상태', '확인하지 않음');
    return '<main class="screen has-nav"><div class="hdr"><h1 class="h" data-focus>설정</h1></div>' +
      '<div class="card soft"><h4>이 기기에만 저장돼요</h4><p>등록한 약, 영양제, 복용 시간은 이 기기 안에만 있어요. 키핑 서버로 보내지 않아요. 기기를 바꾸거나 브라우저 데이터를 지우면 사라져요.</p></div>' +
      '<div class="stack"><button type="button" class="cta ghost" data-act="to" data-view="onb-drugs">처음부터 다시 설정하기</button><button type="button" class="cta ghost" data-act="exportData">내보내기 (파일로 저장)</button><label class="cta ghost filebtn" for="imp">가져오기 (파일 선택)</label><input id="imp" class="sr" type="file" accept="application/json,.json" data-input="import"><button type="button" class="cta ghost danger" data-act="resetAll">모든 정보 지우기</button></div>' +
      '<p class="lbl">정보</p><div class="meta"><b>데이터 기준일</b><span>' + esc(Pack.checkedAt) + '</span></div>' + range +
      '<div class="meta off"><b>계정 연결</b><span>2차 예정</span></div>' +
      scope + sources +
      '<p class="fine">키핑은 의료 조언이 아니에요. 약과 영양제를 같이 먹어도 되는지는 약사나 의사에게 확인해 주세요. 출처: 식약처 의약품 제품 허가정보, DUR, 의약품안전나라, 식품안전나라.</p></main>' + nav('settings');
  };

  /* ---------- 흐름 ---------- */
  function render(top) {
    var y = window.scrollY;
    var v = (VIEWS[ui.view] || VIEWS.home)();
    root.innerHTML = v;
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
    resetPhoto(); ui.more = false;
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
    start: function () { go('onb-drugs'); },
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
    demoConfirm: function () { var b = addDemoBatch(); go('result', { batch: b }); },
    confirmAdd: function () {
      if (!selectedItems('drug').length) { toast('추가한 약이 없어요'); return; }
      state.lastBatch = ui.params.batch; save();
      go('result', { batch: ui.params.batch });
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
      else go('result', { batch: p.batch || state.lastBatch });
    },
    addFood: function () {
      var inp = document.getElementById('fq'); var v = inp ? inp.value.trim() : ''; if (!v) return;
      state.foods.push({ id: Store.uid(), name: v }); save(); render(false);
    },
    rmFood: function (t) { state.foods = state.foods.filter(function (f) { return f.id !== t.dataset.id; }); save(); render(false); },
    photoTok: function (t) { searchFor(t.dataset.t); setPhotoStat(); },
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
    } else if (k === 'photo') {
      var pf = t.files && t.files[0]; if (!pf) return;
      readPhoto(pf); t.value = '';
    } else if (k === 'import') {
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
    if (e.key !== 'Enter') return;
    var id = e.target.id;
    if (id === 'fq') Acts.addFood();
    else if (id === 'cq') Acts.addQ();
    else if (id === 'oq') Acts.searchOverseas();
    else if (id === 'mname') Acts.manualSupp();
  });

  ui.view = state.items.length ? 'home' : 'welcome';
  var durReady = bootDur();
  render(true);
  window.KeepingApp = { state: function () { return state; }, go: go, ui: ui, bootDur: bootDur, applyOcrText: function (text) { return applyOcrText(text, ui.photoToken); } };
})();
