/*
 * 키핑 약봉투 인식 "시연" 모듈 — 실제 글자 인식(OCR)을 하지 않는다.
 *
 * 하는 일: 사용자가 올린 이미지가 연습용 샘플 약봉투(assets/ocr-demo/)이면 "인식한 것"으로 처리하고,
 *          그 봉투에 쓰여 있다고 정해 둔 약 이름(manifest.json)을 돌려준다.
 *          그 약 이름은 실제 약 검색(dur.search)으로 이어져 실제 제품 후보가 나온다.
 * 샘플 확인 방법: 파일 이름(keeping-sample-envelope-N)과 PNG 이미지 크기(폭×높이)가 목록과 같을 때.
 *          (파일 내용 해시는 쓰지 않는다. 내려받는 과정에서 파일에 메타데이터가 덧붙을 수 있다.)
 * 하지 않는 일: 다른 이미지에서 글자를 읽는 것, 카메라 촬영, 이미지 업로드(파일은 이 기기 밖으로 나가지 않는다).
 *
 * 화면은 항상 "연습용 샘플만 인식해요. 실제 사진 인식은 아직 지원하지 않아요"를 밝혀야 한다.
 *
 * 쓰는 법
 *   var ocr = KeepingOcrDemo.create(manifestJson);
 *   ocr.identify(file).then(function (r) { if (r.recognized) { var items = ocr.resolve(r.sample, dur); ... } });
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeepingOcrDemo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* PNG 머리 24바이트에서 폭·높이를 읽는다 (8바이트 서명 + IHDR) */
  function pngSize(buf) {
    var a = new Uint8Array(buf);
    var sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if (a.length < 24) return null;
    for (var i = 0; i < 8; i++) if (a[i] !== sig[i]) return null;
    var w = ((a[16] << 24) | (a[17] << 16) | (a[18] << 8) | a[19]) >>> 0;
    var h = ((a[20] << 24) | (a[21] << 16) | (a[22] << 8) | a[23]) >>> 0;
    return { width: w, height: h };
  }
  /* 파일 앞부분 32바이트만 읽는다(큰 이미지를 통째로 읽지 않는다) */
  function head(file) {
    if (file && typeof file.slice === 'function' && file.arrayBuffer === undefined && file.length !== undefined) {
      return Promise.resolve(file.slice(0, 32));                       // Uint8Array
    }
    if (file && typeof file.slice === 'function' && typeof file.arrayBuffer === 'function') {
      return file.slice(0, 32).arrayBuffer();                          // File/Blob
    }
    if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer().then(function (b) { return b.slice(0, 32); });
    return Promise.reject(new Error('이미지 파일이 아니에요'));
  }

  function create(manifest) {
    var samples = (manifest && manifest.samples) || [];
    var byId = {};
    samples.forEach(function (s) { byId[s.id] = s; });

    function samplesList() {
      return samples.map(function (s) { return { id: s.id, title: s.title, file: s.file, fileName: s.fileName, itemCount: s.items.length }; });
    }
    function notSample(reason) {
      return { recognized: false, reason: reason, samples: samplesList() };
    }

    /* 올린 파일이 연습용 샘플인지 확인한다. */
    function identify(file) {
      var name = (file && file.name) || '';
      return head(file).then(function (buf) {
        var size = pngSize(buf);
        if (!size) return notSample('not_png');
        var m = /keeping-sample-(envelope-\d+)/.exec(name);   // "keeping-sample-envelope-2 (1).png" 같은 중복 내려받기 이름도 허용
        var s = m && byId[m[1]];
        if (s && size.width === s.width && size.height === s.height) return { recognized: true, sample: s, how: 'name+size' };
        return notSample(s ? 'size_differs' : 'not_a_practice_sample');
      });
    }

    /* 봉투에 쓰인 약 이름 → 실제 약 검색. 사용자가 확인·수정하도록 후보를 함께 돌려준다. */
    function resolve(sample, dur) {
      return sample.items.map(function (it) {
        var cands = dur ? dur.search(it.query, { limit: 5 }) : [];
        return {
          ocrText: it.ocrText, box: it.box, dose: it.dose,
          candidates: cands, pick: cands[0] || null,
          status: cands.length === 0 ? 'none' : (cands.length === 1 ? 'found' : 'ambiguous')
        };
      });
    }

    return { identify: identify, resolve: resolve, samples: samplesList, note: '연습용 샘플만 인식해요. 실제 사진 인식은 아직 지원하지 않아요.' };
  }

  return { create: create, pngSize: pngSize };
});
