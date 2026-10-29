#!/usr/bin/env python3
"""
허가사항 문서 → 근거 문장 추출 (규칙 기반, 해석하지 않는다)

입력: 식약처 허가정보 API 상세 응답(getDrugPrdtPrmsnDtlInq08)의 문서 필드
      NB_DOC_DATA(사용상의 주의사항), UD_DOC_DATA(용법용량)
      형식: <DOC><SECTION><ARTICLE title="6. 상호작용"><PARAGRAPH>…<![CDATA[문장]]></PARAGRAPH>…
출력: 규칙 목록. 각 규칙은 원문 문장(excerpt), 위치(article·항 번호), 걸린 키워드, 간격 숫자를 담는다.

원칙
 - 문장을 만들거나 바꾸지 않는다. 원문 문장을 그대로 골라낸다(길면 …로 줄인다).
 - 키워드는 아래 표의 패턴과만 매칭한다. 이름이 비슷하다고 추측하지 않는다.
   (예: '칼슘채널차단제'는 칼슘제제가 아니다, '스테아르산마그네슘'은 마그네슘 영양제가 아니다)
 - 복용 중단·용량 변경 지시를 만들지 않는다. 문장에 그런 말이 있어도 원문 그대로 보여줄 뿐이다.
 - 추출은 틀릴 수 있다. 앱은 항상 원문 문장과 "설명서 원문 보기" 링크를 함께 보여준다.
"""
import hashlib, json, re, sys

# ---- 키워드 표: key는 앱의 영양제 키(datapack supplementKeyList)와 같은 이름을 쓴다 ----
SUPP_KEYS = {
    # 맨 이름만 나온 문장("비타민 B12 또는 칼슘의 섭취·흡수가 부족한 환자…")은 영양제와의 상호작용이 아니다.
    # 그래서 칼슘·철·마그네슘·아연은 제제·보충제·함유 같은 복용 형태가 함께 적힌 경우만 잡는다.
    'calcium':     ('칼슘제제',      [r'칼슘\s*제제', r'탄산칼슘', r'칼슘\s*보충제', r'칼슘\s*함유']),
    'iron':        ('철분제제',      [r'철분\s*제', r'철\s*제제', r'철분\s*보충', r'철\(Fe\)염', r'황산제일철', r'푸마르산제일철']),
    'magnesium':   ('마그네슘제제',  [r'마그네슘\s*(?:제제|함유|보충제)', r'산화마그네슘', r'수산화마그네슘']),
    'zinc':        ('아연제제',      [r'아연\s*(?:제제|보충제|함유)']),
    'vitaminK':    ('비타민 K',      [r'비타민\s*K(?!\s*의존)']),   # '비타민K의존성 응고인자'는 영양제가 아니다
    'vitaminD':    ('비타민 D',      [r'비타민\s*D']),
    'vitaminC':    ('비타민 C',      [r'비타민\s*C']),
    'omega3':      ('오메가-3',      [r'오메가\s*-?\s*3', r'EPA', r'DHA']),
    'biotin':      ('비오틴',        [r'비오틴']),
    'stJohnsWort': ('세인트존스워트', [r'세인트\s*존스\s*워트', r'St\.?\s*John']),
    'ginseng':     ('인삼',          [r'인삼']),
    'ginkgo':      ('은행잎',        [r'은행잎', r'징코']),
}
FOOD_KEYS = {
    'grapefruit': ('자몽',            [r'자몽']),
    'alcohol':    ('알코올·음주',     [r'알코올', r'알콜', r'음주']),   # 낱글자 '술'은 '수술'에도 걸려서 쓰지 않는다
    'caffeine':   ('카페인·커피',     [r'카페인', r'커피']),
    'dairy':      ('우유·유제품',     [r'우유', r'유제품']),
}
DRUG_GROUPS = {
    'ppi':            ('프로톤 펌프 억제제', [r'프로톤\s*펌프', r'\bPPI\b']),
    'aluminumAntacid': ('알루미늄 함유 제산제', [r'알루미늄\s*함유\s*제산제', r'수산화알루미늄']),
    'antacid':        ('제산제',            [r'(?<!알루미늄 함유 )(?<!알루미늄함유)제산제']),   # '알루미늄 함유 제산제'는 위 키로만 잡는다
    'cholestyramine': ('콜레스티라민',      [r'콜레스티라민']),
}
ALL_KEYS = {**{k: ('supplement',) + v for k, v in SUPP_KEYS.items()},
            **{k: ('food',) + v for k, v in FOOD_KEYS.items()},
            **{k: ('drug_group',) + v for k, v in DRUG_GROUPS.items()}}

NOTE_KEYS = {'biotin', 'alcohol', 'grapefruit', 'caffeine', 'vitaminK', 'stJohnsWort', 'ginseng', 'ginkgo'}   # 일반적 주의·경고에서는 이 키만 규칙으로 만든다

INTERVAL_RE = re.compile(r'(최소|적어도|약)?\s*(\d+(?:\.\d+)?)\s*(?:~|-|–)?\s*(\d+(?:\.\d+)?)?\s*시간\s*(이상|이내)?\s*(?:의\s*)?간격')
MEAL_RE = re.compile(r'(식사\s*(?:하기)?\s*(?:적어도\s*)?(?:\d+\s*(?:시간|분)\s*)?(?:전|후|중|직전|직후)|식전|식후|식간|공복|취침\s*전|식사와\s*함께|식사\s*중)')
TONE_AVOID = re.compile(r'투여하지\s*말|투여하지\s*마|금기|복용하지\s*말')
ITEM_NO = re.compile(r'^\s*(?:\(\d+\)|\d+\)|[①-⑳])\s*')

def _clean(text):
    t = re.sub(r'<[^>]+>', '', text)          # <sub> 같은 태그
    t = t.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return re.sub(r'\s+', ' ', t).strip()

def parse_doc(xml):
    """문서 문자열 → [(article 제목, [문장 단락, ...]), ...]. 정규식으로 읽는다(&nbsp; 같은 엔티티가 있어 XML 파서를 쓰지 않는다)."""
    if not xml:
        return []
    out = []
    for m in re.finditer(r'<ARTICLE\s+title="([^"]*)"\s*>(.*?)</ARTICLE>', xml, re.S):
        title = _clean(m.group(1))
        paras = [_clean(c) for c in re.findall(r'<!\[CDATA\[(.*?)\]\]>', m.group(2), re.S)]
        out.append((title, [p for p in paras if p]))
    if not out:   # ARTICLE 없이 SECTION/PARAGRAPH만 있는 문서
        paras = [_clean(c) for c in re.findall(r'<!\[CDATA\[(.*?)\]\]>', xml, re.S)]
        out.append(('', [p for p in paras if p]))
    return out

COMPARE_RE = re.compile(r'^\s*(?:와|과|이?나|및|,|\s)*(?:와|과)?\s*마찬가지')   # "…제산제와 마찬가지로": 같은 부류와 비교하는 말이지 병용 안내가 아니다

def _keys_in(text):
    hits = []
    for key, spec in ALL_KEYS.items():
        kind, ko, pats = spec
        for pat in pats:
            for m in re.finditer(pat, text):
                if COMPARE_RE.match(text[m.end():m.end() + 14]):
                    continue
                hits.append({'key': key, 'kind': kind, 'ko': ko, 'surface': m.group(0)})
                break
            if hits and hits[-1]['key'] == key:
                break
    return hits

def _interval(text):
    m = INTERVAL_RE.search(text)
    if not m:
        return None
    lo = float(m.group(2)); hi = float(m.group(3)) if m.group(3) else None
    return {'minHours': lo, 'maxHours': hi, 'qualifier': m.group(1) or '', 'text': _clean(m.group(0))}

def _is_heading(p):
    """소제목 한 줄: 짧고 문장으로 끝나지 않는다(예: '임부에 대한 투여', '시타글립틴')."""
    return len(p) < 25 and not re.search(r'(다|요)\.?\s*$', p)

def _short(text, n=220):
    return text if len(text) <= n else text[:n].rstrip() + '…'

def _rid(*parts):
    return hashlib.sha1('|'.join(parts).encode('utf-8')).hexdigest()[:10]

def _section(title):
    t = title.replace(' ', '')
    if '상호작용' in t: return 'interaction'
    if '일반적주의' in t or '일반적인주의' in t: return 'general'
    if '임부' in t or '수유' in t: return 'pregnancy'
    if '고령자' in t: return 'elderly'
    if '경고' in t: return 'warning'
    return None

def extract_rules(nb_xml, ud_xml=None, item_seq=''):
    rules = []
    for title, paras in parse_doc(nb_xml):
        sec = _section(title)
        if not sec:
            continue
        subject = ''
        for p in paras:
            if _is_heading(p):
                subject = p            # 복합제는 성분별 소제목이 있다. 뒤따르는 문장의 subject로 남긴다
                continue
            no_m = ITEM_NO.match(p)
            no = no_m.group(0).strip() if no_m else ''
            body = ITEM_NO.sub('', p)
            where = (title + (' ' + no if no else '')).strip()
            if sec in ('interaction', 'general', 'warning'):
                hits = _keys_in(body)
                if sec != 'interaction':
                    hits = [h for h in hits if h['key'] in NOTE_KEYS]
                if not hits:
                    continue
                rules.append({
                    'id': _rid(item_seq, where, body[:40]), 'kind': 'interaction' if sec == 'interaction' else 'note',
                    'section': sec, 'where': where, 'subject': subject, 'matched': hits, 'interval': _interval(body),
                    'tone': 'avoid' if TONE_AVOID.search(body) else 'caution', 'excerpt': _short(body), 'extractor': 'kw-v2'})
            elif sec in ('pregnancy', 'elderly'):
                rules.append({
                    'id': _rid(item_seq, where, body[:40]), 'kind': 'state_' + sec, 'section': sec, 'where': where,
                    'subject': subject, 'matched': [], 'interval': None,
                    'tone': 'avoid' if TONE_AVOID.search(body) else 'info', 'excerpt': _short(body), 'extractor': 'kw-v2'})
    for title, paras in parse_doc(ud_xml or ''):
        for p in paras:
            if MEAL_RE.search(p):
                rules.append({
                    'id': _rid(item_seq, 'UD', p[:40]), 'kind': 'timing', 'section': 'usage', 'where': '용법·용량',
                    'matched': [], 'interval': None, 'tone': 'info', 'excerpt': _short(_clean(p)),
                    'meal': MEAL_RE.search(p).group(0), 'extractor': 'kw-v2'})
    return rules

def main(argv):
    """사용: care_extract.py <상세 응답 json 파일>  → 규칙 JSON을 표준 출력으로"""
    if len(argv) < 2:
        raise SystemExit(__doc__)
    j = json.load(open(argv[1], encoding='utf-8'))
    items = (j.get('body') or {}).get('items') or []
    it = items[0] if items and 'ITEM_SEQ' in items[0] else (items[0].get('item') if items else {})
    rules = extract_rules(it.get('NB_DOC_DATA'), it.get('UD_DOC_DATA'), it.get('ITEM_SEQ', ''))
    print(json.dumps({'itemSeq': it.get('ITEM_SEQ'), 'itemName': it.get('ITEM_NAME'), 'atc': it.get('ATC_CODE'),
                      'changeDate': it.get('CHANGE_DATE'), 'rules': rules}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main(sys.argv)
