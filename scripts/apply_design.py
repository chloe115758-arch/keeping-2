#!/usr/bin/env python3
"""
docs/design.md의 값 표 → css/design-tokens.css + design-preview.html (A 지금 / B 제안 / 내 값 나란히) + 접근성 가드 점검

사용법: python3 scripts/apply_design.py [--strict]
  --strict: 가드를 어기면 오류로 끝낸다(기본은 ⚠만 보여주고 계속).
규칙
  - 값 선택: 내 값(비어 있지 않으면) > ACTIVE_PRESET(A 또는 B)의 값. 🔒 토큰은 내 값을 무시한다.
  - 가드 문법(가드 칸): "대비 4.5 vs --kp-surface", "≥12px", "🔒"
"""
import re, sys, os, html

MD = 'docs/design.md'
OUT_CSS = 'css/design-tokens.css'
OUT_HTML = 'design-preview.html'

def parse(md_text):
    active = (re.search(r'^ACTIVE_PRESET:\s*([AB])', md_text, re.M) or [None, 'B'])[1]
    rows = []
    in_table = False
    for line in md_text.splitlines():
        if line.startswith('|') and '토큰' in line and '내 값' in line:
            in_table = True; continue
        if in_table:
            if not line.startswith('|'):
                in_table = False; continue
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(cells) < 6 or set(cells[0]) <= set('-: '):
                continue
            tok = cells[0].strip('`')
            if not tok.startswith('--kp-'):
                continue
            clean = lambda s: s.strip('`').strip()
            rows.append({'token': tok, 'A': clean(cells[1]), 'B': clean(cells[2]), 'mine': clean(cells[3]),
                         'usage': cells[4], 'guard': cells[5]})
    return active, rows

def luminance(hexv):
    m = re.fullmatch(r'#([0-9a-fA-F]{6})', hexv.strip())
    if not m: return None
    v = [int(m.group(1)[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    v = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in v]
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]

def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    if la is None or lb is None: return None
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def px(v):
    m = re.fullmatch(r'(\d+(?:\.\d+)?)px', v.strip())
    return float(m.group(1)) if m else None

def resolve(rows, preset, use_mine):
    out, mine_used = {}, []
    for r in rows:
        locked = '🔒' in r['guard']
        v = r['mine'] if (use_mine and r['mine'] and not locked) else r[preset]
        if use_mine and r['mine'] and not locked: mine_used.append(r['token'])
        out[r['token']] = v
    return out, mine_used

def check(rows, vals):
    problems = []
    for r in rows:
        g = r['guard']; v = vals[r['token']]
        m = re.search(r'대비\s*([\d.]+)\s*vs\s*(--kp-[\w-]+)', g)
        if m:
            c = contrast(v, vals.get(m.group(2), ''))
            if c is None: problems.append('%s: 색을 #RRGGBB로 적어 주세요(%s)' % (r['token'], v))
            elif c < float(m.group(1)): problems.append('%s: 대비 %.2f (최소 %s) vs %s' % (r['token'], c, m.group(1), m.group(2)))
        m = re.search(r'≥\s*(\d+)\s*px', g)
        if m:
            p = px(v)
            if p is None: problems.append('%s: 크기를 px로 적어 주세요(%s)' % (r['token'], v))
            elif p < float(m.group(1)): problems.append('%s: %spx (최소 %spx)' % (r['token'], int(p) if p == int(p) else p, m.group(1)))
    return problems

def css_block(selector, vals):
    return selector + ' {\n' + '\n'.join('  %s: %s;' % (k, v) for k, v in vals.items()) + '\n}\n'

PREVIEW_CSS = """
body{margin:0;padding:24px;background:#dfe3e6;font-family:system-ui,'Noto Sans CJK KR',sans-serif;color:#222}
h1.pg{font-size:18px;margin:0 0 4px}.note{font-size:13px;color:#555;margin:0 0 16px}
.wrap{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}.col h3{font-size:14px;margin:0 0 8px}
.kp{width:402px;background:var(--kp-bg-page);color:var(--kp-text);font-family:var(--kp-font);letter-spacing:var(--kp-ls);font-size:var(--kp-fs-body);line-height:var(--kp-lh);border-radius:32px;overflow:hidden;margin-bottom:24px;position:relative;border:1px solid #c5cbcf}
.kp *{box-sizing:border-box}
.status{height:44px;padding:16px 28px 0;font-size:14px;font-weight:600;display:flex;justify-content:space-between}
.top{padding:10px var(--kp-gap-page) 20px}
.top .d{font-size:13px;color:var(--kp-text-sub)}
.top h1{margin:2px 0 6px;font-size:var(--kp-fs-title);font-weight:var(--kp-fw-title);line-height:1.3}
.top .s{color:var(--kp-text-sub)}.top .s b{color:var(--kp-caution-text);font-weight:var(--kp-fw-strong)}
.tl{padding:4px var(--kp-gap-page) 4px calc(var(--kp-gap-page) - 8px)}
.row{display:flex}
.time{width:var(--kp-time-w);flex:none;text-align:right;font-weight:var(--kp-fw-strong);padding-top:21px;font-variant-numeric:tabular-nums}
.time.s{font-size:12px;font-weight:500;color:var(--kp-text-sub);padding-top:0}
.rail{width:var(--kp-rail-w);flex:none;position:relative}
.rail:before{content:"";position:absolute;left:calc(50% - var(--kp-line-w)/2);top:0;bottom:0;width:var(--kp-line-w);background:var(--kp-rail)}
.rail.dn:before{background:var(--kp-rail-done)}
.rail.end:before{bottom:calc(100% - 32px)}
.node{position:absolute;left:calc(50% - var(--kp-node-size)/2);top:calc(32px - var(--kp-node-size)/2);width:var(--kp-node-size);height:var(--kp-node-size);border-radius:50%}
.node.now{border:3px solid var(--kp-brand);background:var(--kp-bg-page)}
.node.ok{background:var(--kp-brand)}.node.ok:after{content:"";position:absolute;left:33%;top:16%;width:28%;height:50%;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
.dot{position:absolute;left:calc(50% - var(--kp-dot-size)/2);top:calc(32px - var(--kp-dot-size)/2);width:var(--kp-dot-size);height:var(--kp-dot-size);border-radius:50%;background:var(--kp-dot)}
.dot.m{top:calc(9px - var(--kp-dot-size)/2);background:var(--kp-bg-page);border:2px solid var(--kp-dot);width:10px;height:10px;left:calc(50% - 5px)}
.ct{flex:1;min-width:0;padding-bottom:var(--kp-gap-card)}
.card{background:var(--kp-surface);border-radius:var(--kp-radius-card);box-shadow:var(--kp-shadow-card);border:1px solid var(--kp-border)}
.head{display:flex;align-items:center;gap:12px;padding:0 var(--kp-pad-card);min-height:64px}
.sico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
.head .n{flex:1;min-width:0}.head b{font-size:var(--kp-fs-section);font-weight:var(--kp-fw-strong)}
.sub{font-size:13px;color:var(--kp-text-sub)}.cau{color:var(--kp-caution-text);font-weight:var(--kp-fw-strong)}
.chev{width:20px;height:20px;flex:none;color:var(--kp-text-sub)}
.items{padding:2px var(--kp-pad-card) var(--kp-pad-card)}
.item{display:flex;gap:12px}.item+.item{margin-top:var(--kp-gap-card)}
.ico{width:44px;height:44px;flex:none;border-radius:14px;background:var(--kp-surface-sub);display:flex;align-items:center;justify-content:center;font-size:22px}
.mn{flex:1;min-width:0}.nm{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.nm b{font-weight:var(--kp-fw-strong);font-size:var(--kp-fs-body);line-height:1.35;word-break:keep-all;overflow-wrap:anywhere}
.nm span{font-size:var(--kp-fs-caption);color:var(--kp-text-sub);white-space:nowrap;padding-top:2px}
.chip{display:inline-block;font-size:var(--kp-fs-caption);font-weight:500;padding:2px 9px;border-radius:999px;background:var(--kp-surface-sub);color:var(--kp-text-sub);margin:6px 6px 0 0}
.chip.new{background:var(--kp-brand-weak);color:var(--kp-brand-strong)}
.flag{display:flex;gap:10px;align-items:flex-start;margin-top:10px;padding:12px;min-height:var(--kp-touch-min);background:var(--kp-caution-bg);color:var(--kp-caution-text);border-radius:calc(var(--kp-radius-chip) + 6px);font-size:14px}
.flag svg{flex:none;margin-top:1px}.flag .b{flex:1;line-height:1.4}.flag b{font-weight:var(--kp-fw-strong)}.flag .nw{display:block;font-size:var(--kp-fs-caption);margin-top:2px}
.bd{display:inline-block;font-size:var(--kp-fs-caption);font-weight:600;padding:1px 6px;border-radius:5px;margin-top:6px}
.bd.l{background:var(--kp-label-bg);color:var(--kp-label-text)}.bd.o{background:var(--kp-official-bg);color:var(--kp-official-text)}
.more{font-size:var(--kp-fs-caption);margin-left:6px;opacity:.9}
.food{font-size:13px;color:var(--kp-text-sub);display:flex;gap:6px;margin-top:8px}.food svg{flex:none;color:var(--kp-info-text);margin-top:1px}
.link{color:var(--kp-info-text);font-weight:var(--kp-fw-strong);font-size:13px;white-space:nowrap}
.sec{margin:8px var(--kp-gap-page) 0;padding:var(--kp-pad-card)}
.sec .tt{font-size:var(--kp-fs-section);font-weight:var(--kp-fw-strong);margin-bottom:12px}
.foot{margin:16px var(--kp-gap-page) 8px;font-size:var(--kp-fs-caption);color:var(--kp-text-sub);line-height:1.6}
.btn{display:flex;align-items:center;justify-content:center;margin:12px var(--kp-gap-page) 16px;height:56px;border-radius:var(--kp-radius-btn);background:var(--kp-cta-bg);color:var(--kp-cta-text);font-weight:var(--kp-fw-strong);font-size:16px}
.tab{display:flex;justify-content:space-around;padding:10px 0 22px;background:var(--kp-surface);border-top:1px solid var(--kp-border);font-size:var(--kp-fs-caption);color:var(--kp-text-sub)}
.tab .on{color:var(--kp-text);font-weight:var(--kp-fw-strong)}
.dimtop{padding-bottom:12px}.scrim{position:absolute;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,.45)}
.sheetb{position:absolute;left:0;right:0;bottom:0;background:var(--kp-surface);border-radius:var(--kp-radius-sheet) var(--kp-radius-sheet) 0 0;padding:10px var(--kp-gap-page) 20px}
.handle{width:40px;height:4px;border-radius:2px;background:var(--kp-border);margin:0 auto 14px}
.sh-top{display:flex;justify-content:space-between;align-items:center}.sh-top b{font-size:var(--kp-fs-section);font-weight:var(--kp-fw-strong)}
.sheetb h2{font-size:20px;font-weight:var(--kp-fw-title);margin:8px 0 12px;line-height:1.35}
.quote{background:var(--kp-surface-sub);border-left:3px solid var(--kp-brand);border-radius:0;padding:12px 14px;font-size:var(--kp-fs-body)}
.quote .w{font-size:var(--kp-fs-caption);color:var(--kp-text-sub);margin-bottom:4px}
.meta{margin-top:12px;font-size:var(--kp-fs-caption);color:var(--kp-text-sub);line-height:1.8}
.legend{display:flex;gap:18px;align-items:center;font-size:12px;color:#555;margin:-8px 0 20px 8px}.legend i{position:relative;display:inline-block;margin-right:6px;vertical-align:middle}
"""

ICON_WARN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
ICON_INFO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
CHEV_UP = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>'
CHEV_DN = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
CHEV_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:1px"><path d="m9 6 6 6-6 6"/></svg>'
ICON_X = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'

def frame(cls, title):
    return f"""
<div class="col"><h3>{html.escape(title)}</h3>
<div class="kp {cls}">
  <div class="status"><span>9:41</span><span>●●●</span></div>
  <div class="top"><div class="d">10월 30일 금요일</div><h1>오늘 복약</h1><div class="s">확인할 주의 <b>4개</b></div></div>
  <div class="tl">
    <div class="row"><div class="time">07:00</div><div class="rail"><i class="node now"></i></div><div class="ct">
      <div class="card"><div class="head"><div class="sico" style="background:#FFF3D6">☀️</div><div class="n"><b>아침약</b><div class="sub">약 3개 · <span class="cau">주의 2</span></div></div>{CHEV_UP}</div>
        <div class="items">
          <div class="item"><div class="ico">💊</div><div class="mn"><div class="nm"><b>씬지록신정50마이크로그램</b><span>07:00</span></div>
            <div class="flag">{ICON_WARN}<div class="b"><b>칼슘 영양제</b> · 최소 4시간 간격 안내<span class="nw">지금 1시간</span><span class="bd l" style="margin-top:6px">설명서 근거</span><span class="more">외 1건</span></div>{CHEV_R}</div></div></div>
          <div class="item"><div class="ico">🌿</div><div class="mn"><div class="nm"><b>칼슘 영양제</b><span>08:00</span></div><span class="chip">영양제</span></div></div>
          <div class="item"><div class="ico">💊</div><div class="mn"><div class="nm"><b>넥시움정20밀리그램</b><span>08:00</span></div><span class="chip new">새 처방</span></div></div>
        </div></div></div></div>
    <div class="row"><div class="time s">12:30</div><div class="rail"><i class="dot m"></i></div><div class="ct" style="padding-bottom:8px"><span class="sub">점심 식사</span></div></div>
    <div class="row"><div class="time">12:30</div><div class="rail"><i class="dot"></i></div><div class="ct">
      <div class="card"><div class="head"><div class="sico" style="background:#E7F1FF">🌤️</div><div class="n"><b>점심약</b><div class="sub">약 2개</div></div>{CHEV_DN}</div></div></div></div>
    <div class="row"><div class="time">21:00</div><div class="rail end"><i class="dot"></i></div><div class="ct">
      <div class="card"><div class="head"><div class="sico" style="background:#ECE9FF">🌙</div><div class="n"><b>자기 전</b><div class="sub">약 2개 · <span class="cau">주의 2</span></div></div>{CHEV_DN}</div></div></div></div>
  </div>
  <div class="card sec"><div class="tt">시간을 정하지 않은 약</div>
    <div class="item"><div class="ico">💊</div><div class="mn"><div class="nm"><b>내가만든약</b><span class="link">시간 정하기</span></div>
      <div class="food">{ICON_INFO}<span>키핑이 확인한 범위 밖이에요. 등록은 됐고, 약사에게 확인해 주세요.</span></div></div></div></div>
  <div class="foot">병용금기(공식 지정)와 설명서에서 찾은 안내만 보여드려요. 찾지 못했다고 안전하다는 뜻은 아니에요. 키핑은 의료 조언이 아니에요.</div>
  <div class="btn">새 약 추가하기</div>
  <div class="tab"><span class="on">홈</span><span>내 약</span><span>마이</span></div>
</div>
<div class="legend {cls}" style="background:none;position:static;border:0"><span><i class="node ok" style="position:relative;display:inline-block;left:0;top:0;width:var(--kp-node-size);height:var(--kp-node-size)"></i>복용함</span><span><i class="node now" style="position:relative;display:inline-block;left:0;top:0;width:var(--kp-node-size);height:var(--kp-node-size)"></i>지금·다음</span><span><i class="dot" style="position:relative;display:inline-block;left:0;top:0"></i>예정</span></div>
<div class="kp {cls}" style="height:780px">
  <div class="status"><span>9:41</span><span>●●●</span></div>
  <div class="top dimtop"><div class="d">10월 30일 금요일</div><h1>오늘 복약</h1></div>
  <div class="card sec" style="min-height:90px"></div>
  <div class="scrim"></div>
  <div class="sheetb">
    <div class="handle"></div>
    <div class="sh-top"><b>근거</b>{ICON_X}</div>
    <div class="sub" style="margin-top:4px">씬지록신정50마이크로그램 · 함께 등록한 것: 칼슘 영양제</div>
    <div style="margin-top:14px"><span class="bd l">설명서 근거</span></div>
    <h2>칼슘 영양제 · 최소 4시간 간격 안내 · 지금 1시간</h2>
    <div class="quote"><div class="w">원문 · 6. 상호작용 (12)</div>칼슘제제, 세벨라머, 란타늄 등의 인산염과 결합하는 약물을 병용투여시 이 약의 흡수가 지연 또는 감소될 수 있으므로 투여간격에 주의하여 신중히 투여한다.(최소 4시간 간격)</div>
    <div class="food" style="margin-top:12px;font-size:14px;color:var(--kp-text)">칼슘 영양제 · 11:00 이후에 드시면 안내된 간격 이상이에요.</div>
    <div class="meta">의약품 허가사항 (식품의약품안전처) &nbsp;<span class="link" style="font-size:12px">원문 보기</span><br>확인일 2026-10-30</div>
    <div class="sub" style="margin-top:12px">이상 증상이 있으면 약사·의사에게 물어보세요.</div>
    <div class="btn" style="margin:16px 0 0">닫기</div>
  </div>
</div></div>"""

def font_face(url):
    return ("@font-face{font-family:'Pretendard Variable';font-weight:45 920;font-style:normal;font-display:swap;"
            "src:url('%s') format('woff2-variations'),url('%s') format('woff2');}\n" % (url, url))

def main():
    strict = '--strict' in sys.argv
    active, rows = parse(open(MD, encoding='utf-8').read())
    if not rows:
        sys.exit('값 표를 찾지 못했습니다: ' + MD)
    A, _ = resolve(rows, 'A', False)
    B, _ = resolve(rows, 'B', False)
    U, mine = resolve(rows, active, True)
    locked_mine = [r['token'] for r in rows if r['mine'] and '🔒' in r['guard']]
    # 앱에 쓰이는 값
    os.makedirs(os.path.dirname(OUT_CSS), exist_ok=True)
    head = '/* 자동 생성: scripts/apply_design.py (docs/design.md의 값). 직접 고치지 마세요. 지금 안: %s%s */\n' % (active, ' + 내 값 %d개' % len(mine) if mine else '')
    open(OUT_CSS, 'w', encoding='utf-8').write(head + font_face('../assets/fonts/PretendardVariable.woff2') + css_block(':root', U))
    # 미리보기
    frames = [('kp-A', 'A · 현재(피그마 토큰 그대로)', A), ('kp-B', 'B · 인아웃 참고(깔끔·친근)', B)]
    if mine: frames.append(('kp-U', '내 값 적용(%s안 + 내 값 %d개)' % (active, len(mine)), U))
    style = ''.join(css_block('.' + c, v) for c, _, v in frames)
    body = ''.join(frame(c, t) for c, t, _ in frames)
    open(OUT_HTML, 'w', encoding='utf-8').write(
        '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>키핑 디자인 미리보기</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css"><style>%s%s%s</style></head><body><h1 class="pg">키핑 디자인 미리보기</h1>'
        '<p class="note">docs/design.md의 값 표를 고치고 <code>python3 scripts/apply_design.py</code>를 다시 실행한 뒤 새로고침하세요. 미리보기는 홈과 근거 시트 두 화면이에요.</p>'
        '<div class="wrap">%s</div></body></html>' % (font_face('assets/fonts/PretendardVariable.woff2'), PREVIEW_CSS, style, body))
    print('지금 안: %s, 내 값: %d개%s' % (active, len(mine), (' (' + ', '.join(mine) + ')') if mine else ''))
    if locked_mine: print('⚠ 🔒 토큰은 내 값을 무시했어요:', ', '.join(locked_mine))
    bad = 0
    for name, vals in (('A', A), ('B', B), ('내 값 적용', U)):
        if name == '내 값 적용' and not mine: continue
        pr = check(rows, vals)
        print('[%s] 접근성 가드: %s' % (name, '모두 통과' if not pr else '%d건 위반' % len(pr)))
        for p in pr: print('   ⚠', p)
        bad += len(pr) if name == '내 값 적용' or (name == 'B' and not mine) or (name == 'A' and False) else 0
    print('→', OUT_CSS, '·', OUT_HTML)
    if strict and bad: sys.exit(1)

if __name__ == '__main__':
    main()
