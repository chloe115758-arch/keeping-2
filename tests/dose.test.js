/* 실행: node tests/dose.test.js  (복용법 입력 화면 + 시간 바텀시트) */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(dir + '/index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '').replace(/<link[^>]+>/g, '');
const w = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true }).window;
const d = w.document;
w.scrollTo = () => {};
w.fetch = (u) => Promise.resolve(u === 'data/copy/greeting.json' ? { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(path.join(dir, u), 'utf8')) } : { ok: false, status: 404, json: async () => ({}) });
['config.js', 'data/datapack.js', 'js/dur.js', 'js/drugname.js', 'js/care.js', 'js/josa.js', 'js/timeinput.js', 'js/greeting.js', 'js/suppsearch.js', 'js/homevm.js', 'js/engine.js', 'js/storage.js', 'js/api.js', 'js/app.js'].forEach((f) => w.eval(fs.readFileSync(path.join(dir, f), 'utf8')));
let ok = 0, bad = 0;
const q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
const click = (s) => (typeof s === 'string' ? q(s) : s).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const check = (name, cond) => { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('FAIL  ' + name); } };
const A = () => w.KeepingApp;
const chip = (act, v) => q(`[data-act="${act}"][data-v="${v}"]`), slot = (id) => q(`[data-act="doseSlot"][data-slot="${id}"]`);
const pickSlot = (id, time) => { click(slot(id)); if (time) { const i = q('#tsheet-in'); i.value = time; i.dispatchEvent(new w.Event('input', { bubbles: true })); } click('[data-act="timeSave"]'); };
const save = () => q('#dosesave');
const start = () => { A().state().items = []; A().go('add', { batch: 'b' }); A().startDose({ id: 'X1', kind: 'drug', source: 'manual', name: '테스트약', times: [] }); };

(async () => {
  await A().bootCopy(); await A().bootCare();
  console.log('복용법 입력');
  start();
  check('제목 · 약 카드 · 구역 3개 · 칩 글자가 시안 그대로, 설명서가 없는 약이라 "주의사항" 줄 없음', q('.dose-title').textContent === '복용법 입력' && q('.dose-name b').textContent === '테스트약' &&
    qa('.dose-sec h2').map((h) => h.textContent).join('|') === '하루에 몇 번 드시나요?|언제 드세요?|식전 / 식후' &&
    qa('#dg-count .dchip').map((c) => c.textContent).join('|') === '1회|2회|3회|필요 시|직접 입력' && qa('#dg-slot .dchip').map((c) => c.textContent).join('|') === '아침|점심|저녁' && qa('#dg-meal .dchip').map((c) => c.textContent).join('|') === '식전|식후|식사무관' && !q('.dose-warn'));
  check('아무것도 고르지 않으면 [저장] 비활성', save().disabled === true);
  click(chip('doseCount', '2'));
  check('횟수는 하나만 선택(2회)', qa('#dg-count .dchip.on').length === 1 && chip('doseCount', '2').classList.contains('on') && (click(chip('doseCount', '3')), qa('#dg-count .dchip.on').length === 1));
  click(chip('doseCount', '2')); pickSlot('morning');
  check('언제 칩을 누르면 시간 시트(제목 "아침", 기본 07:30), 저장하면 칩이 "아침 07:30"', !q('.kp-tsheet') && slot('morning').textContent === '아침 07:30' && slot('morning').getAttribute('aria-checked') === 'true');
  check('횟수(2회)를 다 못 채워도 시간이 1개면 [저장] 활성(횟수는 최대 개수일 뿐)', save().disabled === false);
  pickSlot('dinner', '1930');
  check('2/2가 되면 [저장] 활성, 시각 "1930"은 19:30으로', save().disabled === false && slot('dinner').textContent === '저녁 19:30');
  click(slot('lunch'));
  check('횟수만큼 찼으면 남은 칩은 흐려지고 눌러도 시트가 열리지 않음', slot('lunch').getAttribute('aria-disabled') === 'true' && !q('.kp-tsheet'));
  click(slot('morning'));
  check('선택된 칩을 다시 누르면 시트 없이 해제(저녁이 남아 있어 [저장]은 그대로 활성)', !q('.kp-tsheet') && slot('morning').textContent === '아침' && save().disabled === false);
  pickSlot('morning', '730');
  click(chip('doseMeal', 'after')); click(chip('doseMeal', 'after'));
  check('식전/식후는 선택 사항: 다시 누르면 해제', !chip('doseMeal', 'after').classList.contains('on'));
  click(chip('doseMeal', 'before')); click(chip('doseMeal', 'any'));
  check('식전/식후는 하나만 선택', qa('#dg-meal .dchip.on').length === 1 && chip('doseMeal', 'any').classList.contains('on'));
  click(save());
  const it = A().state().items[0];
  check('저장: times · timesPerDay · meal이 항목에 들어가고 목록에 담김, prn 없음', !!it && it.times.join() === '07:30,19:30' && it.timesPerDay === 2 && it.meal === 'any' && !('prn' in it));

  start(); click(chip('doseCount', '3')); pickSlot('dinner'); pickSlot('morning'); pickSlot('lunch'); click(chip('doseCount', '2'));
  check('횟수를 줄이면 먼저 고른 시각부터 남고 나머지는 해제(3→2: 저녁·아침 남고 점심 해제)', slot('dinner').getAttribute('aria-checked') === 'true' && slot('morning').getAttribute('aria-checked') === 'true' && slot('lunch').getAttribute('aria-checked') !== 'true' && save().disabled === false);
  click(chip('doseCount', '1'));
  check('2→1: 저녁만 남음', slot('dinner').getAttribute('aria-checked') === 'true' && slot('morning').getAttribute('aria-checked') !== 'true');
  start(); click(chip('doseCount', '1')); pickSlot('lunch');
  check('1회: 1개만 고르면 활성, 나머지 칩은 선택 불가', save().disabled === false && slot('morning').getAttribute('aria-disabled') === 'true');
  click(chip('doseCount', 'prn'));
  check('필요 시: "언제"는 흐려지고 눌러도 무반응, 고른 시각은 지워지며 [저장] 활성', save().disabled === false && qa('#dg-slot .dchip.off').length === 3 && (click(slot('morning')), !q('.kp-tsheet')) && qa('#dg-slot .dchip.on').length === 0);
  click(save());
  const it2 = A().state().items[0];
  check('필요 시 저장: prn true · times [] · timesPerDay 없음', it2.prn === true && it2.times.length === 0 && !('timesPerDay' in it2) && !('meal' in it2));

  start(); click(chip('doseCount', 'custom'));
  const n = () => q('#dcount'), type = (v) => { n().value = v; n().dispatchEvent(new w.Event('input', { bubbles: true })); };
  check('직접 입력: 칩이 숫자 입력 칸으로 바뀜(숫자 키패드, 한 자리)', !!n() && n().getAttribute('inputmode') === 'numeric' && n().maxLength === 1 && qa('#dg-count .dchip').length === 5);
  type('9'); check('1~6 밖의 숫자는 받지 않음', n().value === '');
  type('0'); check('0도 받지 않음', n().value === '');
  type('2'); pickSlot('morning'); pickSlot('lunch');
  check('2를 치고 2개를 고르면 [저장] 활성', n().value === '2' && save().disabled === false);
  type('3'); check('횟수를 3으로 바꿔도 시간 2개로 [저장] 활성', save().disabled === false);
  type('5'); pickSlot('dinner');
  check('5회: 칩이 3개뿐이라 3개를 고르면 활성, timesPerDay는 5', save().disabled === false); click(save());
  check('저장된 timesPerDay 5', A().state().items[0].timesPerDay === 5 && A().state().items[0].times.length === 3);

  start(); click(chip('doseCount', 'custom')); n().dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  check('비운 채 벗어나면 다시 "직접 입력" 칩으로', !q('#dcount') && chip('doseCount', 'custom').textContent === '직접 입력' && !chip('doseCount', 'custom').classList.contains('on'));

  start(); click(chip('doseCount', '3')); pickSlot('lunch');
  check('3회를 골라도 시간 1개만 고르면 [저장] 활성, 저장하면 timesPerDay 3·시간 1개', save().disabled === false && (click(save()), A().state().items.at(-1).timesPerDay === 3 && A().state().items.at(-1).times.length === 1));
  start(); pickSlot('morning'); pickSlot('lunch');
  check('횟수를 안 골랐으면 최대 3개까지, 저장하면 timesPerDay는 고른 시간 개수(2)', save().disabled === false && (click(save()), A().state().items.at(-1).timesPerDay === 2));

  console.log('시간 바텀시트');
  start(); click(chip('doseCount', '1')); click(slot('lunch'));
  const sh = q('.kp-tsheet');
  check('시트 틀: 어두운 막 · 손잡이 · 제목 · ✕ · 입력칸(12:30, 숫자) · 아래 [저장]', !!sh && !!q('.kp-scrim') && !!sh.querySelector('.kp-grab') && q('#kp-sheet-title').textContent === '점심' && !!sh.querySelector('.kp-icbtn') && q('#tsheet-in').value === '12:30' && q('#tsheet-in').getAttribute('inputmode') === 'numeric' && sh.querySelector('.kp-sheet-foot [data-act="timeSave"]').textContent === '저장' && q('#app').hasAttribute('inert'));
  const i = q('#tsheet-in');
  i.value = '730'; i.dispatchEvent(new w.Event('input', { bubbles: true })); i.dispatchEvent(new w.FocusEvent('blur'));
  check('"730"은 07:30으로, 점심 칩과 다른 시간대면 안내(time_band_hint)', i.value === '07:30' && q('#tsheet-msg').textContent === '07:30은 아침 시간대로 들어가요');
  i.value = '99'; i.dispatchEvent(new w.Event('input', { bubbles: true }));
  check('읽을 수 없으면 [저장] 비활성', q('[data-act="timeSave"]').disabled === true);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc로 닫으면 선택되지 않은 그대로, 화면 잠금 해제', !q('.kp-tsheet') && !slot('lunch').classList.contains('on') && !q('#app').hasAttribute('inert') && d.body.style.overflow === '');
  click(slot('lunch')); click('[data-act="closeSheet"].kp-icbtn');
  check('✕로 닫아도 그대로', !q('.kp-tsheet') && !slot('lunch').classList.contains('on'));

  console.log('\n통과 ' + ok + ' / 실패 ' + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('예외:', e); process.exit(2); });
