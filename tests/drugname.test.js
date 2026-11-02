/* 실행: node tests/drugname.test.js — js/drugname.js(약 이름 줄이기·묶기) 점검, 실제 약 데이터로 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const N = require('../js/drugname.js'), D = require('../js/dur.js');
const dur = D.create({ pairs: JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dur/dur-pairs.json'), 'utf8')), products: JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dur/products.json'), 'utf8')) });
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } }

t('함량과 괄호를 뗀다', () => {
  const c = [
    ['씬지로이드정0.1밀리그램(레보티록신나트륨수화물)', '씬지로이드정'], ['씬지록신정50마이크로그램(레보티록신나트륨수화물)', '씬지록신정'],
    ['글리메디정(글리메피리드)', '글리메디정'], ['글리메엠정1/250밀리그램', '글리메엠정'], ['리피젯정10/20밀리그램', '리피젯정'],
    ['아모렉스정625mg', '아모렉스정'], ['아모르탄정5/80mg', '아모르탄정'], ['넥시움정20밀리그람(에스오메프라졸마그네슘)', '넥시움정'],
    ['어린이타이레놀현탁액(아세트아미노펜(미분화))', '어린이타이레놀현탁액'], ['시바스정(심바스타틴)', '시바스정'], ['메토폴정(메트포르민염산염)', '메토폴정']];
  c.forEach(([a, b]) => assert.strictEqual(N.baseName(a), b, a));
});
t('이름의 일부인 숫자는 지우지 않는다(타이레놀8시간이알서방정)', () => {
  assert.strictEqual(N.baseName('타이레놀8시간이알서방정(아세트아미노펜)'), '타이레놀8시간이알서방정');
  assert.strictEqual(N.baseName('타이레놀콜드-에스정'), '타이레놀콜드-에스정');
});
t('이름이 통째로 지워지면 그대로 둔다·빈 값은 빈 글자', () => {
  assert.strictEqual(N.baseName('5mg'), '5mg'); assert.strictEqual(N.baseName(''), ''); assert.strictEqual(N.baseName(null), '');
});
t('실제 검색: "씬지"는 함량별 12건이 두 줄(씬지로이드정, 씬지록신정)로 묶인다', () => {
  const raw = dur.search('씬지', { limit: 30 }), g = N.group(raw, { query: '씬지' });
  assert.ok(raw.length >= 8, '원래는 ' + raw.length + '건');
  assert.deepStrictEqual(g.map((x) => x.name).sort(), ['씬지로이드정', '씬지록신정']);
  assert.ok(g.every((x) => x.variants >= 2 && x.rep.code), '대표 제품과 개수가 있다');
});
t('실제 검색: "넥시움"은 넥시움정·넥시움주·에넥시움정 3줄, 검색어로 시작하는 이름이 먼저', () => {
  const g = N.group(dur.search('넥시움', { limit: 30 }), { query: '넥시움' });
  assert.deepStrictEqual(g.map((x) => x.name), ['넥시움정', '넥시움주', '에넥시움정']);
});
t('실제 검색: "글리메"는 줄 이름이 서로 다르고 시안처럼 짧다(괄호·함량 없음)', () => {
  const g = N.group(dur.search('글리메', { limit: 30 }), { query: '글리메', limit: 8 });
  assert.ok(g.length >= 4 && g.length <= 8, g.length + '줄');
  assert.strictEqual(new Set(g.map((x) => x.name)).size, g.length, '이름이 겹치지 않는다');
  assert.ok(g.every((x) => !/[()\d]/.test(x.name)), g.map((x) => x.name).join(', '));
  assert.ok(g.every((x) => x.name.length <= 8), '짧다');
});
t('줄 수 제한(limit)과 빈 결과', () => {
  assert.strictEqual(N.group(dur.search('아모', { limit: 40 }), { query: '아모', limit: 5 }).length, 5);
  assert.deepStrictEqual(N.group([], { query: 'x' }), []); assert.deepStrictEqual(N.group(null), []);
});
t('묶음의 대표로 항목을 만들어도 같은 성분이라 같은 안내가 나온다(씬지로이드 어느 함량이든 레보티록신)', () => {
  const g = N.group(dur.search('씬지로이드', { limit: 30 }), { query: '씬지로이드' }), p = dur.get(g[0].rep.code);
  assert.strictEqual(String(p.ingrName).toLowerCase(), 'levothyroxine sodium');
});
console.log('\n' + n + '개 통과');
