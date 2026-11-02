/* 실행: node tests/placeholder.test.js — 화면에 "(예: 〇〇)"라고 적어 둔 예시가 실제 데이터에서 검색되는지 확인한다.
   (시안의 예시 "메타포르민정"은 오타라 한 건도 안 나왔다. 예시는 반드시 찾아지는 말이어야 한다.) */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const D = require('../js/dur.js'), Supp = require('../js/suppsearch.js'), N = require('../js/drugname.js');
const dur = D.create({ pairs: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/dur-pairs.json'), 'utf8')), products: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/products.json'), 'utf8')) });
const w = {}; new Function('window', fs.readFileSync(path.join(root, 'data/datapack.js'), 'utf8'))(w);
const extra = JSON.parse(fs.readFileSync(path.join(root, 'data/care/supplement-keys-extra.json'), 'utf8')).keys;
let products = []; try { products = JSON.parse(fs.readFileSync(path.join(root, 'data/supp/products.json'), 'utf8')).rows; } catch (e) { /* 제품 목록이 없을 수 있다 */ }
const S = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra, popular: w.KEEPING_DATA.chipKeys, products });

const files = ['index.html']
  .concat(fs.readdirSync(path.join(root, 'js')).filter((f) => /\.js$/.test(f)).map((f) => 'js/' + f))
  .concat(fs.existsSync(path.join(root, 'data/copy')) ? fs.readdirSync(path.join(root, 'data/copy')).filter((f) => /\.json$/.test(f)).map((f) => 'data/copy/' + f) : [])
  .filter((f) => fs.existsSync(path.join(root, f)));
const found = [];
files.forEach((f) => {
  const txt = fs.readFileSync(path.join(root, f), 'utf8'); let m; const re = /검색[^"'`\n]{0,30}?\(예:\s*([^)\n"'`]+?)\s*\)/g;   // "…검색 (예: 〇〇)" 꼴만. 시각 예시(예: 07:30) 같은 것은 검색이 아니다
  while ((m = re.exec(txt))) if (/[가-힣]/.test(m[1])) found.push({ file: f, ex: m[1] });   // 영문 상표 예시(해외 제품)는 이 데이터로 확인할 수 없어 건너뛴다
});
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

if (!found.length) { console.log('  (화면에 "(예: …)" 예시가 없어요)'); }
found.forEach(({ file, ex }) => t('예시 "' + ex + '" (' + file + ')가 실제로 검색된다', () => {
  const drug = N.group(dur.search(ex, { limit: 40 }), { query: ex }), supp = S.searchAll(ex);
  assert.ok(drug.length > 0 || supp.length > 0, '"' + ex + '"로 약도 영양제도 한 건도 안 나와요. 데이터에 있는 말로 바꿔 주세요(예: 메타포르민 → 메트포르민)');
  console.log('        → ' + (drug.length ? '약 ' + drug.slice(0, 3).map((x) => x.name).join(', ') : '영양제 ' + supp.slice(0, 3).map((x) => x.name).join(', ')));
}));
t('추천 예시 "메트포르민"은 약 이름과 성분명 모두로 검색된다', () => {
  assert.ok(N.group(dur.search('메트포르민', { limit: 40 }), { query: '메트포르민' }).length >= 3);
});
t('원래 예시 "메타포르민정"은 오타라 안 나온다(이 시험이 그것을 막는다)', () => {
  assert.strictEqual(dur.search('메타포르민정', { limit: 5 }).length, 0);
});
console.log('\n' + n + '개 통과');
