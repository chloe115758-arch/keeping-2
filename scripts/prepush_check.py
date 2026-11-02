#!/usr/bin/env python3
"""
push 전 점검 — 올라가면 안 되는 것이 새로 올라가지 않는지 한 번에 확인한다. 값(키)은 화면에 찍지 않는다.
  python3 scripts/prepush_check.py        (프로젝트 맨 위 폴더에서)
점검: ① 커밋 안 된 변경 ② 추적 중인 .env·zip·raw·큰 파일 ③ .env의 모든 값이 "이번에 올라갈 커밋"과 "현재 파일"에 없는지
      ④ .env.example에 키처럼 생긴 값이 없는지.  모두 ✅이면 종료 코드 0, 하나라도 ❌이면 1.
이미 올라간 옛 기록에 남은 값은 새로 올라가는 것이 아니므로 ❌가 아니라 참고로만 알려 준다.
"""
import os, re, subprocess, sys

def git(*a): return subprocess.run(['git', *a], capture_output=True, text=True)
def out(*a): return git(*a).stdout

ok = True
def line(good, msg):
    global ok
    print(('✅ ' if good else '❌ ') + msg)
    if not good: ok = False

if git('rev-parse', '--is-inside-work-tree').returncode != 0: sys.exit('git 저장소 안에서 실행해 주세요')
up = git('rev-parse', '--abbrev-ref', '@{u}'); has_up = up.returncode == 0
rng = '@{u}..HEAD' if has_up else 'HEAD'
ahead = out('rev-list', '--count', rng).strip()
print('올라갈 커밋: %s개 (%s)\n' % (ahead, '기준 ' + up.stdout.strip() if has_up else '원격 기준 없음, 전체'))

# ① 커밋 안 된 변경
chg = [l for l in out('status', '--short').splitlines() if not l.startswith('??')]
line(not chg, '커밋 안 된 변경: ' + ('없음' if not chg else '%d개 → %s' % (len(chg), ', '.join(l[3:] for l in chg[:5]))))

# ② 추적 중인 위험 파일
files = [f for f in out('ls-files').splitlines() if f]
bad = [f for f in files if re.search(r'(^|/)\.env$|\.zip$|(^|/)raw/|\.pem$|\.key$', f)]
big = [f for f in files if os.path.exists(f) and os.path.getsize(f) > 50 * 1024 * 1024]
line(not bad, '추적 중인 .env·zip·raw·키 파일: ' + ('없음' if not bad else ', '.join(bad)))
line(not big, '50MB 넘는 파일: ' + ('없음' if not big else ', '.join(big)))

# ③ .env의 값이 올라갈 커밋·현재 파일에 있는지
env = {}
if os.path.exists('.env'):
    for l in open('.env', encoding='utf-8'):
        l = l.strip()
        if l and not l.startswith('#') and '=' in l:
            k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
secrets = {k: v for k, v in env.items() if len(v) >= 8}
if not secrets: print('(참고) .env에서 검사할 값(8자 이상)이 없어요')
for k, v in secrets.items():
    in_commits = len(out('log', rng, '--oneline', '-S' + v).strip().splitlines())
    in_files = git('grep', '-q', '-F', '-e', v, 'HEAD').returncode == 0
    in_old = len(out('log', '--all', '--oneline', '-S' + v).strip().splitlines())
    line(in_commits == 0 and not in_files, '%s (길이 %d): 올라갈 커밋에서 %d개, 현재 파일에서 %s' % (k, len(v), in_commits, '발견' if in_files else '없음'))
    if in_old and in_commits == 0 and not in_files:
        print('   (참고) 이 값은 이미 올라간 옛 기록 %d곳에 남아 있어요. 새로 올라가지는 않아요. 키를 새로 받으면 해결돼요.' % in_old)

# ④ .env.example
if os.path.exists('.env.example'):
    risky = []
    for l in open('.env.example', encoding='utf-8'):
        l = l.strip()
        if l and not l.startswith('#') and '=' in l:
            k, v = l.split('=', 1); v = v.strip().strip('"').strip("'")
            if re.fullmatch(r'[A-Za-z0-9%+/=_-]{16,}', v) and not re.search(r'[가-힣]', v): risky.append(k.strip())
    line(not risky, '.env.example에 키처럼 생긴 값: ' + ('없음' if not risky else ', '.join(risky)))

print('\n결과: ' + ('모두 통과 → git push 해도 돼요' if ok else '❌가 있어요 → push하지 마세요'))
sys.exit(0 if ok else 1)
