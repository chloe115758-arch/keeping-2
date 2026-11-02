#!/usr/bin/env python3
"""
앱에 들어 있는 허가사항 묶음(data/care/care-pack.json)에서 "영양제·음식과 함께 쓸 때 주의가 나오는 약"을 찾아 목록으로 보여 준다.
시연이나 측정에 쓸 조합을 고르는 용도. 사용법: python3 scripts/demo_combos.py [--top 6] > docs/demo-combos.md
(약 이름은 묶음 안의 제품 이름을 그대로 쓰므로 앱 검색에서 바로 찾을 수 있어요.)
"""
import argparse, json, os, sys

LABEL = {'supplement': '영양제', 'drug_group': '약 종류', 'food': '음식'}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pack', default='data/care/care-pack.json')
    ap.add_argument('--top', type=int, default=6)
    a = ap.parse_args()
    if not os.path.exists(a.pack):
        sys.exit('%s 이 없어요. 프로젝트 맨 위 폴더에서 실행하세요.' % a.pack)
    pack = json.load(open(a.pack, encoding='utf-8'))
    entries = pack.get('entries', pack)
    by = {}   # (kind, key, ko) -> [(간격 있음?, 전문/일반, 제품명, 위치, 간격글)]
    for ingr, e in entries.items():
        for r in e.get('rules', []):
            if r.get('kind') not in ('interaction', 'note'):
                continue
            for m in r.get('matched') or []:
                if m.get('kind') not in LABEL:
                    continue
                iv = r.get('interval')
                ivtext = (iv.get('text') if isinstance(iv, dict) else '') or ''
                by.setdefault((m['kind'], m['key'], m.get('ko', m['key'])), []).append(
                    (1 if iv else 0, e.get('etcOtc', ''), e.get('itemName', ingr), r.get('where', ''), ivtext))
    print('# 시연·측정에 쓸 수 있는 조합 후보\n')
    print('간격 숫자가 있는 것이 먼저 나와요. "약 이름"을 앱 약 검색에 그대로 넣으면 돼요.\n')
    for (kind, key, ko), lst in sorted(by.items(), key=lambda kv: (kv[0][0] != 'supplement', -len(kv[1]))):
        seen, pick = set(), []
        for it in sorted(lst, key=lambda x: (-x[0], x[1] != '전문의약품', x[2])):
            if it[2] in seen:
                continue
            seen.add(it[2]); pick.append(it)
            if len(pick) >= a.top:
                break
        print('## %s · %s  (%d개 약에서 안내)\n' % (LABEL[kind], ko, len({x[2] for x in lst})))
        for iv, cat, name, where, ivtext in pick:
            print('- %s %s%s · %s' % (name, ('[%s] ' % cat) if cat else '', ('· ' + ivtext) if ivtext else '', where))
        print()

if __name__ == '__main__':
    main()
