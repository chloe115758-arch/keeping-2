/* 실행: node tests/layout.test.js  — 실제 브라우저(Playwright)로 여러 화면 폭에서 위치를 재서 레이아웃을 점검한다.
 * 브라우저를 찾지 못하면 "건너뜀"을 크게 알리고 끝낸다(환경 변수 KEEPING_CHROME으로 경로 지정 가능).
 * 점검: 앱은 가운데의 폰 폭 열 하나 · 하단 영역은 열 안 · 버튼과 링크가 겹치지 않음 · 환영 화면 위계 · 가로 넘침 없음 · 로딩 중 화면이 튀지 않음 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('건너뜀: playwright-core가 없어 레이아웃을 점검하지 못했어요. (npm install)'); process.exit(0); }
const CANDIDATES = [process.env.KEEPING_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) { console.log('건너뜀: 크롬을 찾지 못해 레이아웃을 점검하지 못했어요. KEEPING_CHROME에 경로를 지정하세요.'); process.exit(0); }

const root = path.join(__dirname, '..');
const GAP = +/--kp-gap-page:\s*(\d+)px/.exec(fs.readFileSync(path.join(root, 'css/design-tokens.css'), 'utf8'))[1];   // 모든 화면의 가로 여백(토큰 값)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

let ok = 0, bad = 0;
function check(name, cond, extra) { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('FAIL  ' + name + (extra ? '\n      ' + extra : '')); } }
const VIEWPORTS = [[360, 800], [393, 852], [402, 874], [768, 1024], [1280, 800], [1440, 900]];

const RECTS = (sels) => {
  const out = {};
  for (const [k, s] of Object.entries(sels)) {
    const e = document.querySelector(s); if (!e) { out[k] = null; continue; }
    const r = e.getBoundingClientRect(); out[k] = { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  }
  out.vw = document.documentElement.clientWidth; out.vh = window.innerHeight; out.scrollW = document.documentElement.scrollWidth;
  return out;
};
const SELS = { app: '#app', screen: 'main.screen', bar: '.actionbar', nav: '.nav', h1: 'h1', brand: '.brand', sub: '.welcome .sub', fine: '.welcome .fine', start: '[data-act="start"]' };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch({ executablePath: chrome });
  try {
    for (const [w, h] of VIEWPORTS) {
      console.log(`\n${w}×${h}`);
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      await page.route('**/data/dur/*.json', async (r) => { await new Promise((x) => setTimeout(x, 500)); r.continue(); });   // 로딩 중 상태를 만든다
      await page.goto(base);
      const R = () => page.evaluate(RECTS, SELS);
      const inCol = (r, app, tol = 1) => r && app && r.x >= app.x - tol && r.r <= app.r + tol;

      // ── 스플래시 → 환영 (데이터 로딩과 상관없이 바로 그려진다)
      await page.waitForSelector('.splash', { timeout: 3000 });
      check(`${w}: 스플래시는 데이터 로딩 전에 바로 보임`, await page.evaluate(() => KeepingApp.ui.dur.status === 'loading' && !!document.querySelector('.splash')));
      await page.click('.splash'); await page.waitForSelector('.welcome');
      const loading = await R();
      const app = loading.app;
      check(`${w}: 앱은 폰 폭 열 하나(최대 430px)`, app.w <= 430.5 && app.w >= Math.min(w, 430) - 1, `app.w=${app.w}`);
      if (w > 431) check(`${w}: 열이 화면 가운데(좌우 여백 같음)`, Math.abs(app.x - (loading.vw - app.r)) <= 1, `좌 ${app.x} / 우 ${loading.vw - app.r}`);
      check(`${w}: 가로 넘침 없음`, loading.scrollW <= loading.vw, `scrollW=${loading.scrollW} vw=${loading.vw}`);

      // ── 환영 화면 위계 · 하단 영역
      check(`${w}: 환영 — 하단 영역이 열 안에 꽉 참(폭 같음)`, loading.bar && Math.abs(loading.bar.x - app.x) <= 1 && Math.abs(loading.bar.r - app.r) <= 1, JSON.stringify(loading.bar));
      check(`${w}: 환영 — 시작하기 버튼 높이 56, 열 좌우 --kp-gap-page 안쪽`, loading.start && Math.abs(loading.start.h - 56) <= 1 && Math.abs(loading.start.x - (app.x + GAP)) <= 1 && Math.abs(app.r - GAP - loading.start.r) <= 1, JSON.stringify(loading.start));
      check(`${w}: 환영 — 브랜드 → 제목 → 설명 → 고지 순서, 고지는 설명 아래 16px`, loading.brand.b <= loading.h1.y && loading.h1.b <= loading.sub.y && Math.abs(loading.fine.y - loading.sub.b - 16) <= 1, `설명→고지 ${Math.round(loading.fine.y - loading.sub.b)}px`);
      if (h >= 700) check(`${w}: 환영 — 제목이 위쪽 1/3 부근에서 시작`, loading.h1.y >= h * 0.25 && loading.h1.y <= h * 0.42, `제목 위 ${Math.round(loading.h1.y)} / 화면 높이 ${h}`);
      check(`${w}: 환영 — 글자 왼쪽이 열 안쪽 --kp-gap-page에 맞음(제목·설명·고지·버튼)`, [loading.h1, loading.sub, loading.fine, loading.start].every((r) => Math.abs(r.x - (app.x + GAP)) <= 1));
      const frame = await page.evaluate(() => { const a = document.getElementById('app'), cs = getComputedStyle(a), tk = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase(), hex = (c) => '#' + c.match(/\d+/g).slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join(''); return { vw: document.documentElement.clientWidth, w: a.getBoundingClientRect().width, shadow: cs.boxShadow, radius: parseFloat(cs.borderTopLeftRadius), bg: hex(cs.backgroundColor), body: hex(getComputedStyle(document.body).backgroundColor), outer: tk('--kp-bg-outer'), page: tk('--kp-bg-page'), frameShadow: tk('--kp-shadow-frame') }; });
      if (w > 480) check(`${w}: 앱 틀 — 바깥은 --kp-bg-outer, 앱은 흰 배경·큰 모서리·--kp-shadow-frame(테두리 선 없음), 폭 430`, frame.body === frame.outer && frame.bg === frame.page && frame.radius >= 24 && frame.shadow !== 'none' && !/0px 0px 0px 1px/.test(frame.shadow) && Math.abs(frame.w - 430) <= 1, JSON.stringify(frame));
      else check(`${w}: 앱 틀 — 틀 없이 전체 화면 흰 배경`, frame.shadow === 'none' && frame.radius === 0 && frame.bg === frame.page && frame.page === '#ffffff' && Math.abs(frame.w - frame.vw) <= 1, JSON.stringify(frame));

      // ── 로딩이 끝나도 환영 화면 위치가 변하지 않는다
      await page.waitForFunction(() => KeepingApp.ui.dur.status === 'ready'); await page.waitForTimeout(150);
      const ready = await R();
      const same = ['h1', 'sub', 'fine', 'start', 'bar'].every((k) => ready[k] && Math.abs(ready[k].y - loading[k].y) < 0.5 && Math.abs(ready[k].x - loading[k].x) < 0.5);
      check(`${w}: 환영 — 데이터 로딩이 끝나도 위치가 안 변함`, same);

      // ── 저장 안내 → 약 검색 → 영양제 → 시간 입력: 하단 영역이 열 안, 요소가 겹치지 않음
      const barOK = async (label) => {
        const r = await R();
        check(`${w}: ${label} — 하단 영역이 열 안(좌우 일치)`, r.bar && Math.abs(r.bar.x - r.app.x) <= 1 && Math.abs(r.bar.r - r.app.r) <= 1, JSON.stringify(r.bar));
        check(`${w}: ${label} — 가로 넘침 없음`, r.scrollW <= r.vw);
        const kids = await page.evaluate(() => [...document.querySelectorAll('.actionbar > *')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; }));
        const bar = r.bar;
        check(`${w}: ${label} — 하단 영역 안의 요소가 영역을 벗어나지 않음`, kids.every((k) => k.y >= bar.y - 0.5 && k.b <= bar.b + 0.5 && k.x >= bar.x - 0.5 && k.r <= bar.r + 0.5));
        let overlap = false; for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i], c = kids[j]; if (a.x < c.r - 0.5 && c.x < a.r - 0.5 && a.y < c.b - 0.5 && c.y < a.b - 0.5) overlap = true; }
        check(`${w}: ${label} — 하단 영역 안의 버튼끼리 겹치지 않음`, !overlap);
        check(`${w}: ${label} — 제목 왼쪽이 열 안쪽 --kp-gap-page`, !r.h1 || Math.abs(r.h1.x - (r.app.x + GAP)) <= 1);
        return r;
      };
      await page.click('[data-act="start"]'); await page.waitForSelector('.agree'); await barOK('저장 안내');
      await page.click('[data-act="agree"]'); await page.click('#agreenext'); await page.waitForSelector('#nextbtn');
      const drugs = await barOK('약 검색');
      check(`${w}: 약 검색 — 다음 버튼 높이 56, 하단 영역에 건너뛰기 없음`, await page.evaluate(() => { const n = document.querySelector('#nextbtn').getBoundingClientRect(); return Math.abs(n.height - 56) <= 1 && !document.querySelector('.skipbtn'); }));
      check(`${w}: 약 검색 — 화면에 "건너뛰기"가 없음`, await page.evaluate(() => !/건너뛰기/.test(document.getElementById('app').textContent)));
      await page.evaluate(() => { KeepingApp.state().items.push({ id: 'lt1', kind: 'drug', source: 'manual', name: '레이아웃약', times: ['07:30'], batch: null }); KeepingApp.go('onb-drugs'); }); await page.click('#nextbtn'); await page.waitForSelector('.manual-chip'); await barOK('영양제');
      await page.click('.skipbtn'); await page.waitForSelector('.kp-top');

      // ── 홈 · 결과 (하단 탭이 열 안)
      await page.evaluate(() => KeepingApp.go('welcome')); await page.evaluate(() => { KeepingApp.seedExample(); KeepingApp.go('home'); }); await page.waitForSelector('.nav');
      let r = await R();
      check(`${w}: 홈 — 하단 탭이 열 안`, r.nav && Math.abs(r.nav.x - r.app.x) <= 1 && Math.abs(r.nav.r - r.app.r) <= 1 && r.scrollW <= r.vw);
      const home = await page.evaluate(() => { const rc = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, r: r.right, w: r.width, h: r.height, y: r.top }; }; return { card: rc(document.querySelector('.kp-hello')), bar: rc(document.querySelector('.kp-top')), cards: [...document.querySelectorAll('.kp-row--slot .kp-slot')].map(rc), chks: [...document.querySelectorAll('.kp-slot-head')].map(rc), boxes: [...document.querySelectorAll('.kp-check')].map(rc).filter((b) => b.w > 0), btn: rc(document.querySelector('.kp-add')), tabs: [...document.querySelectorAll('.nav button')].map(rc) }; });
      check(`${w}: 홈 — 인사 카드 좌우 --kp-gap-page, 상단바가 열 안`, Math.abs(home.card.x - (r.app.x + GAP)) <= 1 && Math.abs(r.app.r - GAP - home.card.r) <= 1 && home.bar.w <= r.app.w);
      check(`${w}: 홈 — 시간대 카드: 왼쪽은 시간 라벨+선 뒤(시간 열 52−2 + 선 32 = 82), 오른쪽은 --kp-gap-page`, home.cards.length >= 2 && home.cards.every((c) => Math.abs(c.x - (r.app.x + 82)) <= 1 && Math.abs(r.app.r - GAP - c.r) <= 1));
      const tgap = await page.evaluate(() => { const t = document.querySelector('.kp-row--slot .kp-time'), nd = document.querySelector('.kp-row--slot .kp-node'); if (!t || !nd) return null; const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect(); return { gap: nd.getBoundingClientRect().left - tr.right, left: tr.left }; });
      check(`${w}: 홈 — 시간 라벨과 원 사이 6px, 라벨이 화면 밖으로 나가지 않음`, tgap && Math.abs(tgap.gap - 6) <= 0.5 && tgap.left >= 0, JSON.stringify(tgap));
      check(`${w}: 홈 — 체크 터치 영역 44px 이상, 맨 아래 버튼 높이 56`, home.boxes.length >= 1 && home.boxes.every((b) => b.w >= 44 && b.h >= 44) && Math.abs(home.btn.h - 56) <= 1);
      check(`${w}: 홈 — 시간대 카드 헤더(펼침 버튼) 높이 56px 이상`, home.chks.length >= 2 && home.chks.every((c) => c.w >= 44 && c.h >= 56));
      check(`${w}: 홈 — 하단 탭 3개가 열 폭을 나눠 가짐(터치 영역 44px 이상)`, home.tabs.length === 3 && home.tabs.every((t) => t.w >= 44 && t.h >= 44) && Math.abs(home.tabs[0].x - r.app.x) <= 1 && Math.abs(home.tabs[2].r - r.app.r) <= 1);
      check(`${w}: 오류 없음`, errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

    // ── 로딩 중 다시 그려질 때 화면이 튀지 않는다 (누적 레이아웃 이동 CLS)
    console.log('\n로딩 중 화면 안정성 (402×874)');
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
    const page = await ctx.newPage();
    await page.route('**/data/dur/*.json', async (r) => { await new Promise((x) => setTimeout(x, 700)); r.continue(); });
    await page.addInitScript(() => { window.__cls = 0; window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(+e.value.toFixed(4)); } }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(base); await page.evaluate(() => document.fonts.ready);
    await page.click('.splash'); await page.click('[data-act="start"]'); await page.click('[data-act="agree"]'); await page.click('#agreenext'); await page.waitForSelector('#nextbtn');
    const y0 = await page.evaluate(() => { window.__cls = 0; window.__shifts = []; return [...document.querySelectorAll('h1, .inp, .count, .lbl')].map((e) => Math.round(e.getBoundingClientRect().top)); });
    await page.waitForFunction(() => KeepingApp.ui.dur.status === 'ready'); await page.waitForTimeout(300);
    const y1 = await page.evaluate(() => [...document.querySelectorAll('h1, .inp, .count, .lbl')].map((e) => Math.round(e.getBoundingClientRect().top)));
    const cls = await page.evaluate(() => ({ v: window.__cls, s: window.__shifts }));
    check('약 검색: 로딩이 끝나도 제목·검색창·고른 약 위치가 그대로', JSON.stringify(y0) === JSON.stringify(y1), JSON.stringify([y0, y1]));
    check('약 검색: 로딩이 끝나는 동안 누적 레이아웃 이동 0.01 이하', cls.v <= 0.01, JSON.stringify(cls));
    await ctx.close();

    // ── 글꼴이 느리게 와도(0.6초 지연) 첫 화면이 나온 뒤 글자 위치가 바뀌지 않는다
    console.log('\n글꼴이 느릴 때 (360×800, 글꼴 0.6초 지연)');
    const ctx2 = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const p2 = await ctx2.newPage();
    await p2.route('**/*Pretendard*', async (r) => { await new Promise((x) => setTimeout(x, 600)); r.continue(); });
    await p2.goto(base); await p2.waitForSelector('.splash'); await p2.click('.splash'); await p2.waitForSelector('.welcome');
    const hs = () => p2.evaluate(() => ['h1', '.sub', '.fine'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().height)).join(','));
    const early = await hs(); await p2.waitForTimeout(1800); const late = await hs();
    check('환영 화면: 첫 화면이 보이는 순간과 글꼴이 다 도착한 뒤의 문단 높이가 같음', early === late, early + ' → ' + late);
    if (fs.existsSync(path.join(root, 'assets/fonts/PretendardVariable.woff2'))) check('글꼴(Pretendard)이 첫 화면 전에 로드됨', await p2.evaluate(() => document.fonts.check("600 16px 'Pretendard Variable'")));
    else console.log('건너뜀: assets/fonts/PretendardVariable.woff2 가 없어 글꼴 로드를 점검하지 못했어요.');
    await ctx2.close();

    // ── 사파리(iPhone) 대비 점검 (실제 기기가 아니라 코드·계산값 기준)
    console.log('\n사파리 대비 (코드 기준, 393×852)');
    const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    check('100vh마다 100dvh 대체값이 있음(주소창이 접혀도 높이가 맞게)', (css.match(/100vh/g) || []).length > 0 && (css.match(/100dvh/g) || []).length >= (css.match(/100vh/g) || []).length);
    check('viewport-fit=cover + 하단 영역·탭에 env(safe-area-inset-bottom)', /viewport-fit=cover/.test(html) && /\.actionbar\{[^}]*safe-area-inset-bottom/.test(css) && /\.nav\{[^}]*safe-area-inset-bottom/.test(css));
    check('안전 영역: 화면은 위쪽, 토스트는 아래쪽(env(safe-area-inset-bottom))을 씀', /\.screen\{[^}]*safe-area-inset-top/.test(css) && /\.toast\{[^}]*safe-area-inset-bottom/.test(css));
    check('overflow:clip을 지원하지 않는 브라우저 대체 규칙이 있음(하단 영역 sticky 유지)', /@supports not \(overflow:clip\)/.test(css));
    const ctx3 = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const p3 = await ctx3.newPage();
    await p3.goto(base); await p3.waitForFunction(() => KeepingApp.ui.dur.status === 'ready' || KeepingApp.ui.dur.status === 'error');
    const inputs = [], fixedEls = [];
    const grab = async (name) => { await p3.waitForTimeout(120); const r = await p3.evaluate(() => ({ i: [...document.querySelectorAll('#app input, #app textarea, #app select')].filter((e) => !['file', 'checkbox', 'radio'].includes(e.type)).map((e) => ({ id: e.id || e.type, fs: parseFloat(getComputedStyle(e).fontSize) })), f: [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed').map((e) => e.className || e.tagName) })); r.i.forEach((x) => inputs.push({ name, ...x })); r.f.forEach((x) => fixedEls.push({ name, x })); };
    await p3.click('.splash'); await p3.click('[data-act="start"]'); await p3.click('[data-act="agree"]'); await p3.click('#agreenext'); await p3.waitForSelector('#q'); await grab('약 검색');
    await p3.evaluate(() => { KeepingApp.state().items.push({ id: 'lt1', kind: 'drug', source: 'manual', name: '레이아웃약', times: ['07:30'], batch: null }); KeepingApp.go('onb-drugs'); }); await p3.click('#nextbtn'); await p3.waitForSelector('.manual-chip'); await grab('영양제'); await p3.click('.manual-chip'); await grab('영양제 직접 입력');
    await p3.evaluate(() => { KeepingApp.state().items.push({ id: 'zz', kind: 'drug', source: 'manual', name: 'x', times: [''] }); KeepingApp.go('times', { all: true }); }); await grab('복용 시간');
    await p3.evaluate(() => KeepingApp.go('questions')); await grab('질문');
    check('입력 칸(' + inputs.length + '개)의 글자가 모두 16px 이상(사파리 자동 확대 방지)', inputs.length >= 6 && inputs.every((i) => i.fs >= 16), JSON.stringify(inputs.filter((i) => i.fs < 16)));
    check('화면 아래에 고정(fixed)된 요소가 없음(키보드에 가려지지 않음). 토스트만 위쪽 고정', fixedEls.every((f) => !/actionbar|nav/.test(String(f.x))));
    await p3.evaluate(() => KeepingApp.go('welcome')); await p3.evaluate(() => { KeepingApp.seedExample(); KeepingApp.go('home'); }); await p3.waitForSelector('.nav');
    const toastBottom = await p3.evaluate(() => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = 't'; document.body.appendChild(d); const r = d.getBoundingClientRect(); const nav = document.querySelector('.nav'); const out = { b: r.bottom, navTop: nav ? nav.getBoundingClientRect().top : innerHeight, vh: innerHeight }; d.remove(); return out; });
    check('토스트가 하단 탭 바로 위에 뜸(탭에 가리지 않음)', toastBottom.b <= toastBottom.navTop - 8 && toastBottom.b > toastBottom.navTop - 60, JSON.stringify(toastBottom));
    await ctx3.close();
  } finally { await browser.close(); server.close(); }
  console.log('\n통과 ' + ok + ' / 실패 ' + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('예외:', e); process.exit(2); });
