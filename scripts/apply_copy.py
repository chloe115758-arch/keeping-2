#!/usr/bin/env python3
"""docs/ux-writing.md의 문구 표 → data/copy/greeting.json (+ 금지 표현·변수 점검). 사용법: python3 scripts/apply_copy.py"""
import json, os, re, sys
MD, OUT = 'docs/ux-writing.md', 'data/copy/greeting.json'
BANNED = re.compile(r'안전|괜찮|문제없|먹어도|드세요|복용하세요|챙겨\s*드|중단하세요|끊으세요|늘리세요|줄이세요|못\s*했어요|안\s*드셨')
VARS = {'name', 'taken', 'left', 'total', 'missed', 'missedN', 'subject', 'object', 'interval', 'time', 'verb', 'dept', 'text', 'c', 'more', 'n', 'note', 'band', 'amount', 'unit'}
ALLOWED = ['안전하다는 뜻은 아니']   # 부정하는 문장은 허용("안전하다는 뜻은 아니에요")
def main():
    t = open(MD, encoding='utf-8').read()
    tone = (re.search(r'^ACTIVE_TONE:\s*(기본|친근)', t, re.M) or [None, '친근'])[1]
    rows, in_tab = {}, False
    for line in t.splitlines():
        if line.startswith('|') and '키' in line and '내 문구' in line: in_tab = True; continue
        if in_tab:
            if not line.startswith('|'): in_tab = False; continue
            c = [x.strip() for x in line.strip().strip('|').split('|')]
            if len(c) < 5 or set(c[0]) <= set('-: '): continue
            rows[c[0].strip('`')] = {'기본': c[2], '친근': c[3], 'mine': c[4]}
    copy, mine_used, warn = {}, [], []
    for k, r in rows.items():
        v = r['mine'] or r[tone]
        if r['mine']: mine_used.append(k)
        copy[k] = v
        vv = v
        for a in ALLOWED: vv = vv.replace(a, '')
        if BANNED.search(vv): warn.append('%s: 금지 표현이 들어 있어요 → %s' % (k, BANNED.search(vv).group(0)))
        bad = set(re.findall(r'\{(\w+)(?::[^}]*)?\}', v)) - VARS
        if bad: warn.append('%s: 모르는 변수 %s' % (k, sorted(bad)))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'tone': tone, 'copy': copy}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('말투: %s, 문구 %d개, 내 문구 %d개 → %s' % (tone, len(copy), len(mine_used), OUT))
    for w in warn: print('⚠', w)
    if '--strict' in sys.argv and warn: sys.exit(1)
if __name__ == '__main__': main()
