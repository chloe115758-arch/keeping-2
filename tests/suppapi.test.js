/* 실행: node tests/suppapi.test.js — js/api.js의 영양제 검색(성분 + 제품 목록 data/supp/products.json) 점검. 제품 목록이 없어도 동작해야 한다. */
'use strict';
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), assert = require('assert');
const dir = path.join(__dirname, '..');
let n = 0;
function t(name, fn) { return fn().then(() => { n++; console.log('  ok  ' + name); }, (e) => { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }); }
function load(withProducts) {
  const w = new JSDOM('<div id="app"></div>', { runScripts: 'outside-only', url: 'http://localhost/' }).window;
  w.fetch = (u) => Promise.resolve((u === 'data/supp/products.json' && !withProducts) || !fs.existsSync(path.join(dir, u))
    ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(path.join(dir, u), 'utf8')) });
  ['config.js', 'data/datapack.js', 'js/engine.js', 'js/suppsearch.js', 'js/api.js'].forEach((f) => w.eval(fs.readFileSync(path.join(dir, f), 'utf8')));
  return w;
}
(async () => {
  const on = load(true), off = load(false);
  await t('제품 목록이 있으면: 성분 결과가 앞, 제품 결과가 뒤. 제품에는 reportNo·company·ingredientKeys', async () => {
    const r = (await on.KeepingApi.searchSupplements('칼슘')).results;
    const first = r.findIndex((x) => x.source === 'catalog');
    assert.ok(r[0].source === 'local' && first > 0 && r.slice(0, first).every((x) => x.source === 'local') && r.slice(first).every((x) => x.source !== 'local'), JSON.stringify(r.map((x) => x.source)));
    const p = r[first].supp;
    assert.ok(p.reportNo && p.company && Array.isArray(p.ingredientKeys), JSON.stringify(p));
  });
  await t('제품을 고르면 성분 키가 supp.ingredientKeys에 이미 들어 있다(빈 배열이 아님)', async () => {
    const p = (await on.KeepingApi.searchSupplements('영양칼슘비타민')).results.find((x) => x.source === 'catalog').supp;
    assert.ok(p.ingredientKeys.includes('calcium') && p.ingredientKeys.includes('vitaminC'), JSON.stringify(p.ingredientKeys));
  });
  await t('제품 이름·업체로도 찾는다', async () => {
    const r = (await on.KeepingApi.searchSupplements('영양칼슘비타민')).results.filter((x) => x.source === 'catalog');
    assert.ok(r.length >= 1 && r[0].name.includes('영양칼슘비타민') && r[0].supp.company);
  });
  await t('빈 검색은 자주 찾는 성분 12개(제품 없음)', async () => {
    const r = (await on.KeepingApi.searchSupplements('')).results;
    assert.ok(r.length >= 6 && r.every((x) => x.source === 'local'));
  });
  await t('제품 목록 상태: ready + 출처 이름', async () => {
    const i = await on.KeepingApi.suppInfo();
    assert.ok(i.products === 'ready' && /식품안전나라/.test(i.source), JSON.stringify(i));
  });
  await t('제품 목록 파일이 없어도 동작: 성분 결과만, 상태 off', async () => {
    const r = (await off.KeepingApi.searchSupplements('칼슘')).results;
    assert.ok(r.length >= 1 && r.every((x) => x.source === 'local' || x.source === 'pack'), JSON.stringify(r.map((x) => x.source)));
    assert.strictEqual((await off.KeepingApi.suppInfo()).products, 'off');
  });
  console.log(n + '개 통과');
})();
