#!/usr/bin/env python3
"""
data/care/by-ingredient/*.json (수집·추출 결과, 성분당 1개) → data/care/care-pack.json (앱이 읽는 한 파일)

키: 성분 이름(dur.js의 cleanIngr로 정리한 이름)의 소문자. 앱은 제품의 성분 이름으로 이 키를 찾는다.
사용법: python3 scripts/build_care_pack.py [입력폴더=data/care/by-ingredient] [출력=data/care/care-pack.json]
"""
import glob, json, os, re, sys, collections

UNIT_RE = re.compile(r'\s*\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|µg|μg|ug|ml|iu|u|%|meq|mmol|㎍|㎎|㎏|㎖)(?![a-z])', re.I)
SLASH_UNIT_RE = re.compile(r'\s*/\s*(?:㎖|㎏|㎎|㎍|ml|mg|g|kg|l)(?![a-z])', re.I)

def clean_key(name):
    """js/dur.js의 cleanIngr와 같은 정리(함량·단위 찌꺼기 제거). 수집 때 옛 규칙으로 묶인 이름이 있어도 앱의 키와 맞춘다."""
    n = re.sub(r'\(\s*as\s[^)]*\)', '', name, flags=re.I)
    n = UNIT_RE.sub('', n)
    n = SLASH_UNIT_RE.sub('', n)
    n = re.sub(r'\(\s*/\s*[a-zA-Z㎖]+\s*\)', '', n)
    n = re.sub(r'\(\s*\)', '', n)
    parts = [re.sub(r'\s+', ' ', x).strip() for x in re.split(r'[+,]', n)]
    return ' + '.join(x for x in parts if x).lower()

def main(argv):
    src = argv[1] if len(argv) > 1 else 'data/care/by-ingredient'
    out = argv[2] if len(argv) > 2 else 'data/care/care-pack.json'
    entries, skipped = {}, []
    for f in sorted(glob.glob(os.path.join(src, '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        name = clean_key((d.get('ingredient') or '').strip())
        if not name or 'rules' not in d:
            skipped.append(os.path.basename(f)); continue
        if name in entries and len(entries[name]['rules']) >= len(d['rules']):
            skipped.append(os.path.basename(f) + '(같은 키가 이미 있음)'); continue
        entries[name] = {k: d.get(k) for k in ('ingredient', 'productSeq', 'itemName', 'atc', 'etcOtc', 'route', 'ediCode', 'changeDate', 'docUrls', 'fetchedAt')}
        entries[name]['rules'] = d['rules']
    kinds = collections.Counter(r['kind'] for e in entries.values() for r in e['rules'])
    pack = {'meta': {'source': '식품의약품안전처 허가정보 API(공공데이터포털) 허가사항, 규칙 기반 추출(scripts/care_extract.py)',
                     'entries': len(entries), 'withRules': sum(1 for e in entries.values() if e['rules']), 'ruleKinds': dict(kinds)},
            'entries': entries}
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(',', ':'))
    print('성분 %d개(규칙이 있는 성분 %d개), 건너뜀 %d개 → %s (%.2f MB)' % (len(entries), pack['meta']['withRules'], len(skipped), out, os.path.getsize(out) / 1e6))
    print('규칙 종류:', dict(kinds))

if __name__ == '__main__':
    main(sys.argv)
