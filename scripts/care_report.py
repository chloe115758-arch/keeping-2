#!/usr/bin/env python3
"""
수집·추출 결과(data/care/care-pack.json)를 요약하고, 사람이 정오를 표시할 검토 표본(무작위 N개)을 만든다.

사용법
  python3 scripts/care_report.py                    # 요약 출력 + data/care/review-sample.md 만들기(기본 40개)
  python3 scripts/care_report.py --n 60 --seed 7    # 표본 크기·무작위 시드
그다음 review-sample.md를 열어 각 규칙 아래의 "- [ ] 맞음" 또는 "- [ ] 틀림"에 x를 표시하고
  python3 scripts/care_score.py                     # 정밀도(표시한 것 중 맞은 비율) 계산
"""
import argparse, collections, json, os, random

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pack', default='data/care/care-pack.json')
    ap.add_argument('--out', default='data/care/review-sample.md')
    ap.add_argument('--n', type=int, default=40)
    ap.add_argument('--seed', type=int, default=1)
    a = ap.parse_args()
    pack = json.load(open(a.pack, encoding='utf-8'))
    E = pack['entries']
    rules = [(name, e, r) for name, e in E.items() for r in e['rules']]

    print('== 요약 ==')
    print('성분 %d개, 규칙이 있는 성분 %d개, 규칙 %d개' % (len(E), sum(1 for e in E.values() if e['rules']), len(rules)))
    kinds = collections.Counter(r['kind'] for _, _, r in rules)
    print('규칙 종류:', dict(kinds))
    keys = collections.Counter(m['key'] for _, _, r in rules for m in r['matched'])
    print('걸린 키(상호작용·주의):', dict(keys.most_common()))
    iv = [r for _, _, r in rules if r.get('interval')]
    print('간격 숫자가 읽힌 규칙: %d개 (성분 %d개)' % (len(iv), len({n for n, _, r in rules if r.get('interval')})))
    for n, _, r in [x for x in rules if x[2].get('interval')][:6]:
        print('   - %s | %s | %s | %s' % (n, r['where'], r['interval']['text'], r['excerpt'][:70]))
    print('복용 시점(timing) 규칙이 있는 성분: %d개' % len({n for n, _, r in rules if r['kind'] == 'timing'}))
    empty = [n for n, e in E.items() if not e['rules']]
    print('규칙이 하나도 없는 성분 %d개: %s' % (len(empty), ', '.join(empty[:12]) + (' …' if len(empty) > 12 else '')))
    per = collections.Counter(n for n, _, r in rules if r['kind'] in ('interaction', 'note'))
    print('상호작용·주의 규칙이 가장 많은 성분:', per.most_common(5))
    atcs = collections.Counter((e.get('atc') or '')[:3] for e in E.values())
    print('약효 분류(ATC 앞 3자리) 분포 상위:', atcs.most_common(8))

    # 검토 표본: 상호작용·주의·복용 시점만(임부·고령자 항목은 원문 그대로라 정오 대상이 아님)
    pool = [x for x in rules if x[2]['kind'] in ('interaction', 'note', 'timing')]
    random.Random(a.seed).shuffle(pool)
    pick = pool[:a.n]
    lines = ['# 추출 규칙 검토 표본 (%d개, 시드 %d)' % (len(pick), a.seed), '',
             '각 규칙을 읽고 **맞음** 또는 **틀림** 중 하나에 `x`를 표시하세요(예: `- [x] 맞음`). 모르겠으면 둘 다 비워 두세요.', '',
             '- **맞음**: 문장이 허가사항에 실제로 있고, "걸린 키워드"와 **실제로 관련된 안내**다(그 영양제·음식·약 분류를 함께 쓰거나 먹을 때의 주의, 또는 복용 시점).',
             '- **틀림**: 키워드가 우연히 걸렸다(몸의 작용 설명, 비교 표현, 다른 뜻의 글자 등). 또는 시점 문장이 아니다.', '']
    for i, (name, e, r) in enumerate(pick, 1):
        keys_s = ', '.join('%s(%s)' % (m['key'], m['surface']) for m in r['matched']) or '-'
        lines += ['---', '', '### %d. %s · %s' % (i, name, r['where']), '',
                  '- 종류: %s · 걸린 키워드: %s · 간격: %s%s' % (r['kind'], keys_s, (r.get('interval') or {}).get('text', '-'), (' · 복용 시점: ' + r['meal']) if r.get('meal') else ''),
                  '- 원문: ' + r['excerpt'], '', '- [ ] 맞음', '- [ ] 틀림', '']
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    open(a.out, 'w', encoding='utf-8').write('\n'.join(lines))
    print('\n검토 표본 %d개 → %s (열어서 표시한 뒤 python3 scripts/care_score.py)' % (len(pick), a.out))

if __name__ == '__main__':
    main()
