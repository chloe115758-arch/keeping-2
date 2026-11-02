#!/usr/bin/env python3
"""
식품안전나라 건강기능식품 품목제조신고(원재료) 전체 목록을 받아 앱이 서버 없이 검색할 파일로 만든다.
  → data/supp/products.json : { meta, rows: [[신고번호, 제품명, 업체명, 원재료(앞 60자)], ...] }

준비: .env에 FOODSAFETY_KEY=<식품안전나라 인증키>  (공공데이터포털 키와 다른 키예요. openapi.foodsafetykorea.go.kr 에서 신청)
실행: python3 scripts/fetch_supplements.py            # 전체
      python3 scripts/fetch_supplements.py --max 3000  # 앞 3,000건만(시험용)
출력에는 인증키를 절대 찍지 않는다(주소에 키가 들어 있어서 오류 메시지도 상태 코드만 보여 준다).
※ 이 스크립트의 요청 주소·항목 이름은 식품안전나라 안내 화면 기준이고, 실제 호출은 선생님 컴퓨터에서 처음 돌려 보는 것이다.
   첫 실행에서 "응답 구조가 달라요"가 나오면 그 한 줄을 알려 주세요.
"""
import argparse, datetime, gzip, json, os, sys, time, urllib.request

PAGE = 1000
BASE = 'http://openapi.foodsafetykorea.go.kr/api'


def read_env(path='.env'):
    env = {}
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=40) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:                  # 주소(키 포함)를 찍지 않는다
            last = 'HTTP %s' % e.code
        except Exception as e:
            last = type(e).__name__
        time.sleep(1.5 * (i + 1))
    raise RuntimeError('요청 실패(%s)' % last)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--max', type=int, default=0, help='가져올 최대 건수(0이면 전체)')
    ap.add_argument('--out', default='data/supp/products.json')
    ap.add_argument('--base', default=BASE, help='시험용: 다른 주소')
    a = ap.parse_args()

    key = os.environ.get('FOODSAFETY_KEY') or read_env().get('FOODSAFETY_KEY', '')
    if not key:
        sys.exit('FOODSAFETY_KEY가 .env에 없어요. 식품안전나라 인증키를 .env에 넣어 주세요(값은 화면에 찍지 않아요).')

    rows, seen, start, total = [], set(), 1, None
    while True:
        end = start + PAGE - 1
        j = fetch('%s/%s/C003/json/%d/%d' % (a.base, key, start, end))
        node = j.get('C003')
        if node is None:
            code = (j.get('RESULT') or {}).get('CODE')
            sys.exit('응답 구조가 달라요(C003 없음, 코드 %s). 이 줄을 알려 주세요.' % code)
        res = node.get('RESULT') or {}
        code = res.get('CODE', '')
        if code.startswith('INFO-200'):                       # 해당 데이터 없음 = 끝
            break
        if code and code != 'INFO-000':
            sys.exit('식품안전나라 응답: %s %s' % (code, res.get('MSG', '')))
        page = node.get('row') or []
        if total is None:
            total = int(node.get('total_count') or 0)
        for x in page:
            no = (x.get('PRDLST_REPORT_NO') or '').strip()
            if not no or no in seen:
                continue
            seen.add(no)
            rows.append([no, (x.get('PRDLST_NM') or '').strip(), (x.get('BSSH_NM') or '').strip(), (x.get('RAWMTRL_NM') or '').strip()[:60]])
        print('  %d건 받음 (전체 %s건 중)' % (len(rows), total))
        if not page or (total and start + PAGE > total) or (a.max and len(rows) >= a.max):
            break
        start += PAGE
        time.sleep(0.3)

    if a.max:
        rows = rows[:a.max]
    if not rows:
        sys.exit('받은 건수가 0이에요. 인증키나 서비스 이름(C003)을 확인해 주세요.')
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    data = {'meta': {'source': '식품안전나라 건강기능식품 품목제조신고(원재료) C003', 'fetchedAt': datetime.date.today().isoformat(), 'count': len(rows),
                     'fields': ['reportNo', 'name', 'company', 'ingredientRaw']}, 'rows': rows}
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    open(a.out, 'w', encoding='utf-8').write(raw)
    gz = len(gzip.compress(raw.encode('utf-8')))
    print('저장: %s  %d건  %.1f MB (압축하면 약 %.1f MB)' % (a.out, len(rows), len(raw.encode('utf-8')) / 1e6, gz / 1e6))


if __name__ == '__main__':
    main()
