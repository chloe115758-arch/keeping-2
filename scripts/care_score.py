#!/usr/bin/env python3
"""review-sample.md에 표시한 "맞음/틀림"으로 추출 정밀도를 계산한다. 사용법: python3 scripts/care_score.py [파일]"""
import re, sys, collections

def main(argv):
    path = argv[1] if len(argv) > 1 else 'data/care/review-sample.md'
    txt = open(path, encoding='utf-8').read()
    blocks = re.split(r'\n---\n', txt)[1:]
    ok = bad = blank = 0
    by_kind = collections.defaultdict(lambda: [0, 0])
    wrong = []
    for b in blocks:
        title = re.search(r'### (\d+)\. (.+)', b)
        kind = (re.search(r'종류: (\w+)', b) or [None, '?'])[1]
        yes = bool(re.search(r'- \[[xX]\] 맞음', b)); no = bool(re.search(r'- \[[xX]\] 틀림', b))
        if yes and no: blank += 1; continue
        if yes: ok += 1; by_kind[kind][0] += 1
        elif no: bad += 1; by_kind[kind][1] += 1; wrong.append((title.group(1), title.group(2)))
        else: blank += 1
    n = ok + bad
    print('표시한 규칙 %d개(맞음 %d, 틀림 %d), 표시 안 함 %d개' % (n, ok, bad, blank))
    if n:
        print('정밀도 = %d/%d = %.0f%%' % (ok, n, ok / n * 100))
        for k, (a, b) in sorted(by_kind.items()):
            print('  %s: 맞음 %d · 틀림 %d' % (k, a, b))
        if wrong: print('틀림으로 표시한 규칙:', '; '.join('%s번 %s' % w for w in wrong))
        if n < 30: print('※ 표시한 규칙이 30개 미만이라 숫자의 신뢰가 낮습니다(소표본).')
    else:
        print('아직 표시한 규칙이 없습니다.')

if __name__ == '__main__':
    main(sys.argv)
