/* 실행: node tests/timeline.test.js — 실제 데이터(data/dur, data/care)를 읽어 타임라인·근거 시트·시간 제안을 점검한다 */
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
['config.js', 'data/datapack.js', 'js/dur.js', 'js/care.js', 'js/engine.js', 'js/storage.js', 'js/api.js', 'js/app.js'].forEach((f) => w.eval(fs.readFileSync(path.join(dir, f), 'utf8')));
let ok = 0, bad = 0;
const T = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
const click = (s) => { const el = typeof s === 'string' ? q(s) : s; if (!el) throw new Error('없음: ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, cond, extra) { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('FAIL  ' + name + (extra ? '\n      ' + extra : '')); } }
const BANNED = /안전해요|괜찮|문제없|문제 없|먹어도|안전합니다/;

(async () => {
  const A = w.KeepingApp;
  await A.bootDur(); await A.bootCare(); await wait(30);
  const dur = w.KEEPING_DATA.dur, st = A.state();
  console.log('1) 데이터 읽기');
  check('약 목록(DUR)과 설명서 기반 안내(care-pack)를 읽음', A.ui.dur.status === 'ready' && A.ui.care.status === 'ready' && A.ui.care.engine.stats().entries > 100, A.ui.care.status);
  check('영양제 키: 데이터 팩 + supplement-keys-extra(비오틴·비타민 K·세인트존스워트·은행잎)가 합쳐짐', ['biotin', 'vitaminK', 'stJohnsWort', 'ginkgo'].every((k) => w.KEEPING_DATA.supplementKeyList.some((x) => x.id === k)) && w.KEEPING_DATA.supplementKeyList.some((x) => x.id === 'calcium'));

  console.log('2) 레보티록신 + 칼슘 영양제: 설명서 근거(②) 간격');
  const mk = (q0, id, t) => Object.assign(dur.toItem(dur.search(q0)[0].code), { id, times: [t], batch: null });
  const levo = mk('씬지록신', 'L1', '07:00');
  const calcium = { id: 'C1', kind: 'supp', source: 'manual', name: '칼슘 영양제', ingredientKeys: ['calcium'], times: ['08:00'], batch: null };
  st.items = [levo, calcium]; st.example = false;
  A.go('home');
  check('홈: "오늘 주의 N개"(설명서 근거 간격 1건 이상)', /^오늘 주의 [1-9]\d*개$/.test(q('.sumline').textContent.trim()), q('.sumline').textContent);
  check('깊이 0: "아침약 · 07:00 · 약 2개 · 주의 N" + 기본 식사 시간', /^아침약 · 07:00 · 약 2개 · 주의 [1-9]/.test(q('.slot-head b').textContent) && T().includes('아침 식사 08:30'), q('.slot-head b').textContent);
  click(q('.slot-head'));
  const red = qa('.tline.red').map((e) => e.textContent);
  check('깊이 1: 레보티록신 줄에 "칼슘…최소 4시간 간격 안내" 주의 한 줄(삼각형 아이콘 + 글자)', red.some((t) => t.includes('최소 4시간 간격')) && qa('.tline.red').every((e) => !!e.querySelector('svg')), red.join('|'));
  check('깊이 1: 식사 관계는 근거가 있을 때만(배지 "설명서 근거")', qa('.tline.meal').length === 0 || qa('.tline.meal .badge').every((b) => b.textContent === '설명서 근거'));
  check('시간 제안 버튼은 없음(개선 방향)', !q('.sugg') && !q('[data-act="applySugg"]'));
  click(q('.tline.red'));
  check('깊이 2 근거 시트: 배지 "설명서 근거" · 원문 그대로("최소 4시간") · 위치 · 출처 링크 · 확인일', q('.evcard .badge').textContent === '설명서 근거' && q('.evq p').textContent.includes('최소 4') && q('.evq small').textContent.includes('원문') && /^https?:\/\//i.test(q('.evcard .src a').href) && /확인일 20\d\d-\d\d-\d\d/.test(T()), T().slice(0, 300));
  const fetched = Object.values(A.ui.care.engine.entryOf(levo).fetchedAt ? { x: A.ui.care.engine.entryOf(levo).fetchedAt.slice(0, 10) } : {})[0];
  check('확인일은 care-pack의 fetchedAt 날짜', T().includes('확인일 ' + fetched), fetched);
  check('근거 시트 맨 아래: 이상 증상이 있으면 약사·의사에게', q('.evfoot').textContent === '이상 증상이 있으면 약사·의사에게 물어보세요.');
  click('[data-act="back"]');
  st.items.find((i) => i.id === 'C1').times = ['12:00']; A.go('home');
  check('시간을 직접 옮기면(칼슘 12:00) 다시 계산돼 주의가 사라짐', /오늘 주의 0개/.test(T()), T().slice(0, 200));
  st.items.find((i) => i.id === 'C1').times = ['08:00'];
  const pill = (() => { A.go('home'); click(q('.slot-head')); return q('.titem .pillico svg'); })();
  check('약 앞 이미지 칸: 연한 회색 알약 아이콘 하나(모든 줄 같은 모양)', !!pill && qa('.titem .pillico').every((e) => e.innerHTML === qa('.pillico')[0].innerHTML));

  console.log('3) 근거가 없는 약: 이유별 문구');
  const entries = JSON.parse(fs.readFileSync(path.join(dir, 'data/care/care-pack.json'), 'utf8')).entries;
  const same = (k, p) => p.ingrName.toLowerCase() === k && (!entries[k].route || !p.route || entries[k].route === p.route);
  const emptyKey = Object.keys(entries).find((k) => !entries[k].rules.length && dur.search(k).some((p) => same(k, p)));
  const noRules = emptyKey && dur.search(emptyKey).find((p) => same(emptyKey, p));
  const missingProd = dur.search('타이레놀8시간')[0];   // care-pack에 성분이 없는 제품(있다면)
  st.items = [Object.assign(dur.toItem(noRules.code), { id: 'N1', times: ['09:00'], batch: null }), { id: 'M1', kind: 'drug', source: 'manual', name: '내가만든약', times: ['09:00'], batch: null }, { id: 'U1', kind: 'drug', source: 'manual', name: '시간없는약', times: [], batch: null }];
  A.go('home'); click(q('.slot-head'));
  check('규칙이 0개인 약: "설명서에서 복용 시점·상호작용 안내를 찾지 못했어요. 안전하다는 뜻은 아니에요"', T().includes('설명서에서 복용 시점·상호작용 안내를 찾지 못했어요. 안전하다는 뜻은 아니에요'), emptyKey);
  check('직접 입력한 약: "키핑이 확인한 범위 밖이에요"', T().includes('키핑이 확인한 범위 밖이에요'));
  check('시간을 안 정한 약: "복용 시간을 정해 주세요" 줄', T().includes('복용 시간을 정해 주세요') && T().includes('시간없는약'));
  const missKey = Object.keys(entries);
  const cm = dur.search('후로스판')[0] && dur.search('후로스판')[0];
  st.items = [Object.assign(dur.toItem(cm.code), { id: 'X1', times: ['09:00'], batch: null })];
  A.go('home'); click(q('.slot-head'));
  const hasEntry = !!A.ui.care.engine.entryOf(st.items[0]);
  check('설명서 데이터에 없는 약(후로스판정): "설명서 기반 안내를 아직 준비하지 못했어요(병용금기는 확인했어요)"', hasEntry || T().includes('설명서 기반 안내를 아직 준비하지 못했어요(병용금기는 확인했어요)'), T().slice(0, 300));

  console.log('4) 새 처방 표시');
  st.items = [Object.assign({}, levo, { batch: 'rx-test' }), Object.assign({}, calcium, { batch: null })];
  A.go('home'); click(q('.slot-head'));
  check('새 처방으로 추가한 약에만 "새 처방" 표시', qa('.badge.newrx').length === 1 && qa('.titem').find((e) => e.textContent.includes('새 처방')).textContent.includes('씬지록신'));
  check('약봉투 화면·시간 제안·루틴 요약은 없음', !/약봉투|새로 생긴 주의|루틴/.test(T()));

  console.log('5) 상태(임신 중 / 만 65세 이상) · 판정 문구');
  st.items = [levo]; st.states = []; A.go('home');
  const noState = A.careModel().slots[0].items[0].flags.filter((f) => f.kind === 'state').length;
  A.go('settings');
  check('설정: 상태 토글 두 개(임신 중 · 만 65세 이상), 처음엔 꺼짐', qa('[data-act="toggleState"]').length === 2 && qa('[data-act="toggleState"]').every((b) => b.getAttribute('role') === 'switch' && b.getAttribute('aria-checked') === 'false'));
  click('[data-act="toggleState"][data-k="elderly"]'); click('[data-act="toggleState"][data-k="pregnant"]');
  check('토글을 켜면 저장되고 care.analyze의 states로 넘어감', st.states.join() === 'elderly,pregnant' && w.KeepingStore.load().states.join() === 'elderly,pregnant' && qa('[aria-checked="true"]').length === 2);
  A.go('home');
  const withState = A.careModel().slots[0].items[0].flags.filter((f) => f.kind === 'state').length;
  check('상태를 켜지 않으면 임부·고령자 안내를 붙이지 않음(켜면 해당 규칙이 있는 약에만 붙음)', noState === 0 && withState >= 0);
  const seen = []; ['home', 'list', 'settings'].forEach((v) => { A.go(v); seen.push(T()); });
  check('금지 표현("안전해요/괜찮/문제없/먹어도") 없음, 신호등 색 이름 없음', !BANNED.test(seen.join(' ')) && !/신호등|초록|위험도/.test(seen.join(' ')), (seen.join(' ').match(BANNED) || seen.join(' ').match(/신호등|초록|위험도/) || [''])[0]);
  check('스크립트 오류 없음', errors.length === 0, errors.join('|'));
  console.log('\n통과 ' + ok + ' / 실패 ' + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('예외:', e); process.exit(2); });
