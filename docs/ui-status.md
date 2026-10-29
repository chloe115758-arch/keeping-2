# 화면 현황 (docs/plan-v2.md 기준) — 2026-10-30

코드를 읽어서 쓴 표예요(`index.html`, `js/app.js`, `js/storage.js`, `css/style.css`). 화면을 실제로 열어 보고 쓴 것은 아니에요.
**공통**: `index.html`은 `js/care.js`와 `js/ocrdemo.js`를 불러오지 않고, `js/app.js`는 `KeepingCare`·`KeepingOcrDemo`를 한 번도 쓰지 않아요. 지금 화면은 모두 v1 엔진(`js/engine.js`)의 결과를 읽어요.

| 화면 | 상태 | 파일·함수 | 메모 |
|---|---|---|---|
| O0 시작 (시작하기 / 예시 사용자로 체험하기) | 있음 | `VIEWS.splash`, `VIEWS.welcome`, `Acts.start`, `Acts.demo`, `loadExample` | 예시 사용자는 이트코나졸캡슐·비타민C·철분제 3개 |
| O1 저장 안내 + 동의 | 있음 | `VIEWS.consent`, `Acts.agree`, `Acts.agreeNext` | 기본정보(키·체중·나이) 수집 없음 |
| O2 약·영양제 등록 — 직접 검색 | 있음 | `VIEWS['onb-drugs']`, `VIEWS['onb-supps']`, `searchBlock`, `runSearch`, `Acts.pick`, `manualDrug`, `manualSupp` | 약은 `dur.search`, 영양제는 국내·해외·직접 입력 3탭 |
| O2 — 약봉투(시연) | **없음** | (`js/ocrdemo.js`, `data/ocr-demo/manifest.json`, `assets/ocr-demo/`는 있으나 화면이 없음) | 앱에서 불러오지 않음 |
| O3 복약 시간 — 약·영양제 시간 | 있음 | `VIEWS.times`, `timeRow`, `Acts.addTime`, `Acts.timesDone` | |
| O3 — 식사 시간(아침·점심·저녁) | **없음** | — | 저장 필드도 없음(`js/storage.js`의 `fresh()`에 meals 없음) |
| O4 상태(임신 중 / 만 65세 이상) | **없음** | — | 저장 필드도 없음 |
| O5 루틴 생성 요약 | **없음** | `Acts.timesDone`이 바로 홈으로 이동 | |
| 타임라인 홈 깊이 0 (시간대 행: "아침약 · 08:00 · 약 3개 · 주의 2") | **없음** | `VIEWS.home`은 오전/오후 복용 체크 카드(v1) | 시간대 묶음·주의 개수 행 없음 |
| 깊이 1 (약별 한 줄: 식사 관계 · 핵심 주의 · 음식) | **없음** | `VIEWS.home`의 `rcard`·`linesFor`는 v1 엔진의 간격 점검 줄만 | 식사 관계·"외 N건"·음식 한 줄 없음 |
| 깊이 2 근거 시트 | 일부 | `VIEWS.detail`, `pairFacts` | 병용금기·설명서 문장·출처·확인일은 있음. 등급 배지·"이상 증상이 있으면…" 없음, 시트가 아니라 전체 화면 |
| 확인(결과) 목록 | 있음(plan-v2에서는 깊이 2로 흡수 대상) | `VIEWS.result`, `rowHtml` | 하단 탭 "확인"으로 연결 |
| 하단 탭 | 일부 | `nav()` | 홈·확인·내 약·마이 4개 (plan-v2: 홈·내 약·마이 3개) |
| 시간 제안(타임라인에서 시간 옮기기) | **없음** | — | `care.js`가 `suggestions`를 주지만 화면이 안 읽음 |
| 새 처방 N1 잠금화면 알림(시연) | 있음 | `VIEWS.notify`, `Acts.demoRx`, `Acts.demoConfirm`, `addDemoBatch` | 문구는 v1("이번에 받은 약 4개를 확인해 볼까요") |
| N2 추가 방법(약봉투 / 직접 검색) | 일부 | `VIEWS.add`, `Acts.newRx` | 직접 검색만 있음 |
| N3 인식 결과 확인·수정 | **없음** | — | |
| N4 타임라인 반영·하이라이트 | **없음** | `Acts.confirmAdd`는 결과(확인) 화면으로 이동 | |
| N5 새로 생긴 주의 요약 | 일부 | `VIEWS.result` | v1 겹침 목록. "새로 생긴 주의" 요약 아님 |
| 약봉투 인식 시연(파일 올리기·하이라이트·후보 확인) | **없음** | — | 위 O2 참고 |
| 설정 | 일부 | `VIEWS.settings` | 병용금기 기준일·약 목록 적용일·이용 조건 있음. 설명서 데이터 확인일은 `Pack.checkedAt`(v1 데이터 팩 날짜)이고 care-pack의 `fetchedAt`이 아님 |
| 복약 체크, 질문 메모(부차) | 있음 | `Acts.check`, `VIEWS.questions` | |

## 확인하지 못한 것
- 실제 브라우저에서 각 화면을 열어 보지 않고 코드로만 판단했어요.
- `data/care/care-pack.json`이 현재 수집 중(상위 1,000개)이라 항목 수가 바뀔 수 있어요.
