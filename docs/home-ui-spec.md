# 홈 화면 구현 설명서 (클로드코드용)

목표 모양은 **`docs/design-ref/home-morning-open.jpg`** (402px 폭)예요. 이 이미지가 기준이고, 숫자는 이미지에서 재서 맞춰요.
**계산은 이미 끝나 있어요.** 화면은 `KeepingHome.build()`의 결과를 그리기만 해요. 묶음, 문장, 진행률, 노드 상태를 화면 코드에서 다시 계산하지 마세요.

## 0. 건드리지 않는 파일
`js/care.js`, `js/dur.js`, `js/josa.js`, `js/greeting.js`, `js/homevm.js`, `data/copy/greeting.json`, `docs/ux-writing.md`
문구를 바꾸고 싶으면 `docs/ux-writing.md`의 `내 문구` 칸을 고치고 `python3 scripts/apply_copy.py`를 실행해요. 화면에 문장을 직접 쓰지 마세요.

## 1. 데이터 흐름
```js
// index.html에서 순서대로 불러오기: dur.js → care.js → josa.js → greeting.js → homevm.js
var copy = await (await fetch('data/copy/greeting.json')).json();
var vm = KeepingHome.create({
  greeting: KeepingGreeting.create(copy),
  productOf: function (item) { var c = item.productCode || (item.itemSeq && dur.codeOf(item.itemSeq)); return c ? dur.get(c) : null; }
});
var analysis = care.analyze(items, { meals: MEALS, states: STATES });
var model = vm.build({ nowMin: <지금 분>, nickname: <별명 또는 ''>, items: items, analysis: analysis, checks: <오늘 체크>, meals: MEALS });
```
`items`는 기존 형태 그대로(`id, kind:'drug'|'supp', name, display, times[], productCode, ingredientKeys`)이고, **처방약에만 `dept`(진료과, 선택)**가 더 붙어요.

`model` 구조
- `model.header` → `line1`, `line2`, `card.{title, icon('sun'|'moon'), count('3/7'), ratio, status}`, `aria`
- `model.rows[]` (시간순) → 두 종류예요.
  - `type:'meal'` → `label`, `time`, `lineDone`
  - `type:'slot'` → `id, label, time, nodeState('done'|'now'|'up'), defaultOpen, lineDone, last, summary.text("약 3개 · 주의 1"), groups[], notice`
- `slot.groups[]` → `id`(체크 키), `title`, `kind('rx'|'otc'|'other'|'supp')`, `icon('pill'|'leaf')`, `checked`, `hint`(없으면 null), `isNew`·`newLabel`("새 처방")
- `slot.notice` → `title`, `lines[]`(최대 2건: `flagId, text, official`), `more`, `moreText`, `all[]`. 없으면 null
- `model.sheets[flagId]` → 근거 시트(바텀시트) 내용
- `model.detail[group.id]` → 약봉투 화면 내용

## 2. 체크 저장
- 키: `kp:checks:YYYY-MM-DD` (오늘 날짜), 값은 `{ "morning:rx:내과": true, ... }` (**체크한 것만 true, 해제하면 키 삭제**). `localStorage`는 try/catch로 감싸요.
- 날짜가 바뀌면 새 키가 되므로 자정에 자연히 새로 시작해요.
- **건너뜀 상태는 없어요.** 체크했거나 아니거나예요.
- 앱을 열어 둔 동안 1분마다, 그리고 `visibilitychange`로 앱에 돌아올 때 `nowMin`을 다시 넣어 다시 그려요.

## 3. 화면 (시안 기준, 위에서 아래)
1. **상단바**: 왼쪽 "Keeping" 로고(`assets/brand/keeping-logo.svg`가 있으면 인라인 SVG, `fill: currentColor`. 없으면 700 20px 자간 -0.02em 글씨), 오른쪽 벨·프로필 아이콘(선, 22px, 누르는 영역 44px, 동작은 아직 없어도 돼요).
2. **인사 카드 하나**(흰색, 모서리 20px): 맨 위 `line1`(18px 700), 그 아래 `line2`(12px, 보조색), 같은 카드 안에 **"오늘의 복약"** 제목 + 시간대 아이콘(`card.icon`), 오른쪽에 큰 숫자 `card.count`(26px 700), **진행 바**(높이 6px, 채움 폭 = `card.ratio`, 0.3초 ease-out, `prefers-reduced-motion`이면 즉시, `role="progressbar"` + `aria-valuenow` + `aria-label=model.header.aria`), 바 아래 한 줄 `card.status`.
3. **시간선**: 왼쪽에서 [시간 라벨 | 세로선과 노드 | 카드] 3칸.
   - 슬롯 줄: 시간 라벨은 굵게, 식사 줄은 작은 회색 + 빈 점.
   - 노드: `done`은 채운 원 + 체크, `now`는 포인트색 고리, `up`은 작은 회색 점(모양으로 구분해요).
   - 세로선: `lineDone`인 줄만 포인트색(`--kp-rail-done`), 나머지는 `--kp-rail`. `last` 줄은 선이 노드 중심에서 끝나요.
4. **시간대 카드**(흰색, 모서리 20px): 머리 = [시간대 아이콘 칸 | 제목 + `summary.text`(주의 숫자만 빨강) | 펼침 화살표]. `defaultOpen`인 카드만 처음에 펼쳐요. 머리를 누르면 접고 펼쳐요.
5. **펼친 카드 안**: 묶음 줄들 → 맨 아래 주의 블록.
   - **묶음 줄**: [아이콘 칸 40px(`icon`) | `title` (+ `hint`가 있으면 아래에 작은 빨간 글씨) | 체크박스 44px 터치(보이는 상자 26px, 모서리 8px, 체크하면 포인트색 채움 + 체크)]. 체크하면 아이콘·제목이 흐려져요(투명도 .5, 취소선 없음).
   - **새 처방 칩**: `build()`에 `newItemIds`(이번에 새로 등록한 약 id들)를 넘기면 `isNew`인 묶음 제목 옆에 작은 칩(`newLabel`, 연한 포인트색 배경)을 보여요. 안 넘기면 아무것도 안 나와요. 새 처방 알림 시연 → 등록 → 홈에서 "새 처방"이 보이는 흐름에 써요.
   - **줄을 누르면(체크박스 제외)** 약봉투 화면으로 가요(§5). 체크박스는 체크만 해요. 두 영역이 겹치지 않게 하세요.
   - **주의 블록**: 연한 빨강 배경(`--kp-caution-bg`), 모서리 14px, 왼쪽 경고 아이콘, 제목 `notice.title`(굵게) 아래 `lines[].text`(여러 줄 가능), 오른쪽 `>`. 줄(또는 블록)을 누르면 근거 시트(§4)가 열려요. `more > 0`이면 마지막에 `moreText`를 붙이고 누르면 `all` 전체를 펼쳐요. **블록 안에 배지는 넣지 않아요**(배지는 시트에).
6. **맨 아래**: 검정 둥근 버튼 "새 약 추가하기"(높이 56px). 화면 하단에 고정하지 않고 내용 끝에 두어요.

## 4. 근거 시트 (바텀시트)
`model.sheets[flagId]`를 그려요. 뒤는 `rgba(0,0,0,.45)` 막, 시트는 위쪽 모서리 `--kp-radius-sheet`, 맨 위 손잡이(40×4), 제목 줄 "근거" + 오른쪽 ✕(44px), 맨 아래 검정 "닫기". 막·✕·닫기 모두 닫아요. 내용 순서:
1. 배지(`grade === 'official'`이면 "공식 지정", 아니면 "설명서 근거")
2. `headline`(19px 700). 공식 지정이고 `noteLine`이 있으면 바로 아래 작은 글씨 한 줄(예: "조건 · 48시간 이내 병용금기"). 병용금기는 조건이 붙은 경우가 있어서 이 줄을 빼면 안 돼요.
3. `intro`(작은 글씨, "설명서에 이렇게 나와 있어요") 바로 아래 **원문 인용 블록**(`excerpt` 그대로, 위에 `where`, 왼쪽 포인트색 선)
4. `relatedTitle` 아래 `related[]`: 줄마다 `label`(굵게) + `names`
5. `hintLine`이 있으면 한 줄(읽기 전용, 버튼 아님)
6. 출처 `source.label`, `source.url`("원문 보기" 링크, 새 탭), `확인일 {source.checkedAt}`
7. "이상 증상이 있으면 약사·의사에게 물어보세요."

## 5. 약봉투 화면 (전체 화면)
`model.detail[group.id]`를 그려요. 상단 뒤로 가기 + `title`. 아래로:
- 약마다 카드: `display`(큰 글씨), 둘째 줄 `spec` · `company`, 작은 칩 `category`("처방약" 등), `times`(먹는 시간), `ingredient`(작은 회색 글씨).
- 카드 안 `notices[]`: 누르면 §4 시트가 열려요. 없으면 그 칸을 만들지 않아요.
- `foods`가 있으면 `foodsTitle` 아래 칩으로. (**홈에는 음식 줄을 두지 않아요**)
- 맨 아래 작은 회색 글씨로 `scope`, `footer`.
- **복용법·용량 칸을 만들지 않아요.**

## 6. 지우는 것
- 홈의 **"시간을 정하지 않은 약" 카드**와 "시간 정하기" (시간 없는 약은 홈에 안 나와요. "내 약" 탭에서는 그대로 보여요).
- 홈 맨 아래 **안내 문단**("병용금기(공식 지정)와 설명서에서 찾은 안내만 …"). 이 내용은 약봉투 화면 맨 아래(`scope`)로 이사했어요.
- 이전의 돌아보기 칩, "확인할 주의" 줄, 건너뛰기, "새 주의 요약" 박스가 남아 있으면 모두 지워요.

## 7. 약 등록: 진료과 한 줄 (선택 입력)
**전문의약품(처방약)을 등록하는 단계에서만** "어느 과에서 처방받았어요?" 칩 한 줄을 넣어요: [내과] [피부과] [이비인후과] [정형외과] [소아과] [직접 입력] [건너뛰기]. 선택하면 `item.dept`에 저장하고, 건너뛰면 `dept` 없이 두어요(묶음 이름은 그냥 "처방약"). "내 약" 탭에서 고칠 수 있게 해 주세요. 일반의약품·영양제에는 묻지 않아요.

## 8. 디자인 값
`css/design-tokens.css`의 `--kp-*` 변수를 써요(`<link>`가 `css/style.css` 다음). 글꼴은 `--kp-font`(Pretendard Variable, 파일은 `assets/fonts/`). 하드코딩된 색·크기·간격·모서리가 홈, 시트, 약봉투에 남아 있으면 가능한 한 변수로 바꾸고, 매핑이 애매한 것은 `docs/open-items.md`에 적어요.

## 9. 시안 이미지의 알려진 오류
시안의 칼슘 영양제 아래 "**오후 11시** 이후 섭취 권장"은 오타예요. 아침약 07:00에서 4시간 뒤는 **오전 11시**예요. `hint`는 계산한 값("오전 11시 이후 섭취 권장")을 그대로 쓰고, 이미지의 글자를 따라 쓰지 마세요.

## 10. 끝났을 때
- `node tests/*.test.js`가 전부 통과해야 해요(특히 `homevm`, `greeting`, `josa`, `care`, `dur`, `engine*`). 화면 쪽 시험에 아래를 추가해요: ① 체크박스를 누르면 `card.count`와 바 폭이 바뀐다 ② 홈에 "시간을 정하지 않은 약", "돌아보기", "확인할 주의", "건너뛰"가 없다 ③ 주의 블록의 문장에 "드세요"가 없다.
- 402×874와 360×800에서 스크린샷(아침 시작 전 펼침, 점심에 아침을 놓친 상태, 체크 후, 근거 시트, 약봉투 화면) 다섯 장과, 시안과 달라진 곳이 있으면 이유를 보고해요.
- 커밋은 바꾼 파일만 경로를 지정해서 하고, **push는 하지 않아요.**
