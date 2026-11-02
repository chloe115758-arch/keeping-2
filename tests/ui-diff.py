#!/usr/bin/env python3
"""
시안 이미지와 앱 스크린샷을 겹쳐서 "어디가 얼마나 다른지" 숫자로 보여 주는 도구.
  python3 tests/ui-diff.py --ref docs/design-ref/onboarding/02-welcome.png --app docs/screenshots/ob-02-welcome.png --out docs/screenshots/diff-02.png
둘 다 402×874(1배)여야 한다(앱은 Playwright viewport 402×874, device_scale_factor 1로 찍는다).
시안 맨 위 50px(상태 표시줄)와 맨 아래 40px(홈 막대)는 기기 껍데기라 비교에서 뺀다.
출력: 일치율, 가장 다른 가로 띠 5개(위치와 차이), "글자·요소 크기와 위치" 어긋남(띠 비교), 그리고 [시안 | 앱 | 차이] 세 장을 나란히 붙인 이미지.
※ 일치율은 글자가 차지하는 면적이 작아서 글자 크기가 틀려도 97%대로 나올 수 있다. 그래서 띠 비교(글자 줄·버튼마다 위치·폭·높이를 시안과 재서 표로)를 같이 본다.
합격 기준: 일치율 97% 이상이고 띠 비교에서 어긋난 곳이 없을 것(종료 코드 0). 일치율만 높고 띠가 어긋나면 글자 크기나 위치가 틀린 것이다. 시안 파일끼리 어긋난 곳(시안 자체의 차이)은 보고에 적는다.
"""
import argparse, sys
from PIL import Image
import numpy as np
from collections import Counter

TOP, BOTTOM = 50, 40

def bands(img, thr=18, gap=2):
    """가로로 이어진 '무언가 그려진 줄'(글자 한 줄, 버튼, 입력칸…)을 y 순서로 찾아 [(y0,y1,x0,x1)]로 돌려 준다."""
    a = np.asarray(img).astype(int); h, w, _ = a.shape
    sub = a[TOP:h - BOTTOM]
    flat = sub[::3, ::3].reshape(-1, 3)
    bg = Counter(map(tuple, flat)).most_common(1)[0][0]
    ink = np.abs(sub - np.array(bg)).max(axis=2) > thr
    out, cur = [], None
    for i in range(ink.shape[0]):
        xs = np.where(ink[i])[0]
        if len(xs):
            y = i + TOP
            if cur and y - cur[1] <= gap: cur = [cur[0], y, min(cur[2], xs.min()), max(cur[3], xs.max())]
            else:
                if cur: out.append(tuple(cur))
                cur = [y, y, xs.min(), xs.max()]
    if cur: out.append(tuple(cur))
    return [b for b in out if b[3] - b[2] >= 6]

def compare_bands(ref, app):
    R, A = bands(ref), bands(app)
    rows = []
    for r in R:
        best, ov = None, 0
        for a in A:
            o = min(r[1], a[1]) - max(r[0], a[0])
            if o > ov: best, ov = a, o
        if best is None:
            rows.append((r, None)); continue
        rows.append((r, best))
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', required=True); ap.add_argument('--app', required=True); ap.add_argument('--out', default='')
    ap.add_argument('--tol', type=int, default=24, help='한 점의 색 차이가 이 값을 넘으면 "다르다"')
    a = ap.parse_args()
    r = Image.open(a.ref).convert('RGB'); p = Image.open(a.app).convert('RGB'); r_img, p_img = r, p
    if r.size != p.size:
        sys.exit('크기가 달라요: 시안 %s, 앱 %s (둘 다 402×874, 1배로 맞춰 주세요)' % (r.size, p.size))
    R, P = np.asarray(r).astype(int), np.asarray(p).astype(int)
    d = np.abs(R - P).max(axis=2); h = d.shape[0]
    mask = np.zeros_like(d, dtype=bool); mask[TOP:h - BOTTOM, :] = True
    diff = (d > a.tol) & mask
    total = mask.sum(); bad = diff.sum()
    print('일치율 %.2f%%  (다른 점 %d / %d)' % (100 * (1 - bad / total), bad, total))
    bands = []
    for y in range(TOP, h - BOTTOM, 25):
        seg = diff[y:y + 25, :]; n = seg.sum()
        if n:
            xs = np.where(seg.any(axis=0))[0]
            bands.append((n, y, min(y + 24, h - BOTTOM - 1), int(xs.min()), int(xs.max())))
    for n, y0, y1, x0, x1 in sorted(bands, reverse=True)[:5]:
        print('  가장 다른 곳: y %d~%d, x %d~%d, 다른 점 %d' % (y0, y1, x0, x1, n))
    if not bands: print('  다른 곳이 없어요')
    flagged = 0
    print('글자·요소 띠 비교 (시안 → 앱, 어긋남이 큰 것만):')
    for r, b in compare_bands(r_img, p_img):
        if b is None:
            print('  ✗ 시안에만 있음 y %d~%d x %d~%d' % r); flagged += 1; continue
        dy, dh, dx, dw = b[0] - r[0], (b[1] - b[0]) - (r[1] - r[0]), b[2] - r[2], (b[3] - b[2]) - (r[3] - r[2])
        if abs(dy) > 2 or abs(dh) > 2 or abs(dx) > 2 or abs(dw) > 3:
            flagged += 1
            print('  ✗ 시안 y %d~%d x %d~%d → 위치 y %+d, x %+d / 높이 %+d, 폭 %+d' % (r[0], r[1], r[2], r[3], dy, dx, dh, dw))
    print('  어긋난 띠 %d곳' % flagged if flagged else '  띠 위치·크기 모두 시안과 같아요(±2px)')
    if a.out:
        vis = np.asarray(p).copy(); vis[diff] = [235, 40, 70]
        canvas = Image.new('RGB', (r_img.width * 3 + 20, r_img.height), (200, 200, 200))   # r은 위 띠 비교 반복문에서 덮어써져서 r_img를 쓴다
        canvas.paste(r_img, (0, 0)); canvas.paste(p, (r_img.width + 10, 0)); canvas.paste(Image.fromarray(vis.astype('uint8')), (r_img.width * 2 + 20, 0))
        canvas.save(a.out); print('저장:', a.out)
    sys.exit(0 if (bad / total < 0.03 and flagged == 0) else 1)   # 일치율이 높아도 글자·요소 띠가 어긋나면 실패

if __name__ == '__main__':
    main()
