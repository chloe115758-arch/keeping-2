#!/usr/bin/env python3
"""
병용금기 CSV + 약제급여목록 엑셀 → 앱용 JSON 두 개

입력 1: 한국의약품안전관리원_병용금기약물_YYYYMMDD.csv   (공공데이터포털, cp949)
입력 2: 약제급여목록 및 급여상한금액표 .xlsx            (제품코드·주성분코드가 있는 전체 급여 의약품 목록)
출력  : data/dur/dur-pairs.json   성분코드(주성분코드) 쌍 + 금기사유 + 비고 + 고시일
        data/dur/products.json    제품 전체 목록(제품코드 → 이름·업체·주성분코드·전문/일반)

사용법:  python3 scripts/build_packs.py <병용금기.csv> <약제급여목록.xlsx> [출력폴더=data/dur]
필요:    pip install openpyxl

이용 조건
 - 병용금기 CSV: 공공저작물 · 출처표시 · 상업적 이용금지(제2유형). 비상업적 연구·교육에만 사용,
   상업적 사용은 한국의약품안전관리원의 사전 승인 필요.
 - 약제급여목록 엑셀: 제공기관과 이용 조건은 파일을 받은 페이지에서 확인해 meta에 기록하세요.
"""
import csv, datetime, gzip, json, os, re, sys

PAIR_COLS = ['성분명A', '성분코드A', '제품코드A', '제품명A', '업소명A', '구분A',
             '성분명B', '성분코드B', '제품코드B', '제품명B', '업소명B', '구분B',
             '고시번호', '고시적용일', '금기사유', '비고']
YAK_COLS = ['투여', '주성분코드', '주성분명', '제품코드', '제품명', '업체명', '전일']

def open_csv(path):
    for enc in ('utf-8-sig', 'cp949'):
        try:
            f = open(path, encoding=enc, newline=''); f.read(4096); f.seek(0)
            return f, enc
        except UnicodeDecodeError:
            pass
    raise SystemExit('CSV 인코딩을 읽지 못했어요')

def split_name(s):
    # "시바스정(심바스타틴)_(20mg/1정)" → ("시바스정(심바스타틴)", "20mg/1정")
    m = re.match(r'^(.*?)_\((.*)\)$', str(s).strip())
    return (m.group(1), m.group(2)) if m else (str(s).strip(), '')

def pad9(code):
    code = str(code).strip()
    return code.zfill(9) if code.isdigit() and len(code) == 8 else code   # 8자리는 앞의 0이 빠진 보험코드(385/385 일치 확인)

def read_pairs(path):
    f, enc = open_csv(path)
    r = csv.DictReader(f)
    miss = [c for c in PAIR_COLS if c not in (r.fieldnames or [])]
    if miss:
        raise SystemExit(f'병용금기 CSV 열이 달라요. 없는 열: {miss}\n파일의 열: {r.fieldnames}')
    ingr, extra, reasons, notes, dates, pairs, rows = {}, {}, {}, {}, {}, {}, 0
    def idx(t, k):
        if k not in t: t[k] = len(t)
        return t[k]
    for row in r:
        rows += 1
        a, b = row['성분코드A'].strip(), row['성분코드B'].strip()
        ingr[a] = row['성분명A'].strip(); ingr[b] = row['성분명B'].strip()
        for s in 'AB':
            code = pad9(row['제품코드' + s])
            if code and code not in extra:
                n, spec = split_name(row['제품명' + s])
                extra[code] = [n, spec, row['업소명' + s].strip(), row['성분코드' + s].strip(),
                               2, None]   # 2 = 현재 급여목록에 없는 제품(비급여이거나 삭제·변경된 제품일 수 있음)
        note = row['비고'].strip()
        pairs[(a, b, idx(reasons, row['금기사유'].strip()), idx(notes, note) if note else -1,
               idx(dates, row['고시적용일'].strip()))] = 1
    return dict(ingr=ingr, extra=extra, reasons=reasons, notes=notes, dates=dates, pairs=pairs, rows=rows, enc=enc)

def read_yak(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    head = [str(c).replace('\n', '').strip() if c is not None else '' for c in next(it)]
    miss = [c for c in YAK_COLS if c not in head]
    if miss:
        raise SystemExit(f'약제급여목록 열이 달라요. 없는 열: {miss}\n파일의 열: {head}')
    ix = {c: head.index(c) for c in YAK_COLS}
    out, ingr = {}, {}
    for row in it:
        g = lambda c: ('' if row[ix[c]] is None else str(row[ix[c]]).strip())
        code = g('제품코드')
        if not code: continue
        n, spec = split_name(g('제품명'))
        ingr[g('주성분코드')] = g('주성분명')
        out[code] = [n, spec, g('업체명'), g('주성분코드'), 1 if g('전일') == '일반' else 0, g('투여')]
    return dict(products=out, ingr=ingr, sheet=ws.title)

def dump(obj, path):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    open(path, 'w', encoding='utf-8').write(s)
    print(f'{os.path.basename(path)}: {len(s.encode("utf-8"))/1e6:.2f} MB (gzip {len(gzip.compress(s.encode("utf-8")))/1e6:.2f} MB)')

def main():
    if len(sys.argv) < 3: raise SystemExit(__doc__)
    csv_path, xlsx_path = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else 'data/dur'
    os.makedirs(out, exist_ok=True)
    P = read_pairs(csv_path); Y = read_yak(xlsx_path)

    products = dict(Y['products'])           # 급여목록이 기준(전체 급여 의약품)
    added = 0
    for code, v in P['extra'].items():       # 급여목록에 없는 병용금기 제품(비급여·삭제 등)을 보태 둔다
        if code not in products:
            products[code] = v; added += 1
    ingredients = dict(P['ingr']); ingredients.update({k: v for k, v in Y['ingr'].items() if k not in ingredients})

    today = datetime.date.today().isoformat()
    pairs_meta = {
        'source': '한국의약품안전관리원_병용금기약물', 'provider': '한국의약품안전관리원 (공공데이터포털)',
        'file': os.path.basename(csv_path), 'sourceRows': P['rows'], 'generatedAt': today,
        'license': '공공저작물 · 출처표시 · 상업적 이용금지(제2유형). 비상업적 연구·교육에만 사용, 상업적 활용은 사전 승인 필요',
        'note': '쌍은 방향이 없는 것으로 다루세요(원본은 A→B 한 방향). 성분코드는 건강보험심사평가원 주성분코드.'
    }
    dump({'meta': pairs_meta, 'ingredients': {k: v for k, v in ingredients.items()},
          'reasons': [k for k, _ in sorted(P['reasons'].items(), key=lambda x: x[1])],
          'notes': [k for k, _ in sorted(P['notes'].items(), key=lambda x: x[1])],
          'dates': [k for k, _ in sorted(P['dates'].items(), key=lambda x: x[1])],
          'pairs': [[a, b, rs, nt, dt] for (a, b, rs, nt, dt) in P['pairs']]},
         os.path.join(out, 'dur-pairs.json'))
    dump({'meta': {'source': '약제급여목록 및 급여상한금액표', 'file': os.path.basename(xlsx_path), 'sheet': Y['sheet'],
                   'generatedAt': today, 'licenseNote': '제공기관·이용 조건은 파일을 받은 페이지에서 확인해 기록할 것',
                   'fields': ['제품명', '규격', '업체명', '주성분코드', '구분(0=전문 1=일반 2=급여목록에 없음: 병용금기 파일에만 있는 제품)', '투여(내복/주사/외용/기타, 병용금기 파일에서 보탠 제품은 null)'],
                   'note': '제품코드는 9자리 보험(EDI) 코드. 8자리로 들어 있던 코드는 앞에 0을 붙였다.'},
          'products': products}, os.path.join(out, 'products.json'))
    print(f'병용금기 {P["rows"]:,}행 → 쌍 {len(P["pairs"]):,}개 · 사유 {len(P["reasons"])}개 / 약제급여목록 제품 {len(Y["products"]):,}개 + 병용금기 파일에서만 있는 제품 {added:,}개 = {len(products):,}개')

if __name__ == '__main__':
    main()
