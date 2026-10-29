#!/usr/bin/env python3
"""
허가사항 기반 안내가 급여목록 제품의 몇 %를 덮는지 잰다(제품 단위). 발표의 "범위"를 숫자로 말할 때 쓴다.

사용법: python3 scripts/care_coverage.py [--pack data/care/care-pack.json]
 - 덮는다 = 제품의 성분(함량 제거한 이름)에 허가사항 규칙 묶음이 있고, 규칙이 1개 이상이며,
            묶음에 투여 경로(route)가 적혀 있으면 제품의 경로와 같다.
"""
import argparse, collections, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build_care_pack import clean_key

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pack', default='data/care/care-pack.json')
    ap.add_argument('--products', default='data/dur/products.json')
    ap.add_argument('--pairs', default='data/dur/dur-pairs.json')
    a = ap.parse_args()
    E = json.load(open(a.pack, encoding='utf-8'))['entries']
    P = json.load(open(a.products, encoding='utf-8'))['products']
    names = json.load(open(a.pairs, encoding='utf-8'))['ingredients']
    tot = collections.Counter(); cov = collections.Counter(); miss = collections.Counter()
    reason = collections.Counter(); no_route = 0
    for code, v in P.items():
        if v[4] == 2:      # 급여목록 밖(병용금기 파일에만 있던 제품)은 제외
            continue
        cat = '전문' if v[4] == 0 else '일반'
        key = clean_key(names.get(v[3], ''))
        e = E.get(key)
        tot[cat] += 1
        if not e:
            reason['성분 묶음 없음(수집 안 됨·미해결)'] += 1; miss[key] += 1; continue
        if not e['rules']:
            reason['묶음은 있으나 규칙 0개'] += 1; miss[key] += 1; continue
        if e.get('route') and v[5] and e['route'] != v[5]:
            reason['투여 경로가 달라 쓰지 않음'] += 1; miss[key] += 1; continue
        if not e.get('route'): no_route += 1
        cov[cat] += 1
    T, C = sum(tot.values()), sum(cov.values())
    print('급여목록 제품 %d개 중 허가사항 기반 안내 대상 %d개 (%.1f%%)' % (T, C, C / T * 100 if T else 0))
    for cat in ('전문', '일반'):
        if tot[cat]: print('  %s의약품: %d개 중 %d개 (%.1f%%)' % (cat, tot[cat], cov[cat], cov[cat] / tot[cat] * 100))
    print('덮이지 않은 이유:', dict(reason))
    print('성분 묶음 %d개(규칙이 있는 것 %d개)' % (len(E), sum(1 for e in E.values() if e['rules'])))
    if no_route: print('※ 투여 경로(route)가 적히지 않은 묶음에 속한 제품 %d개는 경로를 확인하지 못한 채 덮인 것으로 셌습니다.' % no_route)
    print('다음에 수집하면 가장 많이 덮이는 성분(제품 수 순):')
    for k, n in miss.most_common(12): print('  %5d개  %s' % (n, k or '(성분 이름 없음)'))

if __name__ == '__main__':
    main()
