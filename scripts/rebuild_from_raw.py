#!/usr/bin/env python3
"""
받아 둔 허가사항 응답 원본(data/care/raw/*.json)으로 성분별 결과(data/care/by-ingredient/*.json)를 다시 만든다. API를 부르지 않는다.

하는 일
  1) 새 추출기(scripts/care_extract.py)로 규칙을 다시 뽑는다.
  2) 대표 제품의 투여 경로(route)와 보험코드(ediCode)를 채운다. (응답의 EDI_CODE → data/dur/products.json의 투여 구분)
  3) 전/후 숫자를 보여준다.
사용법: python3 scripts/rebuild_from_raw.py [--dry-run]
  --dry-run: 파일을 바꾸지 않고 숫자만 본다.
"""
import argparse, collections, datetime, glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import care_extract as C

def first_item(resp):
    items = ((resp or {}).get('body') or {}).get('items') or []
    if not items:
        return None
    it = items[0]
    return it.get('item', it) if isinstance(it, dict) else None

def route_of(it, products, by_name):
    """투여 경로를 찾는다. 1) 응답의 EDI_CODE 2) EDI_CODE에 코드가 여럿 들어 있으면 하나씩 3) 같은 이름의 제품(경로가 하나일 때)."""
    raw = str(it.get('EDI_CODE') or '')
    pieces = [x for x in re.split(r'\D+', raw) if len(x) in (8, 9)]
    for i, x in enumerate(pieces):
        code = x.zfill(9)
        prod = products.get(code)
        if prod and len(prod) > 5 and prod[5]:
            return prod[5], code, ('edi' if i == 0 and len(pieces) == 1 else 'edi-split')
    routes = by_name.get(str(it.get('ITEM_NAME') or '').strip())
    if routes and len(routes) == 1:
        return next(iter(routes)), (pieces[0].zfill(9) if pieces else None), 'name'
    return None, (pieces[0].zfill(9) if pieces else (raw or None)), None

def kinds_and_keys(entries_rules):
    k = collections.Counter(r['kind'] for rules in entries_rules for r in rules)
    keys = collections.Counter(m['key'] for rules in entries_rules for r in rules for m in r['matched'])
    return k, keys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--by', default='data/care/by-ingredient')
    ap.add_argument('--raw', default='data/care/raw')
    ap.add_argument('--products', default='data/dur/products.json')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    products = json.load(open(a.products, encoding='utf-8'))['products']
    by_name = collections.defaultdict(set)
    for v in products.values():
        if len(v) > 5 and v[5]: by_name[v[0].strip()].add(v[5])
    how = collections.Counter(); missing_examples = []
    files = sorted(glob.glob(os.path.join(a.by, '*.json')))
    before, after, route_found, route_missing, no_raw, bad = [], [], 0, 0, [], []
    changed = 0
    for f in files:
        d = json.load(open(f, encoding='utf-8'))
        seq = str(d.get('productSeq') or '')
        rawp = os.path.join(a.raw, seq + '.json')
        if not seq or not os.path.exists(rawp):
            no_raw.append(os.path.basename(f)); continue
        it = first_item(json.load(open(rawp, encoding='utf-8')))
        if not it or not it.get('NB_DOC_DATA') and not it.get('UD_DOC_DATA'):
            bad.append(os.path.basename(f)); continue
        before.append(d.get('rules') or [])
        rules = C.extract_rules(it.get('NB_DOC_DATA'), it.get('UD_DOC_DATA'), seq)
        after.append(rules)
        route, edi, via = route_of(it, products, by_name)
        if route: route_found += 1; how[via] += 1
        else:
            route_missing += 1
            if len(missing_examples) < 12: missing_examples.append((os.path.basename(f), str(it.get('ITEM_NAME'))[:30], str(it.get('EDI_CODE')), str(it.get('ETC_OTC_CODE'))))
        d['rules'] = rules; d['route'] = route; d['ediCode'] = edi or None
        d['extractor'] = 'kw-v2'; d['rebuiltAt'] = datetime.date.today().isoformat()
        if not a.dry_run:
            json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        changed += 1
    kb, kyb = kinds_and_keys(before); ka, kya = kinds_and_keys(after)
    print('성분 %d개 중 다시 만든 것 %d개%s' % (len(files), changed, ' (dry-run: 파일은 바꾸지 않음)' if a.dry_run else ''))
    print('원본 응답이 없어 건너뜀 %d개, 문서 본문이 비어 건너뜀 %d개' % (len(no_raw), len(bad)))
    print('투여 경로 찾음 %d개, 못 찾음 %d개(null)  (찾은 방법: %s)' % (route_found, route_missing, dict(how)))
    if missing_examples:
        print('경로를 못 찾은 예(파일 | 제품 이름 | 응답의 EDI_CODE | 전문/일반):')
        for e in missing_examples: print('   ', ' | '.join(e))
    print('규칙 종류 이전→이후:')
    for k in sorted(set(kb) | set(ka)):
        print('  %-16s %5d → %5d' % (k, kb[k], ka[k]))
    print('걸린 키 이전→이후:')
    for k in sorted(set(kyb) | set(kya)):
        print('  %-16s %5d → %5d' % (k, kyb[k], kya[k]))
    print('규칙이 하나도 없는 성분: %d개 → %d개' % (sum(1 for r in before if not r), sum(1 for r in after if not r)))
    if no_raw: print('원본 없음 예:', ', '.join(no_raw[:5]))
    if bad: print('본문 비어 있음 예:', ', '.join(bad[:5]))

if __name__ == '__main__':
    main()
