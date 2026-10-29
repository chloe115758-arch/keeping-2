#!/usr/bin/env python3
"""
허가사항 수집: 성분 단위 대표 제품 1개의 허가정보 상세 응답을 받아 규칙을 추출한다.

사용: python3 scripts/fetch_labels.py --limit 20        (상위 20개 성분)
      python3 scripts/fetch_labels.py --limit 20 --dry-run   (호출 없이 성분·대표 제품만 보기)

흐름: products.json(구분 0·1) → 성분(cleanIngr)별 묶음 → 제품 수 많은 순
      → 대표 제품 → 목록 API로 품목기준코드(EDI_CODE 일치 확인) → 상세 API → care_extract.extract_rules
저장: data/care/raw/{ITEM_SEQ}.json (git 제외), data/care/by-ingredient/{성분}.json,
      data/care/progress.json(이어받기), data/care/summary.json

인증키: 환경변수 DATA_GO_KR_KEY(.env 포함)에서만 읽는다. 출력·파일에 키를 쓰지 않는다.
"""
import argparse, hashlib, json, os, re, sys, time, datetime
import urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from care_extract import extract_rules  # noqa: E402

BASE = 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService08/'
LIST_OP, DETAIL_OP = 'getDrugPrdtPrmsnInq08', 'getDrugPrdtPrmsnDtlInq08'
LIST_NAME_PARAM = 'item_name'          # 포털에서 확인됨
DETAIL_SEQ_PARAM = 'item_seq'          # 먼저 시도하는 이름. 응답이 비면 오류 메시지를 기록한다
DAILY_LIMIT = 10000
STOP_AT = 9800                          # 한도에 닿기 전에 멈춘다
SLEEP = 0.3
RETRIES = 3
TIMEOUT = 30

DATA = os.path.join(ROOT, 'data')
CARE = os.path.join(DATA, 'care')
RAW = os.path.join(CARE, 'raw')
BYING = os.path.join(CARE, 'by-ingredient')
PROGRESS = os.path.join(CARE, 'progress.json')
SUMMARY = os.path.join(CARE, 'summary.json')

_KEY = ''


def load_key():
    global _KEY
    k = os.environ.get('DATA_GO_KR_KEY', '')
    if not k:
        p = os.path.join(ROOT, '.env')
        if os.path.exists(p):
            for line in open(p, encoding='utf-8'):
                m = re.match(r'\s*DATA_GO_KR_KEY\s*=\s*(.*)\s*$', line)
                if m:
                    k = m.group(1).strip().strip('"\'')
    _KEY = urllib.parse.unquote(k)      # 인코딩된 키를 받아도 한 번만 인코딩되게
    return _KEY


def mask(s):
    s = str(s)
    if _KEY:
        for v in {_KEY, urllib.parse.quote(_KEY, safe=''), urllib.parse.quote(_KEY)}:
            s = s.replace(v, '***')
    return re.sub(r'(serviceKey=)[^&\s]+', r'\1***', s)


def log(*a):
    print(mask(' '.join(str(x) for x in a)), flush=True)


# ---- dur.js의 cleanIngr와 같은 규칙 ----
def clean_ingr(name):
    s = re.sub(r'\(\s*as\s[^)]*\)', '', str(name or ''), flags=re.I)
    s = re.sub(r'\s*\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|µg|μg|ug|ml|iu|u|%|meq|mmol|㎍|㎎|㎏|㎖)(?![a-z])', '', s, flags=re.I)
    s = re.sub(r'\s*/\s*(?:㎖|㎏|㎎|㎍|ml|mg|g|kg|l)(?![a-z])', '', s, flags=re.I)
    s = re.sub(r'\(\s*/\s*[a-zA-Z㎖]+\s*\)', '', s)
    s = re.sub(r'\(\s*\)', '', s)
    parts = [re.sub(r'\s+', ' ', x).strip() for x in re.split(r'[+,]', s)]
    return ' + '.join(x for x in parts if x)


def safe_name(name):
    s = re.sub(r'[^0-9A-Za-z가-힣._+-]', '_', name.strip())[:80]
    if s != name:
        s += '-' + hashlib.sha1(name.encode('utf-8')).hexdigest()[:6]
    return s


def group_ingredients():
    prod = json.load(open(os.path.join(DATA, 'dur', 'products.json'), encoding='utf-8'))['products']
    ing = json.load(open(os.path.join(DATA, 'dur', 'dur-pairs.json'), encoding='utf-8'))['ingredients']
    groups = {}
    for code, v in prod.items():
        if v[4] not in (0, 1):
            continue
        name = clean_ingr(ing.get(v[3]))
        if not name:
            continue
        groups.setdefault(name, []).append((code, v))
    return groups


def pick_representative(items):
    """전문의약품 우선 → 내복 우선 → 제품코드 오름차순 (products.json에 허가일이 없어서 허가일 기준은 쓸 수 없다)"""
    return sorted(items, key=lambda cv: (cv[1][4] != 0, cv[1][5] != '내복', cv[0]))[0]


# ---- API ----
class Quota(Exception):
    pass


class Api:
    def __init__(self):
        self.calls = 0
        self.today = datetime.date.today().isoformat()
        st = _read(PROGRESS, {})
        d = st.get('_calls', {})
        self.day_calls = d.get('count', 0) if d.get('date') == self.today else 0

    def get(self, op, **params):
        if self.day_calls >= STOP_AT:
            raise Quota('오늘 호출 %d건 — 하루 한도(%d) 전에 멈춰요' % (self.day_calls, DAILY_LIMIT))
        q = {'serviceKey': _KEY, 'pageNo': 1, 'numOfRows': 100, 'type': 'json'}
        q.update(params)
        url = BASE + op + '?' + urllib.parse.urlencode(q)
        last = ''
        for attempt in range(1, RETRIES + 1):
            self.calls += 1
            self.day_calls += 1
            time.sleep(SLEEP)
            try:
                with urllib.request.urlopen(url, timeout=TIMEOUT) as r:
                    text = r.read().decode('utf-8', 'replace')
                try:
                    return json.loads(text)
                except ValueError:
                    last = 'JSON이 아닌 응답: ' + re.sub(r'\s+', ' ', text)[:200]
                    return {'_nonjson': last}   # 키 오류 등은 XML로 온다 — 재시도해도 같다
            except urllib.error.HTTPError as e:
                last = 'HTTP %d' % e.code
                if e.code == 429:
                    time.sleep(10 * attempt)
                elif e.code < 500:
                    return {'_http': last}
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = '%s' % type(e).__name__
            time.sleep(2 * attempt)
        return {'_http': last + ' (재시도 %d회 후 실패)' % RETRIES}


def items_of(j):
    body = (j or {}).get('body') or {}
    it = body.get('items') or []
    if isinstance(it, dict):
        it = it.get('item', [])
    if isinstance(it, dict):
        it = [it]
    return [x.get('item', x) if isinstance(x, dict) else x for x in it]


def api_error(j):
    if not isinstance(j, dict):
        return '응답 형식 오류'
    for k in ('_nonjson', '_http'):
        if k in j:
            return j[k]
    h = j.get('header') or {}
    if h.get('resultCode') not in (None, '00'):
        return 'resultCode %s: %s' % (h.get('resultCode'), h.get('resultMsg'))
    return None


def find_seq(api, code, v):
    """목록 API에서 EDI_CODE가 제품코드와 같은 항목의 ITEM_SEQ. (itemSeq, 사유)"""
    names = [v[0]]
    base = re.sub(r'\([^)]*\)', '', v[0]).strip()
    if base and base != v[0]:
        names.append(base)
    tried = []
    for nm in names:
        j = api.get(LIST_OP, **{LIST_NAME_PARAM: nm})
        err = api_error(j)
        if err:
            return None, 'error:목록 호출 실패 — ' + err
        its = items_of(j)
        tried.append('%s→%d건' % (nm, len(its)))
        for it in its:
            edis = [e.zfill(9) for e in re.split(r'[,;\s]+', str(it.get('EDI_CODE') or '')) if e]
            if code in edis:
                return it.get('ITEM_SEQ'), None
    return None, '미해결: 목록(%s)에 EDI_CODE %s 없음' % (', '.join(tried), code)


def _read(p, default):
    try:
        return json.load(open(p, encoding='utf-8'))
    except (OSError, ValueError):
        return default


def _write(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=500)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--reextract', action='store_true', help='호출 없이 data/care/raw로 규칙만 다시 뽑는다')
    a = ap.parse_args()

    groups = group_ingredients()
    order = sorted(groups, key=lambda n: (-len(groups[n]), n))[:a.limit]
    if a.dry_run:
        for i, n in enumerate(order, 1):
            c, v = pick_representative(groups[n])
            print('%3d  %-40s 제품 %4d  대표 %s %s' % (i, n[:40], len(groups[n]), c, v[0]))
        return
    if a.reextract:
        return reextract(order)
    if not load_key():
        raise SystemExit('DATA_GO_KR_KEY가 없어요(.env 또는 환경변수).')

    os.makedirs(RAW, exist_ok=True)
    os.makedirs(BYING, exist_ok=True)
    prog = _read(PROGRESS, {})
    api = Api()
    err_streak = []
    try:
        for i, name in enumerate(order, 1):
            st = prog.get(name)
            if st and st['status'] in ('ok', 'unresolved'):
                continue
            code, v = pick_representative(groups[name])
            rec = {'status': 'error', 'reason': '', 'productCode': code, 'productName': v[0]}
            prog[name] = rec
            seq, why = find_seq(api, code, v)
            if not seq:
                rec['status'], rec['reason'] = ('unresolved', why) if why.startswith('미해결') else ('error', why[6:])
                log('[%d/%d] %s — %s' % (i, len(order), name, rec['reason']))
                _write(PROGRESS, dict(prog, _calls={'date': api.today, 'count': api.day_calls}))
                continue
            rec['itemSeq'] = seq
            rawp = os.path.join(RAW, '%s.json' % seq)
            j = _read(rawp, None)
            if j is None:
                j = api.get(DETAIL_OP, **{DETAIL_SEQ_PARAM: seq})
                err = api_error(j)
                its = [] if err else items_of(j)
                if err or not its or its[0].get('ITEM_SEQ') != seq:
                    rec['reason'] = '상세 호출 실패 — ' + (err or ('응답 항목 %d건 (totalCount %s), resultMsg %s' % (
                        len(its), ((j.get('body') or {}).get('totalCount')), (j.get('header') or {}).get('resultMsg'))))
                    log('[%d/%d] %s — %s' % (i, len(order), name, rec['reason']))
                    err_streak.append(rec['reason'])
                    _write(PROGRESS, dict(prog, _calls={'date': api.today, 'count': api.day_calls}))
                    if len(err_streak) >= 3 and len(set(err_streak[-3:])) == 1:
                        log('같은 오류가 3번 연속이라 멈춰요. 요청 변수 이름(%s)부터 확인해 주세요.' % DETAIL_SEQ_PARAM)
                        break
                    continue
                _write(rawp, j)
            err_streak = []
            it = items_of(j)[0]
            rules_rec = build_record(name, seq, it)
            rules = rules_rec['rules']
            _write(os.path.join(BYING, safe_name(name) + '.json'), rules_rec)
            rec['status'], rec['reason'] = 'ok', ''
            log('[%d/%d] %s — 규칙 %d개' % (i, len(order), name, len(rules)))
            _write(PROGRESS, dict(prog, _calls={'date': api.today, 'count': api.day_calls}))
    except Quota as e:
        log(str(e))
    _write(PROGRESS, dict(prog, _calls={'date': api.today, 'count': api.day_calls}))
    summarize(order, prog, api)


def reextract(order):
    prog = _read(PROGRESS, {})
    class _NoApi:
        calls = 0
        day_calls = prog.get('_calls', {}).get('count', 0)
        today = prog.get('_calls', {}).get('date', '')
    groups = group_ingredients()
    rep = {pick_representative(g)[0]: n for n, g in groups.items()}
    for name in [n for n in prog if not n.startswith('_') and n not in groups]:   # 성분 이름 정리 규칙이 바뀐 경우
        new = rep.get(prog[name].get('productCode'))
        if new and new not in prog:
            prog[new] = prog.pop(name)
            oldf = os.path.join(BYING, safe_name(name) + '.json')
            if os.path.exists(oldf):
                os.remove(oldf)
            log('성분 이름 변경: %s → %s' % (name, new))
    for name, rec in prog.items():
        if name.startswith('_') or rec.get('status') != 'ok':
            continue
        it = items_of(_read(os.path.join(RAW, '%s.json' % rec['itemSeq']), {}))[0]
        _write(os.path.join(BYING, safe_name(name) + '.json'), build_record(name, rec['itemSeq'], it))
    _write(PROGRESS, prog)
    summarize([n for n in prog if not n.startswith('_')], prog, _NoApi)


def build_record(name, seq, it):
    rules = extract_rules(it.get('NB_DOC_DATA'), it.get('UD_DOC_DATA'), it.get('ITEM_SEQ', seq))
    return {
        'ingredient': name, 'productSeq': seq, 'itemName': it.get('ITEM_NAME'),
        'atc': it.get('ATC_CODE'), 'etcOtc': it.get('ETC_OTC_CODE'), 'changeDate': it.get('CHANGE_DATE'),
        'docUrls': {'ee': it.get('EE_DOC_ID'), 'ud': it.get('UD_DOC_ID'), 'nb': it.get('NB_DOC_ID')},
        'rules': rules, 'fetchedAt': datetime.datetime.now().isoformat(timespec='seconds')}


def summarize(order, prog, api):
    done = [n for n in order if n in prog]
    cnt = {'ok': 0, 'unresolved': 0, 'error': 0}
    withrules, keys = 0, {}
    for n in done:
        cnt[prog[n]['status']] += 1
        if prog[n]['status'] == 'ok':
            f = _read(os.path.join(BYING, safe_name(n) + '.json'), {})
            rs = f.get('rules', [])
            if rs:
                withrules += 1
            for r in rs:
                for m in r.get('matched', []):
                    keys[m['key']] = keys.get(m['key'], 0) + 1
    s = {'processed': len(done), 'ok': cnt['ok'], 'unresolved': cnt['unresolved'], 'error': cnt['error'],
         'withRules': withrules, 'matchedKeyCounts': dict(sorted(keys.items(), key=lambda x: -x[1])),
         'apiCallsThisRun': api.calls, 'apiCallsToday': api.day_calls,
         'generatedAt': datetime.datetime.now().isoformat(timespec='seconds')}
    _write(SUMMARY, s)
    log(json.dumps(s, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
