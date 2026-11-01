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
['config.js', 'data/datapack.js', 'js/dur.js', 'js/care.js', 'js/josa.js', 'js/greeting.js', 'js/homevm.js', 'js/engine.js', 'js/storage.js', 'js/api.js', 'js/app.js'].forEach((f) => w.eval(fs.readFileSync(path.join(dir, f), 'utf8')));
let ok = 0, bad = 0;
const T = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
const click = (s) => { const el = typeof s === 'string' ? q(s) : s; if (!el) throw new Error('없음: ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, cond, extra) { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('FAIL  ' + name + (extra ? '\n      ' + extra : '')); } }
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
  check('약마다 카드: 이름(display) · 규격·업체 · 구분 칩 · 먹는 시간 · 성분', qa('.kp-bagcard').length === bagModel.items.length && qa('.kp-bagcard').every((c, i) => c.querySelector('.kp-bag-name').textContent === bagModel.items[i].display && !!c.querySelector('.kp-chip') && c.textContent.includes('먹는 시간')));
  check('복용법·용량 칸이 없다', !/복용법|1회|용량|하루 \d/.test(q('.kp-bag-list').textContent));
  check('맨 아래 작은 글씨: scope + footer(모델 값 그대로)', q('.kp-bag-foot').textContent.includes(bagModel.scope) && q('.kp-bag-foot').textContent.includes(bagModel.footer));
  const nb = q('.kp-bagcard .kp-notice');
  check('카드 안 주의 줄을 누르면 근거 시트가 열린다(없으면 칸 자체가 없음)', !nb ? !q('.kp-bagcard .kp-notice') : (click(nb), !!q('.kp-sheet')));
  if (q('.kp-sheet')) click('.kp-close');
  click('[data-act="back"]');
  check('뒤로 가면 홈', !!q('.kp-hello'));

  console.log('6) 근거 시트 접근성');
  click(q('.kp-notice-first'));
  const lay = q('.kp-layer');
  check('시트는 role=dialog aria-modal, 홈은 aria-hidden/inert, 첫 포커스는 ✕', q('.kp-sheet').getAttribute('aria-modal') === 'true' && d.getElementById('app').hasAttribute('inert') && d.activeElement === q('.kp-sheet .kp-icbtn') && !!lay);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc로 닫히고 홈이 다시 활성, 포커스가 눌렀던 줄로 돌아감', !q('.kp-sheet') && !d.getElementById('app').hasAttribute('inert') && d.activeElement && d.activeElement.classList.contains('kp-notice-first'));

  console.log('7) 진료과 한 줄');
  A.go('detail', { id: 'L1' });
  check('처방약 상세: 칩 [내과][피부과][이비인후과][정형외과][소아과][직접 입력][건너뛰기]', qa('.deptq .chip').map((c) => c.textContent).join('|') === '내과|피부과|이비인후과|정형외과|소아과|직접 입력|건너뛰기', qa('.deptq .chip').map((c) => c.textContent).join('|'));
  check('현재 진료과(내과)가 선택 표시', qa('.deptq .chip.on').map((c) => c.textContent).join() === '내과');
  click(qa('.deptq .chip').find((c) => c.textContent === '정형외과'));
  check('칩을 고르면 item.dept에 저장', st.items.find((i) => i.id === 'L1').dept === '정형외과' && w.KeepingStore.load().items.find((i) => i.id === 'L1').dept === '정형외과');
  click(qa('.deptq .chip').find((c) => c.textContent === '건너뛰기'));
  check('건너뛰기는 dept 없이 둔다', !('dept' in st.items.find((i) => i.id === 'L1')));
  click(qa('.deptq .chip').find((c) => c.textContent === '직접 입력'));
  q('#deptin').value = '신경과'; click('[data-act="deptSave"]');
  check('직접 입력한 진료과 저장 + 칩에 표시', st.items.find((i) => i.id === 'L1').dept === '신경과' && qa('.deptq .chip.on').map((c) => c.textContent).join() === '신경과');
  A.go('home');
  check('홈 묶음 이름이 바뀐 진료과를 따라간다("신경과 처방약")', qa('.kp-grp-txt b').some((b) => b.textContent === '신경과 처방약'));
  A.go('detail', { id: 'C1' });
  check('영양제 상세에는 진료과를 묻지 않는다', !q('.deptq'));
  A.go('detail', { id: 'A1' });
  check('일반의약품(약국약) 상세에도 묻지 않는다', !q('.deptq'));
  check('등록 단계(약 추가 화면)에서 처방약을 고르면 같은 칩 줄이 나온다', (() => { st.items.push(Object.assign(mk('시바스', 'S2', '21:00'), { batch: 'rx-t' })); A.go('add', { batch: 'rx-t' }); return !!q('#selected .deptq') && qa('#selected .deptq .chip').length === 7; })());

  console.log('8) 새 처방 칩 · 공식 지정 시트의 조건 줄');
  st.items = [mk('씬지록신', 'L1', '07:00', '내과')]; delete st.newRx; A.ui.nowMin = 6 * 60 + 40; A.ui.open = {}; A.go('home');
  check('newItemIds를 안 넘기면 칩이 없다', !qa('.kp-newchip').length);
  st.items = []; st.example = true; st.demo = true; A.go('settings'); click('[data-act="demoRx"]'); click('[data-act="demoConfirm"]');
  const chips = qa('.kp-newchip');
  check('새 처방 알림 시연 → 등록 → 홈에 "새 처방" 칩(모델의 newLabel)', chips.length >= 1 && chips.every((c) => c.textContent === A.homeModel().rows.filter((r) => r.type === 'slot')[0].groups.find((g) => g.isNew).newLabel), String(chips.length));
  check('칩은 isNew인 묶음에만, 개수가 모델과 같다', chips.length === A.homeModel().rows.filter((r) => r.type === 'slot').reduce((a, r) => a + r.groups.filter((g) => g.isNew).length, 0) && st.newRx.ids.length === 4);
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

  console.log('9) 시연 칸 · 시간 없는 약 막기 · 하단 탭');
  st.items = [mk('씬지록신', 'L1', '07:30')]; st.demo = false; st.example = false; A.go('home');
  check('시연이 꺼져 있으면 시연 띠·시연 버튼이 홈에 없다', !q('.kp-band') && !q('[data-act="demoRx"]'));
  A.go('settings');
  check('설정 맨 아래 "시연" 칸: 스위치(꺼짐), 꺼져 있으면 시연 버튼 없음', !!q('[data-act="toggleDemo"][aria-checked="false"]') && !q('[data-act="demoRx"]'));
  click('[data-act="toggleDemo"]');
  check('켜면 스위치가 켜지고 "새 처방 알림 시연 보기" 버튼이 나타남(저장됨)', !!q('[data-act="toggleDemo"][aria-checked="true"]') && !!q('[data-act="demoRx"]') && w.KeepingStore.load().demo === true);
  A.go('home');
  check('켜면 홈 맨 위에 "시연 데이터예요" 띠', q('.kp-band').textContent === '시연 데이터예요' && q('.kp-band').compareDocumentPosition(q('.kp-top')) & 4);
  st.demo = false;
  A.go('list'); click(qa('.mrow')[0]);
  check('내 약 상세에서 "복용 시간 고치기"로 시간 화면에 갈 수 있다', !!q('[data-act="to"][data-view="times"]'));
  A.go('times', { all: true });
  const ti = q('input.time'); ti.value = ''; ti.dispatchEvent(new w.Event('change', { bubbles: true }));
  check('하나뿐인 복용 시간은 지울 수 없다(시간 없는 약이 만들어지지 않음)', st.items[0].times.join() === '07:30' && ti.value === '07:30');
  A.go('home');
  const css = fs.readFileSync(path.join(dir, 'css/style.css'), 'utf8');
  check('하단 탭 3개(홈·내 약·마이), 뱃지 없음, 스타일은 --kp-* 변수', qa('.nav button').map((b) => b.textContent.trim()).join('|') === '홈|내 약|마이' && !q('.nav [class*="badge"]') && /\.nav\{[^}]*var\(--kp-surface\)[^}]*var\(--kp-border\)/.test(css) && /\.nav button\{[^}]*var\(--kp-fs-caption\)[^}]*var\(--kp-text-sub\)/.test(css));

  check('스크립트 오류 없음', errors.length === 0, errors.join(' | '));
  console.log('\n통과 ' + ok + ' / 실패 ' + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('예외:', e); process.exit(2); });
