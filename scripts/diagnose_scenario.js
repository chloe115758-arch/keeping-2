#!/usr/bin/env node
/*
 * "시나리오대로 약을 넣었는데 주의가 안 떠요"를 엔진 쪽에서 확인하는 진단 도구. 앱 화면과 같은 데이터(허가사항 묶음, 병용금기, 영양제 목록)로
 * 씬지로이드정 07:00 + 칼슘 영양제 09:00 조합을 돌려서 어디까지 되는지 단계별로 보여 준다. 인증키나 개인 정보는 출력하지 않는다.
 *
 *   node scripts/diagnose_scenario.js                         (프로젝트 맨 위 폴더에서)
 *   node scripts/diagnose_scenario.js --drug 씬지로이드 --supp 칼슘
 *   node scripts/diagnose_scenario.js --pack data/care/care-pack.json
 * 출력이 모두 ✅면 엔진은 정상이고, 문제는 화면이 항목을 만드는 쪽(js/app.js)이다. ❌가 있으면 그 줄이 원인이다.
 */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const J = (p) => JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(root, p), 'utf8'));
const ok = (b, msg) => console.log((b ? '✅ ' : '❌ ') + msg);

const Care = require('../js/care.js'), D = require('../js/dur.js'), Supp = require('../js/suppsearch.js');
const dur = D.create({ pairs: J('data/dur/dur-pairs.json'), products: J('data/dur/products.json') });
const groups = J('data/care/groups.json');
let pack; try { pack = J(arg('pack', 'data/care/care-pack.json')); } catch (e) { console.log('❌ 허가사항 묶음 파일을 못 읽었어요: ' + e.message.split('\n')[0]); process.exit(1); }
const care = Care.create({ pack, dur, groups });
const w = {}; new Function('window', fs.readFileSync(path.join(root, 'data/datapack.js'), 'utf8'))(w);
const extra = J('data/care/supplement-keys-extra.json').keys;
let products = []; try { products = J('data/supp/products.json').rows; } catch (e) { /* 제품 목록이 없을 수 있다 */ }
const S = Supp.create({ keyList: w.KEEPING_DATA.supplementKeyList, extra, popular: w.KEEPING_DATA.chipKeys, products });

console.log('— 1. 약 찾기 —');
const dq = arg('drug', '씬지로이드'), hits = dur.search(dq, { limit: 3 });
ok(hits.length > 0, '약 검색 "' + dq + '" → ' + hits.length + '건');
if (!hits.length) process.exit(1);
const p = dur.get(hits[0].code);
console.log('   제품: ' + p.name + ' | 구분: ' + p.category + ' | 성분(영문): ' + p.ingrName + ' | 경로: ' + (p.route || '-'));

console.log('— 2. 허가사항 묶음에 이 약이 있나 —');
const key = String(p.ingrName || '').toLowerCase(), entry = pack.entries[key];
ok(!!entry, '묶음 키 "' + key + '" ' + (entry ? '있음 (규칙 ' + (entry.rules || []).length + '개)' : '없음 → 이 약은 "확인 범위 밖"으로 나와요'));
if (entry) {
  const cal = (entry.rules || []).filter((r) => (r.matched || []).some((m) => m.key === 'calcium'));
  ok(cal.length > 0, '칼슘 관련 규칙 ' + cal.length + '개' + (cal[0] && cal[0].interval ? ' (간격 ' + (cal[0].interval.text || cal[0].interval.minHours + '시간') + ')' : ''));
  if (entry.route && p.route && entry.route !== p.route) ok(false, '경로 불일치: 묶음 ' + entry.route + ' / 제품 ' + p.route + ' → 안내를 쓰지 않아요');
}

console.log('— 3. 영양제 검색 —');
const sq = arg('supp', '칼슘'), sres = S.searchAll(sq);
ok(sres.length > 0, '영양제 검색 "' + sq + '" → ' + sres.length + '건 (성분 ' + sres.filter((x) => x.source === 'local').length + ' + 제품 ' + sres.filter((x) => x.source === 'catalog').length + ')');
sres.slice(0, 4).forEach((x) => console.log('   [' + x.source + '] ' + x.name + ' → 성분 키: ' + JSON.stringify(x.supp.ingredientKeys)));
ok(products.length > 0, '제품 목록 ' + products.length + '건' + (products.length ? '' : ' (data/supp/products.json 없음)'));
const noKey = sres.filter((x) => x.source === 'catalog' && !x.supp.ingredientKeys.length);
if (noKey.length) ok(false, '제품 ' + noKey.length + '개는 성분 키가 비어서 주의를 못 만들어요: ' + noKey.slice(0, 2).map((x) => x.name).join(', '));

console.log('— 4. 시나리오 S1: ' + p.name.split('(')[0] + ' 07:00 + ' + sq + ' 09:00 —');
function run(label, supp) {
  const items = [D && dur.toItem(hits[0].code, { id: 'a', times: ['07:00'] }), { id: 'c', kind: 'supp', name: supp.name, ingredientKeys: supp.ingredientKeys, times: ['09:00'] }];
  const A = care.analyze(items, {});
  const flags = A.slots.flatMap((s) => s.items.flatMap((i) => i.flags.filter((f) => f.kind !== 'food')));
  ok(flags.length > 0, label + ': 주의 ' + flags.length + '건' + (flags[0] ? ' → ' + (flags[0].interval ? '간격 ' + flags[0].interval.minHours + '시간, ' : '') + flags[0].kind + ' ' + flags[0].short : ''));
  if (A.uncovered.length) console.log('   (확인 범위 밖: ' + JSON.stringify(A.uncovered) + ')');
  return flags.length > 0;
}
const ing = sres.find((x) => x.source === 'local');
if (ing) run('성분 항목(' + ing.name + ')', ing.supp); else console.log('   (성분 결과가 없어요)');
const prod = sres.find((x) => x.source === 'catalog' && x.supp.ingredientKeys.includes('calcium'));
if (prod) run('제품 항목(' + prod.name + ')', prod.supp); else console.log('   (칼슘이 들어 있다고 읽힌 제품이 없어요)');
console.log('\n끝. 이 출력 전체를 복사해서 알려 주세요.');
