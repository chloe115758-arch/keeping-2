/* 실행: node tests/ocrdemo.test.js — 약봉투 인식 시연(js/ocrdemo.js) 점검 */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const Ocr = require('../js/ocrdemo.js');
const D = require('../js/dur.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/ocr-demo/manifest.json'), 'utf8'));
const dur = D.create({
  pairs: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/dur-pairs.json'), 'utf8')),
  products: JSON.parse(fs.readFileSync(path.join(root, 'data/dur/products.json'), 'utf8'))
});
const ocr = Ocr.create(manifest);
const bytes = (f) => new Uint8Array(fs.readFileSync(path.join(root, f)));
// 브라우저의 File처럼: name, slice, arrayBuffer
const mkFile = (name, u8) => ({
  name, size: u8.length,
  slice: (a, b) => { const part = u8.slice(a, b); return { arrayBuffer: async () => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) }; },
  arrayBuffer: async () => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
});

let n = 0; const pending = [];
function t(name, fn) { pending.push(Promise.resolve().then(fn).then(() => { n++; console.log('  ok  ' + name); }).catch((e) => { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; })); }

t('샘플 3개, 이미지 파일이 실제로 있고 PNG 크기가 manifest와 같다', () => {
  assert.strictEqual(manifest.samples.length, 3);
  manifest.samples.forEach((s) => {
    const sz = Ocr.pngSize(bytes(s.file));
    assert.ok(sz && sz.width === s.width && sz.height === s.height, s.id + ' ' + JSON.stringify(sz));
  });
});
t('샘플 이미지를 올리면 인식한다', async () => {
  for (const s of manifest.samples) {
    const r = await ocr.identify(mkFile(s.fileName, bytes(s.file)));
    assert.ok(r.recognized && r.sample.id === s.id && r.how === 'name+size', s.id);
  }
});
t('내려받는 중에 파일 끝에 메타데이터가 덧붙어도(내용이 달라도) 인식한다', async () => {
  const s = manifest.samples[1]; const b = bytes(s.file);
  const padded = new Uint8Array(b.length + 5770); padded.set(b, 0); padded.fill(7, b.length);
  assert.ok((await ocr.identify(mkFile(s.fileName, padded))).recognized);
});
t('"keeping-sample-envelope-2 (1).png"처럼 중복 내려받기 이름도 인식한다', async () => {
  const s = manifest.samples[1];
  assert.ok((await ocr.identify(mkFile('keeping-sample-envelope-2 (1).png', bytes(s.file)))).recognized);
});
t('이름이 다르면 인식하지 않고 샘플 목록을 안내한다', async () => {
  const s = manifest.samples[0];
  const r = await ocr.identify(mkFile('약봉투.png', bytes(s.file)));
  assert.strictEqual(r.recognized, false); assert.strictEqual(r.reason, 'not_a_practice_sample'); assert.strictEqual(r.samples.length, 3);
});
t('이름이 같아도 크기가 다른 PNG(줄여서 다시 저장한 것)는 인식하지 않는다', async () => {
  const b = bytes(manifest.samples[0].file); const small = new Uint8Array(b); small[19] = 0x7f;   // 폭 값을 바꿔 크기가 다른 PNG처럼 만든다
  const r = await ocr.identify(mkFile(manifest.samples[0].fileName, small));
  assert.strictEqual(r.recognized, false); assert.strictEqual(r.reason, 'size_differs');
});
t('PNG가 아닌 파일은 이름이 같아도 인식하지 않는다', async () => {
  const r = await ocr.identify(mkFile(manifest.samples[0].fileName, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25])));
  assert.strictEqual(r.recognized, false); assert.strictEqual(r.reason, 'not_png');
});
t('봉투에 쓰인 약 이름이 실제 제품 검색으로 이어진다', () => {
  const want = { 'envelope-1': ['씬지로이드정0.075'], 'envelope-2': ['넥시움정20', '알마겔에프'], 'envelope-3': ['시바스정', '메토폴정', '무코스타정'] };
  for (const s of manifest.samples) {
    const items = ocr.resolve(s, dur);
    assert.strictEqual(items.length, want[s.id].length);
    items.forEach((it, i) => {
      assert.ok(it.pick && it.pick.name.includes(want[s.id][i]), s.id + ' ' + it.ocrText + ' → ' + (it.pick && it.pick.name));
      assert.ok(it.status === 'found' || it.status === 'ambiguous');
    });
  }
});
t('인식 위치(box)가 0~1 비율 범위 안에 있다', () => {
  manifest.samples.forEach((s) => s.items.forEach((it) => {
    it.box.forEach((v) => assert.ok(v >= 0 && v <= 1));
    assert.ok(it.box[0] + it.box[2] <= 1 && it.box[1] + it.box[3] <= 1);
  }));
});
t('가상 정보만 쓰고, 실제 OCR이 아니라고 밝힌다', () => {
  assert.ok(/가상/.test(manifest._meta.fictional));
  assert.ok(manifest._meta.purpose.includes('실제 글자 인식(OCR)은 하지 않는다'));
});
Promise.all(pending).then(() => console.log('\n' + n + '개 통과'));
