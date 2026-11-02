/* 실행: node tests/home.test.js — 새 홈 화면(docs/home-ui-spec.md)을 실제 데이터로 점검한다.
 * 체크 → 숫자·바 폭 · 체크 저장 키 · 홈에서 지운 것 · 주의 문장 · 약봉투 화면 · 진료과 칩 */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(dir + '/index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '').replace(/<link[^>]+>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window; const d = w.document;
w.scrollTo = () => {}; w.confirm = () => true;
const errors = [];
w.addEventListener('error', (e) => errors.push(e.message));
w.fetch = (u) => Promise.resolve({ ok: fs.existsSync(path.join(dir, u)), status: 200, json: async () => JSON.parse(fs.readFileSync(path.join(dir, u), 'utf8')) });
['config.js', 'data/datapack.js', 'js/dur.js', 'js/care.js', 'js/josa.js', 'js/timeinput.js', 'js/greeting.js', 'js/suppsearch.js', 'js/homevm.js', 'js/engine.js', 'js/storage.js', 'js/api.js', 'js/app.js'].forEach((f) => w.eval(fs.readFileSync(path.join(dir, f), 'utf8')));
let ok = 0, bad = 0;
const T = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
const click = (s) => { const el = typeof s === 'string' ? q(s) : s; if (!el) throw new Error('없음: ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, cond, extra) { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('FAIL  ' + name + (extra ? '\n      ' + extra : '')); } }
const css0 = fs.readFileSync(path.join(dir, 'css/style.css'), 'utf8');
const today = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
const store = () => JSON.parse(w.localStorage.getItem('kp:checks:' + today()) || '{}');

(async () => {
  const A = w.KeepingApp;
  await A.bootDur(); await A.bootCare(); await A.bootCopy(); await wait(30);
  const dur = w.KEEPING_DATA.dur, st = A.state();
  const mk = (q0, id, t, dept) => Object.assign(dur.toItem(dur.search(q0)[0].code), { id, times: [t], batch: null }, dept ? { dept } : {});
  st.items = [mk('씬지록신', 'L1', '07:00', '내과'), mk('메토폴', 'M1', '07:00', '피부과'),
    { id: 'C1', kind: 'supp', source: 'manual', name: '칼슘 영양제', ingredientKeys: ['calcium'], times: ['08:00'], batch: null },
    mk('알마겔에프', 'A1', '12:30'), mk('시바스', 'S1', '21:00', '내과')];
  st.example = false; A.ui.nowMin = 6 * 60 + 40; A.ui.open = {};
  w.localStorage.clear(); A.go('home');

  console.log('1) 체크박스');
  const total = qa('.kp-check').length;
  check('아침 시작 전: 숫자 0/N, 바 폭 0%, 노드는 지금(고리)', q('.kp-count').textContent === '0/' + (A.homeModel().header.card.total) && q('.kp-fill').style.width === '0%' && q('.kp-node--now'), q('.kp-count').textContent + ' ' + q('.kp-fill').style.width);
  check('체크박스는 role=checkbox + aria-checked=false, 줄(약봉투 버튼)과 서로 다른 요소', qa('.kp-check').every((c) => c.getAttribute('role') === 'checkbox' && c.getAttribute('aria-checked') === 'false') && qa('.kp-grp').every((g) => !g.querySelector('.kp-grp-main .kp-check')));
  check('진행 바: role=progressbar + aria-valuenow + aria-label(모델의 aria 문장)', q('.kp-bar').getAttribute('aria-valuenow') === '0' && q('.kp-bar').getAttribute('aria-label') === A.homeModel().header.aria);
  const c0 = q('.kp-count').textContent, w0 = q('.kp-fill').style.width;
  click(qa('.kp-check')[0]);
  check('① 체크하면 card.count와 바 폭이 바뀐다', q('.kp-count').textContent !== c0 && q('.kp-fill').style.width !== w0 && q('.kp-count').textContent.startsWith('1/'), q('.kp-count').textContent + ' ' + q('.kp-fill').style.width);
  check('바 폭 = 모델의 ratio(화면이 다시 계산하지 않음), aria-valuenow 1', Math.abs(parseFloat(q('.kp-fill').style.width) / 100 - A.homeModel().header.card.ratio) < 0.001 && q('.kp-bar').getAttribute('aria-valuenow') === '1');
  check('체크한 줄: aria-checked=true + 흐려짐 클래스, 취소선 없음', qa('.kp-check')[0].getAttribute('aria-checked') === 'true' && qa('.kp-grp')[0].classList.contains('is-checked') && !/line-through/.test(fs.readFileSync(path.join(dir, 'css/style.css'), 'utf8').match(/\.kp-grp\.is-checked[^}]*\}/g).join('')));
  check('저장: kp:checks:오늘날짜 에 체크한 것만 true', JSON.stringify(store()) === JSON.stringify({ 'morning:rx:내과': true }), JSON.stringify(store()));
  check('체크해도 카드가 갑자기 접히지 않음', q('.kp-slot-head').getAttribute('aria-expanded') === 'true');
  click(qa('.kp-check')[0]);
  check('해제하면 키를 지움(false를 남기지 않음)', JSON.stringify(store()) === '{}' && q('.kp-count').textContent === c0, JSON.stringify(store()));
  qa('.kp-check').slice(0, 3).forEach((c) => click(qa('.kp-check').find((x) => x.getAttribute('aria-checked') === 'false') || c));
  check('아침 묶음을 모두 체크하면 노드가 채운 원(done)으로 바뀌고 지난 줄 선이 포인트색', q('.kp-row--slot').dataset.node === 'done' && q('.kp-row--slot').classList.contains('is-line-done') && !!q('.kp-node--done svg'));
  check('다음 시간대(점심)가 지금 차례(고리)', qa('.kp-row--slot')[1].dataset.node === 'now');
  w.localStorage.clear(); A.go('home');
  check('체크 기록이 없으면 다시 0부터(날짜 키가 바뀌면 새로 시작)', q('.kp-count').textContent === c0);
  check('localStorage가 막혀도 오류 없이 동작(임시 보관)', (() => { const orig = w.Storage.prototype.setItem; w.Storage.prototype.setItem = () => { throw new Error('막힘'); }; try { click(qa('.kp-check')[0]); return q('.kp-count').textContent.startsWith('1/') && errors.length === 0; } finally { w.Storage.prototype.setItem = orig; } })());
  w.localStorage.clear(); A.go('home');

  console.log('2) 홈에서 지운 것');
  const seen = [];
  [6 * 60 + 40, 12 * 60 + 40, 22 * 60].forEach((m) => { A.ui.nowMin = m; A.ui.open = {}; A.go('home'); seen.push(T()); });
  const home = seen.join(' ');
  check('② 홈에 "시간을 정하지 않은 약", "돌아보기", "확인할 주의", "건너뛰"가 없다', !/시간을 정하지 않은 약|시간 정하기|돌아보기|확인할 주의|건너뛰/.test(home), (home.match(/시간을 정하지 않은 약|시간 정하기|돌아보기|확인할 주의|건너뛰/) || [''])[0]);
  check('홈 아래 안내 문단("병용금기(공식 지정)와 설명서에서 찾은 안내만")이 없다', !/병용금기\(공식 지정\)와 설명서에서 찾은/.test(home));
  check('"새 주의 요약" 박스·"오늘 주의 N개" 한 줄이 없다', !/새 주의 요약|오늘 주의 \d+개/.test(home));
  check('판정·단정 문구 없음(안전해요/괜찮/문제없/먹어도)', !/안전해요|괜찮|문제없|먹어도/.test(home));
  A.ui.nowMin = 6 * 60 + 40; A.ui.open = {}; A.go('home');
  const notice = qa('.kp-notice').map((n) => n.textContent).join(' ');
  check('③ 주의 블록의 문장에 "드세요"가 없다(주의 블록 ' + qa('.kp-notice').length + '개)', qa('.kp-notice').length >= 1 && !/드세요|복용하세요|챙겨 드/.test(notice), notice);
  check('주의 블록 안에 배지가 없다', !qa('.kp-notice [class*="badge"]').length);
  check('시간 없는 약을 넣어도 홈에 나오지 않는다', (() => { st.items.push({ id: 'NT', kind: 'drug', source: 'manual', name: '시간없는약', times: [], batch: null }); A.go('home'); const r = !T().includes('시간없는약'); st.items.pop(); return r; })());

  console.log('3) 점심에 아침을 놓친 상태');
  A.ui.nowMin = 12 * 60 + 40; A.ui.open = {}; A.go('home');
  check('인사 카드 문구가 "놓침" 상태 문구(모델 값 그대로) + 숫자 0/N', q('.kp-line1').textContent === A.homeModel().header.line1 && q('.kp-line2').textContent === A.homeModel().header.line2 && /체크 전|체크되지/.test(q('.kp-line2').textContent + q('.kp-status').textContent), q('.kp-line2').textContent);
  check('아침 카드는 지금 차례라 펼침, 점심 카드는 접힘', qa('.kp-slot-head').map((b) => b.getAttribute('aria-expanded')).slice(0, 2).join() === 'true,false');

  console.log('4) 카드 접기·펼치기 · 주의 더보기');
  A.ui.nowMin = 6 * 60 + 40; A.ui.open = {}; A.go('home');
  click(qa('.kp-slot-head')[1]);
  check('머리를 누르면 펼침(aria-expanded, hidden 해제)', qa('.kp-slot-head')[1].getAttribute('aria-expanded') === 'true' && !qa('.kp-slot-body')[1].hasAttribute('hidden'));
  click(qa('.kp-slot-head')[0]);
  check('펼친 카드를 누르면 접힘', qa('.kp-slot-head')[0].getAttribute('aria-expanded') === 'false' && qa('.kp-slot-body')[0].hasAttribute('hidden'));
  A.ui.open = {};

  console.log('5) 약봉투 화면');
  A.go('home'); const gid = qa('.kp-grp-main')[0].dataset.id;
  click(qa('.kp-grp-main')[0]);
  const bagModel = A.homeModel().detail[gid];
  check('묶음 줄을 누르면 약봉투 화면(체크는 바뀌지 않음)', !!q('.kp-bag') && JSON.stringify(store()) === '{}');
  check('상단 뒤로 가기 + 제목(묶음 이름)', !!q('.kp-bar2 [data-act="back"]') && q('.kp-bar2-title').textContent === bagModel.title && !q('.top-title') && !/이전/.test(q('.kp-bar2').textContent));
  check('약마다 카드: 이름(display) · 규격·업체 · 구분 칩 · 시간 줄 · 성분', qa('.kp-bagcard').length === bagModel.items.length && qa('.kp-bagcard').every((c, i) => c.querySelector('.kp-bag-name').textContent === bagModel.items[i].display && !!c.querySelector('.kp-chip') && !!c.querySelector('.kp-btime-h') && c.querySelector('.kp-btime-h').textContent.includes('시간')));
  check('복용법·용량 칸이 없다(설명서 원문 문장은 제외)', !/복용법|1회|용량|하루 \d/.test([...qa('.kp-bagcard')].map((c) => { const k = c.cloneNode(true); k.querySelectorAll('.kp-gen').forEach((e) => e.remove()); return k.textContent; }).join(' ')));
  check('맨 아래 작은 글씨: scope + footer(모델 값 그대로)', q('.kp-bag-foot').textContent.includes(bagModel.scope) && q('.kp-bag-foot').textContent.includes(bagModel.footer));
  const nb = q('.kp-bagcard .kp-notice');
  check('카드 안 주의 줄을 누르면 근거 시트가 열린다(없으면 칸 자체가 없음)', !nb ? !q('.kp-bagcard .kp-notice') : (click(nb), !!q('.kp-sheet')));
  if (q('.kp-sheet')) click('.kp-close');
  click('[data-act="back"]');
  {
    const dm = A.homeModel().detail, gk = Object.keys(dm).find((k) => dm[k].items.some((i) => i.general && i.general.sections.length));
    check('시험 데이터에 설명서 안내가 있는 약이 있다', !!gk);
    if (gk) {
      A.go('bag', { id: gk }); const D = dm[gk];
      const cards = qa('.kp-bagcard');
      check('general이 있는 약 카드에만 "약 설명서 안내"(기본 펼침 details open), 없는 약 카드에는 칸이 없음', D.items.every((it, i) => it.general ? (!!cards[i].querySelector('details.kp-gen[open]') && cards[i].querySelector('.kp-gen > summary').textContent === it.general.title) : !cards[i].querySelector('.kp-gen')));
      const gi = D.items.findIndex((it) => it.general && it.general.sections.length), G = D.items[gi].general, card = cards[gi];
      check('구역 제목이 sections 순서대로', [...card.querySelectorAll('.kp-gsec > h4')].map((h) => h.textContent).join('|') === G.sections.map((x) => x.title).join('|'));
      const lis = [...card.querySelectorAll('.kp-gitem')], flat = G.sections.reduce((a2, x) => a2.concat(x.items), []);
      check('문장마다 where(작은 글씨) → 본문(text 그대로)', lis.length === flat.length && lis.every((li, i) => (flat[i].where ? li.firstElementChild.className === 'kp-gwhere' && li.firstElementChild.textContent === flat[i].where : !li.querySelector('.kp-gwhere')) && li.querySelector('.kp-gtext').textContent === flat[i].text));
      check('kos가 있으면 "관련: …" 한 줄, interval·meal은 칩', lis.every((li, i) => (flat[i].kos.length ? li.querySelector('.kp-gkos').textContent === '관련: ' + flat[i].kos.join(' · ') : !li.querySelector('.kp-gkos')) && [...li.querySelectorAll('.kp-gchips .kp-chip')].map((c) => c.textContent).join('|') === [flat[i].interval, flat[i].meal].filter(Boolean).join('|')));
      const ft = card.querySelector('.kp-gfoot'), lk = ft.querySelector('a');
      check('맨 아래: auto 작은 글씨 + 원문 보기(새 탭) + 확인일', ft.textContent.includes(G.auto) && (G.source.url ? (lk && lk.href.toLowerCase() === G.source.url.toLowerCase() && lk.target === '_blank' && lk.textContent === '원문 보기') : !lk) && /확인일 /.test(ft.textContent), JSON.stringify({ ft: ft.textContent, href: lk && lk.href, url: G.source.url, target: lk && lk.target }));
      click('[data-act="back"]');
    }
    const emp = A.generalHtml({ title: '약 설명서 안내', auto: 'AUTO문구', source: { url: 'https://x.example', checkedAt: '2026-11-01' }, sections: [], empty: '이 약의 설명서에서 뽑은 안내가 아직 없어요' });
    check('general이 null이면 칸을 만들지 않고, empty가 있으면 그 문장만(자동 문구·원문 보기·확인일 없음)', A.generalHtml(null) === '' && emp.includes('이 약의 설명서에서 뽑은 안내가 아직 없어요') && !emp.includes('AUTO문구') && !emp.includes('원문 보기') && !emp.includes('확인일'));
  }
  check('뒤로 가면 홈', !!q('.kp-hello'));

  console.log('6) 근거 시트 접근성');
  click(q('.kp-notice-first'));
  const lay = q('.kp-layer');
  check('시트는 role=dialog aria-modal, 홈은 aria-hidden/inert, 첫 포커스는 ✕', q('.kp-sheet').getAttribute('aria-modal') === 'true' && d.getElementById('app').hasAttribute('inert') && d.activeElement === q('.kp-sheet .kp-icbtn') && !!lay);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc로 닫히고 홈이 다시 활성, 포커스가 눌렀던 줄로 돌아감', !q('.kp-sheet') && !d.getElementById('app').hasAttribute('inert') && d.activeElement && d.activeElement.classList.contains('kp-notice-first'));

  console.log('7) 진료과 한 줄');
  A.go('detail', { id: 'L1' });
  check('처방약 상세: 칩 [내과][피부과][이비인후과][정형외과][소아과][직접 입력], 건너뛰기 없음', qa('.deptq .chip').map((c) => c.textContent).join('|') === '내과|피부과|이비인후과|정형외과|소아과|직접 입력', qa('.deptq .chip').map((c) => c.textContent).join('|'));
  check('현재 진료과(내과)가 선택 표시', qa('.deptq .chip.on').map((c) => c.textContent).join() === '내과');
  click(qa('.deptq .chip').find((c) => c.textContent === '정형외과'));
  check('칩을 고르면 item.dept에 저장', st.items.find((i) => i.id === 'L1').dept === '정형외과' && w.KeepingStore.load().items.find((i) => i.id === 'L1').dept === '정형외과');
  click(qa('.deptq .chip').find((c) => c.textContent === '정형외과'));
  check('선택한 칩을 다시 누르면 해제(dept 없이 둠)', !('dept' in st.items.find((i) => i.id === 'L1')));
  click(qa('.deptq .chip').find((c) => c.textContent === '직접 입력'));
  q('#deptin').value = '신경과'; click('[data-act="deptSave"]');
  check('직접 입력한 진료과 저장 + 칩에 표시', st.items.find((i) => i.id === 'L1').dept === '신경과' && qa('.deptq .chip.on').map((c) => c.textContent).join() === '신경과');
  A.go('home');
  check('홈 묶음 이름이 바뀐 진료과를 따라간다("신경과 처방약")', qa('.kp-grp-txt b').some((b) => b.textContent === '신경과 처방약'));
  A.go('detail', { id: 'C1' });
  check('영양제 상세에는 진료과를 묻지 않는다', !q('.deptq'));
  A.go('detail', { id: 'A1' });
  check('일반의약품(약국약) 상세에도 묻지 않는다', !q('.deptq'));
  // 담기 확인 화면
  A.go('add', { batch: 'rx-t' }); st.items = []; delete st.newRx;
  const rxItem = Object.assign(dur.toItem(dur.search('시바스')[0].code), { id: 'D1' });
  A.ui.draft = { item: rxItem, slots: [], dept: '', deptEdit: false, fromView: 'add', fromParams: { batch: 'rx-t' } }; A.go('confirm');
  check('담기 확인(처방약): 약 이름 + 진료과 칩 한 줄(가로 밀기, 줄바꿈 없음, 건너뛰기 없음) + 시간 칩 4개', T().includes('담기 확인') && T().includes('시바스정') && qa('.hscroll .chip').map((c) => c.textContent).join('|') === '내과|피부과|이비인후과|정형외과|소아과|직접 입력' && /\.hscroll\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/.test(css0) && !/건너뛰기/.test(T()) && qa('[data-act="draftSlot"]').length === 4);
  check('시간을 고르기 전에는 [담기]가 비활성, 눌러도 담기지 않음', q('[data-act="dock"]').disabled === true && (click('[data-act="dock"]'), st.items.length === 0));
  click(qa('[data-act="draftDept"]')[0]); click(qa('[data-act="draftDept"]')[0]);
  check('진료과 칩은 선택 사항: 다시 누르면 해제(아무것도 안 고르면 dept 없음)', !qa('[data-act="draftDept"].on').length);
  click(qa('[data-act="draftDept"]')[1]); click(qa('[data-act="draftSlot"]')[1]); click('[data-act="timeSave"]'); click(qa('[data-act="draftSlot"]')[3]); click('[data-act="timeSave"]');
  click('[data-act="dock"]');
  const docked = st.items.find((i) => i.id === 'D1');
  check('[담기] → 홈: 시간(12:30·22:00)·진료과(피부과) 저장, 홈에 "피부과 처방약" 묶음과 "새 처방" 칩', !!q('.kp-hello') && docked.times.join() === '12:30,22:00' && docked.dept === '피부과' && qa('.kp-grp-txt b').some((b) => b.textContent.startsWith('피부과 처방약') && b.querySelector('.kp-newchip')) && st.newRx.ids.join() === 'D1', JSON.stringify(docked));
  check('일반의약품·직접 이름 약은 진료과 줄이 없다', (() => { A.ui.draft = { item: { id: 'D2', kind: 'drug', source: 'manual', name: '내약', times: [] }, slots: [], dept: '', deptEdit: false, fromView: 'add', fromParams: {} }; A.go('confirm'); return !q('.hscroll'); })());

  console.log('8) 새 처방 칩 · 공식 지정 시트의 조건 줄');
  st.items = [mk('씬지록신', 'L1', '07:00', '내과')]; delete st.newRx; A.ui.nowMin = 6 * 60 + 40; A.ui.open = {}; A.go('home');
  check('newItemIds를 안 넘기면 칩이 없다', !qa('.kp-newchip').length);
  A.ui.open = {}; A.go('home');
  const off = qa('.kp-notice-first').find((n) => /지정된 조합/.test(n.textContent));
  if (off) {
    click(off);
    check('공식 지정 시트: 헤드라인 바로 아래 조건 줄(noteLine) 또는 조건이 없으면 줄 없음', (() => { const sh = A.homeModel().sheets[off.dataset.flag]; return sh.noteLine ? q('.kp-sheet-h').nextElementSibling.textContent === sh.noteLine : !q('.kp-note'); })());
    click('.kp-close');
  }
  const pair = [mk('픽토민정', 'm1', '08:00'), mk('비지파크주270', 'm2', '09:00')];
  st.items = pair; st.example = false; A.ui.open = {}; A.go('home'); click(q('.kp-notice-first'));
  check('조건이 있는 쌍(픽토민정 × 비지파크): "조건 · 48시간 이내 병용금기" 줄이 보임', q('.kp-note') && q('.kp-note').textContent.includes('48시간 이내 병용금기') && q('.kp-sheet-h').nextElementSibling === q('.kp-note'), q('.kp-note') && q('.kp-note').textContent);
  click('.kp-close');
  st.items = [mk('씬지록신', 'L1', '07:00'), { id: 'C1', kind: 'supp', source: 'manual', name: '칼슘 영양제', ingredientKeys: ['calcium'], times: ['08:00'], batch: null }];
  A.ui.open = {}; A.go('home'); click(q('.kp-notice-first'));
  check('설명서 근거 시트에는 조건 줄이 없다', !q('.kp-note'));
  click('.kp-close');

  console.log('9) 시간 없는 약 막기 · 하단 탭');
  st.items = [mk('씬지록신', 'L1', '07:30')]; st.example = false; A.go('home');
  check('홈에 시연 띠·시연 버튼이 없다', !q('.kp-band') && !q('[data-act="demoRx"]'));
  const SL = A.homeModel().rows.filter((r) => r.type === 'slot')[0];
  check('주의가 없으면 시간대 카드 맨 아래에 작은 "주의 없음" 블록(모델의 statusLine 문구, 빨강 없음)', !SL.notice && !!q('.kp-slot-body .kp-status-line') && q('.kp-status-line-text').textContent === SL.statusLine.text && !!q('.kp-status-line svg') && !q('.kp-status-line .kp-red') && /\.kp-status-line\{[^}]*var\(--kp-surface-sub\)[^}]*var\(--kp-text-sub\)/.test(css0) && !/\.kp-status-line[^{]*\{[^}]*(caution|red)/.test(css0));
  st.items = [mk('시바스', 'L2', '07:30'), mk('이트코나졸캡슐', 'L3', '07:30')]; A.go('home');
  check('주의 블록(notice)이 있으면 "주의 없음" 블록은 없다', !!q('.kp-notice') && !q('.kp-status-line'));
  st.items = [mk('씬지록신', 'L1', '07:30')]; A.go('home');
  A.go('settings');
  check('설정에 "시연" 칸·스위치·시연 버튼이 없다', !q('[data-act="toggleDemo"]') && !q('[data-act="demoRx"]') && !T().includes('시연'));
  A.go('list'); click(qa('.mrow')[0]);
  check('내 약 상세에서 "복용 시간 고치기"로 시간 화면에 갈 수 있다', !!q('[data-act="to"][data-view="times"]'));
  A.go('times', { all: true });
  const ti = q('input.time'); ti.value = ''; ti.dispatchEvent(new w.Event('change', { bubbles: true }));
  check('하나뿐인 복용 시간은 지울 수 없다(시간 없는 약이 만들어지지 않음)', st.items[0].times.join() === '07:30' && ti.value === '07:30');
  const ev = (el) => el.dispatchEvent(new w.Event('change', { bubbles: true }));
  check('내 약 탭 시간 고치기도 같은 입력(숫자 키패드 텍스트 칸)', ti.getAttribute('inputmode') === 'numeric' && ti.type === 'text');
  ti.value = '오후 8시 반'; ev(ti);
  check('"오후 8시 반" → 20:30으로 정규화되어 저장', ti.value === '20:30' && st.items[0].times.join() === '20:30');
  ti.value = 'abc'; ev(ti);
  check('읽을 수 없으면 저장하지 않고 이전 값 유지 + 안내(보조색)', ti.value === '20:30' && st.items[0].times.join() === '20:30' && q('.time-msg').textContent === '시각을 다시 확인해 주세요 (예: 07:30)');
  ti.value = '730'; ev(ti); st.items[0].times = ['07:30'];
  check('주 버튼(.cta · .add · .mini.txt.on · .kp-add · .kp-close)은 --kp-cta-bg/--kp-cta-text만 쓰고 민트·검정 값을 직접 쓰지 않음', ['\\.cta', '\\.add', '\\.mini\\.txt\\.on', '\\.kp-add', '\\.kp-close'].every((sel) => { const rules = css0.match(new RegExp('(^|\\n)' + sel + '\\{[^}]*\\}', 'g')) || []; return rules.length > 0 && rules.every((r) => !/(mint-\\d+|black-\\d|#[0-9a-fA-F]{3,6})/.test(r.replace(/box-shadow[^;}]*/g, '')) && /--kp-cta-bg/.test(r)); }));
  A.go('home');
  check('하단 탭 3개(홈·내 약·마이), 뱃지 없음, 스타일은 --kp-* 변수', qa('.nav button').map((b) => b.textContent.trim()).join('|') === '홈|내 약|마이' && !q('.nav [class*="badge"]') && /\.nav\{[^}]*var\(--kp-surface\)[^}]*var\(--kp-border\)/.test(css0) && /\.nav button\{[^}]*var\(--kp-fs-caption\)[^}]*var\(--kp-text-sub\)/.test(css0));

  A.go('home');
  check('상단바: 벨·프로필 아이콘이 없고, 마이는 하단 탭으로만 간다. 내 약 탭 아이콘은 알약', !q('[aria-label="알림"]') && !q('.kp-top button') && !q('.kp-top [aria-label="마이"]') && q('.nav [data-view="list"] svg path').getAttribute('d').startsWith('M7 13.7') && (click(q('.nav [data-view="settings"]')), T().includes('계정 연결')));

  console.log('10) 시간 옮기기 제안 · 약봉투 시간 줄');
  const fire = (el, type) => el.dispatchEvent(new w.FocusEvent(type, { bubbles: true }));
  const typeAt = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); fire(el, 'focusout'); };
  st.items = [mk('씬지록신', 'L1', '07:00', '내과'), { id: 'C1', kind: 'supp', source: 'manual', name: '칼슘', ingredientKeys: ['calcium'], times: ['09:00'], batch: null }];
  delete st.newRx; w.localStorage.clear(); A.ui.nowMin = 6 * 60 + 40; A.ui.open = { morning: true }; A.go('home');
  const sg0 = A.homeModel().rows.find((r) => r.type === 'slot').notice.lines[0].suggestion;
  check('제안이 있으면 주의 문장 바로 아래에 작은 카드(제목·본문·버튼 2개), 자동으로 시간을 바꾸지 않음', !!sg0 && !!q('.kp-notice-first + .kp-sug') && q('.kp-sug-title').textContent === sg0.title && q('.kp-sug-body').textContent === sg0.body && q('.kp-sug-yes').textContent === sg0.yes && q('.kp-sug-no').textContent === sg0.no && st.items[1].times.join() === '09:00', JSON.stringify(sg0));
  check('카드 스타일: 배경 --kp-surface-sub, 주 버튼 --kp-cta-bg, 보조 버튼은 글자만(배경 없음)', /\.kp-sug\{[^}]*var\(--kp-surface-sub\)/.test(css0) && /\.kp-sug-yes\{[^}]*var\(--kp-cta-bg\)/.test(css0) && !/\.kp-sug-no\{[^}]*background/.test(css0));
  click(q('.kp-notice-first'));
  check('근거 시트의 본문(인용) 위에도 같은 제안 카드', !!q('.kp-sheet .kp-sug') && !!(q('.kp-sheet .kp-sug').compareDocumentPosition(q('.kp-sheet .kp-quote')) & 4));
  click('.kp-close');
  click('.kp-sug-no');
  const dk = 'kp:dismissed:' + today();
  check('[그대로 두기]: 오늘 날짜 키에 suggestionKey 저장, 그 제안만 사라지고 주의 문장은 그대로', JSON.stringify(JSON.parse(w.localStorage.getItem(dk))) === JSON.stringify([sg0.key]) && !q('.kp-sug') && !!q('.kp-notice-first') && st.items[1].times.join() === '09:00');
  A.go('home');
  check('다시 그려도(오늘) 제안은 숨은 채', !q('.kp-sug') && !!q('.kp-notice-first'));
  w.localStorage.clear(); A.go('home');
  const before = JSON.stringify(st.items);
  click('.kp-sug-yes');
  check('[옮기기]: 그 약의 시각만 바뀌고(09:00 → ' + sg0.toTime + ') 저장됨(localStorage)', st.items[1].times.join() === sg0.toTime && st.items[0].times.join() === '07:00' && w.KeepingStore.load().items.find((i) => i.id === 'C1').times.join() === sg0.toTime);
  const tst = q('.toast.has-undo');
  check('다시 그려져 아침 카드는 "주의 없음", 칼슘은 다른 시간대 카드로, 알림(done 문구 + 되돌리기)이 뜸', !q('.kp-sug') && !!tst && tst.textContent.includes(sg0.done) && !!tst.querySelector('.toast-undo') && qa('.kp-row--slot').length === 2 && !!q('.kp-row--slot .kp-status-line') && /\.toast\{[^}]*bottom:/.test(css0));
  click('.toast-undo');
  check('[되돌리기]: 보관해 둔 목록으로 복원(저장도)', JSON.stringify(st.items) === before && w.KeepingStore.load().items.find((i) => i.id === 'C1').times.join() === '09:00' && !q('.toast.has-undo'));
  await wait(10);

  A.ui.open = { morning: true }; A.go('home');
  click(qa('.kp-grp-main')[0]);
  const rows = qa('.kp-btime-h');
  check('약봉투 약 카드마다 "시간" 줄(지금 시각들, 영양제 카드에도)', rows.length === qa('.kp-bagcard').length && rows.length >= 1 && rows.every((r) => /\d\d:\d\d/.test(r.textContent)));
  click(rows[0]);
  const bi = q('.kp-btime-p input');
  check('누르면 아코디언이 펼쳐져 시각마다 입력 칸(숫자 키패드)', !!bi && bi.getAttribute('inputmode') === 'numeric' && q('.kp-btime-h').getAttribute('aria-expanded') === 'true');
  const tid = bi.dataset.id, itm = st.items.find((i) => i.id === tid), t0 = itm.times.join();
  typeAt(bi, 'abc');
  check('읽을 수 없으면 time_invalid(보조색 작은 글씨), 저장 안 됨', q('.kp-btime-p .time-msg').textContent === '시각을 다시 확인해 주세요 (예: 07:30)' && itm.times.join() === t0);
  typeAt(q('.kp-btime-p input'), '오전 8시');
  check('"오전 8시" → 08:00으로 정규화, 그 약의 times만 바뀜(다른 약은 그대로), 약봉투가 다시 그려져도 펼침 유지', itm.times.join() === '08:00' && q('.kp-btime-p input').value === '08:00' && st.items.filter((i) => i.id !== tid).every((i) => i.times.join() !== '08:00'));
  typeAt(q('.kp-btime-p input'), '1330');
  check('시간대가 달라지면(아침 → 점심) 홈으로 가서 다시 그려지고, time_band_hint 안내', itm.times.join() === '13:30' && !!q('.kp-hello') && qa('.toast').pop().textContent === '13:30은 점심 시간대로 들어가요', qa('.toast').map((e) => e.textContent).join('|'));
  check('저장소에도 반영', w.KeepingStore.load().items.find((i) => i.id === tid).times.join() === '13:30');
  check('스크립트 오류 없음', errors.length === 0, errors.join(' | '));
  console.log('\n통과 ' + ok + ' / 실패 ' + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('예외:', e); process.exit(2); });
