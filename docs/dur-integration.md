# DUR 모듈 연동 지시서 (Claude Code용)

> 목적: 앱의 **약 검색을 제품 23,126개로 넓히고**, 등록한 약끼리 **병용금기 23,619쌍**으로 확인한다.
> 이미 끝난 것: 데이터 변환, `js/dur.js`, 엔진 연결(패치), 테스트. **남은 일은 화면(`js/app.js`, `js/api.js`, 시연 데이터) 연결이다.**
> 먼저 읽을 것: `CLAUDE.md`(서비스 원칙), `docs/figma-handoff.md`(화면 작업 지시). 이 문서는 화면 작업과 **같이** 진행한다.

---

## 1. 이미 있는 것

| 파일 | 내용 | 손대나 |
|---|---|---|
| `data/dur/dur-pairs.json` | 병용금기 성분 쌍 23,619개 + 금기사유 370개 + 비고 + 고시일 | 아니오 |
| `data/dur/products.json` | 제품 23,126개 (급여목록 21,498 + 병용금기 파일에만 있는 1,628) | 아니오 |
| `scripts/build_packs.py` | 위 두 JSON을 다시 만드는 스크립트 (원본 CSV·엑셀 필요) | 아니오 |
| `js/dur.js` | 검색·병용금기 확인 모듈 (`window.KeepingDur`) | 아니오 (버그가 있으면 사용자에게 알리고 고친다) |
| `js/engine.js` | `pack.dur`가 있으면 DUR로 확인하도록 이미 수정됨 (`docs/engine-dur.patch`) | 아니오 |
| `tests/dur-pack.test.js`, `tests/dur.test.js`, `tests/engine-dur.test.js` | 데이터·모듈·엔진 연결 점검 | 화면을 바꿔도 통과해야 함 |

`js/engine.js`가 아직 패치 전이라면: `git apply --check docs/engine-dur.patch && git apply docs/engine-dur.patch`

---

## 2. `KeepingDur` 사용법

```js
KeepingDur.load('data/dur/').then(function (dur) {   // 약 4MB, gzip 약 0.6MB. 첫 로딩에만 걸린다
  Pack.dur = dur;                                    // 엔진은 pack.dur를 보고 DUR 경로를 쓴다
});
```

| 함수 | 돌려주는 것 |
|---|---|
| `dur.search(q, {limit: 20})` | 제품 목록. 각 항목: `code, name, spec, company, ingr, ingrName, kind('listed'\|'outside'), category('전문의약품'\|'일반의약품'\|null), display` |
| `dur.get(code)` | 제품 하나 (없으면 `null`) |
| `dur.toItem(code, {id, times, ...})` | **앱에 저장할 항목.** `{kind:'drug', source:'dur', productCode, name, display, company, category, ingrCode, ingredientEn, ingredientKo, ...}` |
| `dur.evidence(codeA, codeB)` | 두 제품의 병용금기 근거 `[{reason, note, date, ingrA, ingrB}]` (없으면 `[]`) |
| `dur.checkAgainst(code, [otherCodes])` | 근거가 있는 상대만 `[{withCode, items}]` |
| `dur.hasPairs(code)` | 이 제품의 성분이 병용금기 목록에 한 번이라도 나오는가 |
| `dur.statusOf(code)` | `'listed'`(급여목록) / `'outside'`(병용금기 파일에만 있음) / `'unknown'` |
| `dur.source('pair')` | `{label, url, checkedAt}` — **화면에 출처로 표시할 것** |
| `dur.license()` | 이용 조건 문구 (설정 화면에 표시) |
| `dur.stats()` | `{products, pairs, ingredientsWithPair, baseDate}` |

엔진은 `E.analyze(items, pack)`를 그대로 쓴다. 항목이 `productCode`를 가지면 DUR로, `itemSeq`만 가지면 기존 데이터 팩으로 확인하고, 두 방식을 섞어도 된다. 데이터 팩의 약 5개는 보험코드와 연결돼 있어서 제품코드로 등록해도 **설명서 근거가 붙는다**(이텍스시메티딘, 알마겔에프).

---

## 3. 해야 할 일 (화면 쪽)

| # | 할 일 | 위치(함수 이름으로 찾을 것) | 완료 기준 |
|---|---|---|---|
| 1 | **시작할 때 `KeepingDur.load`**, 끝나면 `Pack.dur = dur`. 로딩 중에는 검색창 아래에 "약 목록을 불러오는 중…". **실패하면 기존 데이터 팩 모드로 계속 동작**하고 "전체 약 검색을 쓸 수 없어요" 안내만 한다 | `app.js` 부팅부, `index.html`에 `<script src="js/dur.js">`를 `engine.js` 앞에 | 오프라인·파일 누락에서도 앱이 죽지 않음 |
| 2 | **약 검색을 `dur.search`로.** 입력 전에는 아무것도 보여주지 않는 지금 방식 유지. 결과 행: `display`, `업체 · 전문/일반`, 급여목록 밖이면 "목록 밖" 칩. 최대 20개, 더 있으면 "더 좁혀 입력해 주세요" | `api.js`의 `searchDrugs`, `app.js`의 `runSearch`·`resultsHtml` | "시바스" → 시바스정이 맨 위. 한글 성분명(심바스타틴)·영문(simvastatin)으로도 찾아짐 |
| 3 | **선택하면 `dur.toItem`으로 항목을 만들어 저장** (`productCode` 포함). 기존 데이터 팩 항목(`itemSeq`)은 그대로 읽혀야 한다 (이미 저장된 사용자 데이터) | `Acts.pick` | 저장 후 새로고침해도 유지, 예전 저장 데이터도 열림 |
| 4 | **상세 화면의 "확인한 것" 줄을 `a.coverage`로** 그린다. 지금은 데이터 팩 레코드(`r`)가 있어야만 그려서, DUR로 등록한 약은 이 줄이 비거나 오류가 난다. `coverage.dur`(병용금기 확인함), `coverage.label`(설명서 확인함/못 함), `coverage.product`(구분·성분)로 표시 | 상세 화면의 `metaRow` 부분 | DUR로 등록한 약에서 오류 없이 "병용금기: 확인함 / 설명서: 확인하지 못했어요" |
| 5 | **병용금기 근거 카드**: `f.summary`(사유·고시일·조건)를 그대로 보여주고, 출처는 `f.source.label`·`url`·`checkedAt`. 의학 문구는 요약하지 않는다. **`f.note`(비고: "48시간 이내 병용금기" 같은 조건)는 반드시 보인다** | 근거 카드 | 시바스정 ↔ 코니트라정에서 사유·고시일·출처 링크가 보임 |
| 6 | **시연 데이터 교체**: 예시 사용자의 코니트라캡슐(수출용)을 `코니트라정 100mg`(`dur.search('코니트라정')[0].code`, 제품코드 670303210)로, 시연 처방 4개를 제품코드 방식으로. 제품코드는 코드에 직접 적지 말고 `dur.search`로 찾는다 | `loadExample`, `addDemoBatch` | 시연 흐름에서 시바스정·이텍스시메티딘·알마겔에프·후로스판정이 나오고 결과가 이전과 같음 |
| 7 | **설정 화면의 "근거를 확인하는 약 N개(데모 범위)"를 `dur.stats().products`로** 바꾸고, 데이터 출처·기준일(`baseDate`)·이용 조건(`dur.license()`)을 표시 | 설정 뷰 | 출처가 화면에서 보임 (상업적 이용금지 조건 때문에 **필수**) |
| 8 | **직접 이름 입력 등록은 유지.** 목록에 없는 약은 `status: unchecked` ("확인 못 함") | `manualDrug` | 목록에 없는 이름도 등록되고 "확인 못 함" |

---

## 4. 문구 규칙 (CLAUDE.md의 원칙 그대로)

| 상태 | 화면 문구 |
|---|---|
| `attention` (pair) | "○○와 병용금기로 등록돼 있어요" + 사유·고시일·조건·출처 |
| `none` (DUR 제품) | **"병용금기 목록에서 겹치는 쌍을 찾지 못했어요. 안전하다는 뜻은 아니에요."** — 설명서까지 확인한 건 아니므로 "설명서는 확인하지 못했어요"를 함께 |
| `unchecked` | "확인 범위 밖이에요. 등록은 됐고, 약사에게 확인해 주세요." |

- 금지: "안전", "괜찮", "문제없", "먹어도 돼요" 등 판정 문구.
- `none`은 **병용금기 목록 기준만**의 결과다. 설명서·영양제·음식은 확인하지 않았다는 것을 화면에서 숨기지 않는다.
- 급여목록 제품 21,498개 중 35%(7,452개)만 병용금기 성분에 해당한다. 나머지가 "겹침 없음"인 것은 **목록에 없다는 뜻이지 안전하다는 뜻이 아니다.**

---

## 5. 알려진 한계 (화면·README에서 사실처럼 쓰지 말 것)

- 병용금기 파일은 **병용금기 목록만** 담는다. 연령금기·임부금기·용량주의·효능군중복·설명서의 상호작용 문구는 이 데이터로 확인하지 않는다.
- 급여목록에는 **일반의약품 중 급여 대상(1,324개)만** 있다. 약국에서 사는 일반의약품 대부분과 비급여 전문의약품은 검색되지 않는다.
- 성분 기준으로 쌍을 적용하면 112개 제품은 원본 병용금기 파일의 제품 목록에 나오지 않는다(이유 미확인).
- 복합제는 복합제 성분코드가 목록에 있을 때만 쌍을 찾는다. 복합제의 개별 성분 단위로는 확인하지 않는다.
- `toItem`의 `ingredientKo`는 제품명 괄호 안의 단일 성분명일 때만 채운다(복합제는 `null`). 설명서 문구와의 이름 일치는 이 값으로 하므로, 제품에 따라 설명서 근거가 안 붙을 수 있다.
- 데이터 기준일: 병용금기 2026-07-31, 약제급여목록 2026-11-01 적용분.
- 병용금기 파일의 이용 조건: 공공저작물 · 출처표시 · **상업적 이용금지**. 앱과 README에 출처를 표시한다.

---

## 6. 완료 기준

1. `node tests/engine.test.js`, `tests/dur-pack.test.js`, `tests/dur.test.js`, `tests/engine-dur.test.js`, `tests/smoke.test.js` 모두 통과 (화면 구조가 바뀌면 smoke 테스트는 의도를 유지한 채 고친다).
2. 브라우저에서 "시바스" 검색 → 선택 → "코니트라정" 검색 → 선택 → 결과 목록에 **확인 필요 2건**, 상세에 사유·고시일·출처.
3. `dur-pairs.json`·`products.json`을 일부러 가려서(파일 이름을 바꿔서) 열어도 **앱이 열리고** 데이터 팩 모드로 동작.
4. 검색은 입력할 때 끊기지 않는다(평균 6ms 수준이어야 하고, 200자 입력·특수문자에도 오류 없음).
5. 사용자에게 **시안과 다르게 한 곳, 확인하지 못한 곳**을 목록으로 보고한다.

## 7. 하지 말 것

- `dur.js`·`engine.js`·`data/dur/*.json`을 수정하지 않는다. 필요하면 이유를 적고 사용자에게 먼저 묻는다.
- 제품코드·성분코드를 화면 코드에 하드코딩하지 않는다.
- 이 데이터에 없는 약 정보(복용량, 처방일수, 효능 등)를 만들어 채우지 않는다.
- 원본 CSV·엑셀(약 160MB, 2.3MB)을 저장소에 올리지 않는다(`.gitignore` 확인).
