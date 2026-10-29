/*
 * 저장소 모듈
 * 화면 코드는 이 모듈의 함수만 부릅니다. (localStorage를 직접 읽지 않음)
 * 2차 프로젝트에서 계정 + 서버 저장으로 바꿀 때는 이 파일의 내부만 교체하면 됩니다.
 *
 * 1차: 건강정보는 사용자의 기기 안(localStorage)에만 저장합니다. 서버로 보내지 않습니다.
 */
(function (root) {
  'use strict';

  var KEY = 'keeping.v1';
  var SCHEMA = 1;
  var memory = null; // localStorage를 쓸 수 없을 때를 위한 임시 보관

  function uid() {
    return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function fresh() {
    return {
      v: SCHEMA,
      createdAt: new Date().toISOString(),
      example: false,
      items: [],        // { id, kind:'drug'|'supp', source, itemSeq?, name, ingredientKeys?, times:[], batch, addedAt, updatedAt }
      foods: [],        // { id, name }
      questions: [],    // { id, text, about }
      lastBatch: null
    };
  }

  function migrate(s) {
    if (!s || typeof s !== 'object') return fresh();
    var f = fresh();
    s.v = s.v || SCHEMA;
    ['items', 'foods', 'questions'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = f[k]; });
    if (!('lastBatch' in s)) s.lastBatch = null;
    if (!('example' in s)) s.example = false;
    return s;
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return memory || fresh();
      return migrate(JSON.parse(raw));
    } catch (e) {
      return memory || fresh();
    }
  }

  function save(state) {
    memory = state;
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  function reset() {
    memory = null;
    try { root.localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
    return fresh();
  }

  function exportJSON(state) {
    return JSON.stringify({ app: 'keeping', schema: SCHEMA, exportedAt: new Date().toISOString(), data: state }, null, 2);
  }

  function importJSON(text) {
    var o = JSON.parse(text);
    if (!o || o.app !== 'keeping' || !o.data) throw new Error('키핑에서 내보낸 파일이 아니에요.');
    return migrate(o.data);
  }

  root.KeepingStore = { uid: uid, fresh: fresh, load: load, save: save, reset: reset, exportJSON: exportJSON, importJSON: importJSON };
})(typeof window !== 'undefined' ? window : this);
