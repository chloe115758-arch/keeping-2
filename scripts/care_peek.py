#!/usr/bin/env python3
"""
성분 하나의 허가사항을 들여다본다: 문서의 항목 제목, 규칙이 어떻게 뽑혔는지, 상호작용·주의 항목의 문장.
규칙이 하나도 없는 성분(예: almagate)이 왜 비었는지 볼 때 쓴다. API를 부르지 않고 받아 둔 원본(data/care/raw)만 읽는다.

사용법: python3 scripts/care_peek.py almagate          (성분 이름의 일부)
        python3 scripts/care_peek.py almagate --all    (모든 단락을 보여줌)
"""
import argparse, glob, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import care_extract as C

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name')
    ap.add_argument('--by', default='data/care/by-ingredient')
    ap.add_argument('--raw', default='data/care/raw')
    ap.add_argument('--all', action='store_true')
    a = ap.parse_args()
    hits = []
    for f in sorted(glob.glob(os.path.join(a.by, '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        if a.name.lower() in (d.get('ingredient') or '').lower():
            hits.append(d)
    if not hits:
        print('일치하는 성분이 없습니다:', a.name); return
    for d in hits[:3]:
        seq = str(d.get('productSeq'))
        print('=' * 70)
        print('성분:', d.get('ingredient'), '| 제품:', d.get('itemName'), '| 품목기준코드', seq, '| 경로', d.get('route'), '| ATC', d.get('atc'))
        rawp = os.path.join(a.raw, seq + '.json')
        if not os.path.exists(rawp):
            print('원본 응답 없음:', rawp); continue
        resp = json.load(open(rawp, encoding='utf-8'))
        items = (resp.get('body') or {}).get('items') or []
        it = items[0] if items else {}
        it = it.get('item', it)
        nb = it.get('NB_DOC_DATA') or ''
        print('NB 문서 길이: %d자, UD 문서 길이: %d자' % (len(nb), len(it.get('UD_DOC_DATA') or '')))
        arts = C.parse_doc(nb)
        print('\n[사용상의 주의사항] 항목 %d개:' % len(arts))
        for title, paras in arts:
            sec = C._section(title)
            print('  - %s  (단락 %d개)  %s' % (title or '(제목 없음)', len(paras), ('← 읽는 항목: ' + sec) if sec else ''))
        print('\n[규칙으로 뽑힌 것] %d개' % len(d.get('rules') or []))
        for r in (d.get('rules') or [])[:10]:
            print('  -', r['kind'], r['where'], [m['key'] for m in r['matched']], r['excerpt'][:60])
        print('\n[읽는 항목의 단락 (키워드가 안 걸린 것 포함)]')
        shown = 0
        for title, paras in arts:
            if not C._section(title): continue
            for p in paras:
                hit = [m['key'] for m in C._keys_in(p)]
                if a.all or hit or shown < 8:
                    print('  [%s] %s | 키워드 %s' % (title[:14], p[:110], hit or '없음')); shown += 1
        # 읽는 항목이 아닌 곳에서 키워드가 걸리는 문장도 보여준다(항목 제목이 예상과 다른 문서를 찾는다)
        print('\n[읽지 않는 항목에서 키워드가 걸리는 문장 (최대 8개)]')
        n = 0
        for title, paras in arts:
            if C._section(title): continue
            for p in paras:
                hit = [m['key'] for m in C._keys_in(p)]
                if hit and n < 8:
                    print('  [%s] %s | %s' % (title[:16], p[:110], hit)); n += 1
        if n == 0: print('  (없음)')

if __name__ == '__main__':
    main()
