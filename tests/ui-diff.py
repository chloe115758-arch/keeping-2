#!/usr/bin/env python3
"""
시안 이미지와 앱 스크린샷을 겹쳐서 "어디가 얼마나 다른지" 숫자로 보여 주는 도구.
  python3 tests/ui-diff.py --ref docs/design-ref/onboarding/02-welcome.png --app docs/screenshots/ob-02-welcome.png --out docs/screenshots/diff-02.png
둘 다 402×874(1배)여야 한다(앱은 Playwright viewport 402×874, device_scale_factor 1로 찍는다).
시안 맨 위 50px(상태 표시줄)와 맨 아래 40px(홈 막대)는 기기 껍데기라 비교에서 뺀다.
출력: 일치율, 가장 다른 가로 띠 5개(위치와 차이), 그리고 [시안 | 앱 | 차이] 세 장을 나란히 붙인 이미지.
일치율 기준(권장): 97% 이상이면 "시안 그대로", 93~97%는 글자 렌더링 차이일 수 있으니 차이 이미지를 눈으로 본다.
"""
import argparse, sys
from PIL import Image
import numpy as np

TOP, BOTTOM = 50, 40

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', required=True); ap.add_argument('--app', required=True); ap.add_argument('--out', default='')
    ap.add_argument('--tol', type=int, default=24, help='한 점의 색 차이가 이 값을 넘으면 "다르다"')
    a = ap.parse_args()
    r = Image.open(a.ref).convert('RGB'); p = Image.open(a.app).convert('RGB')
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
    if a.out:
        vis = np.asarray(p).copy(); vis[diff] = [235, 40, 70]
        canvas = Image.new('RGB', (r.width * 3 + 20, r.height), (200, 200, 200))
        canvas.paste(r, (0, 0)); canvas.paste(p, (r.width + 10, 0)); canvas.paste(Image.fromarray(vis.astype('uint8')), (r.width * 2 + 20, 0))
        canvas.save(a.out); print('저장:', a.out)
    sys.exit(0 if bad / total < 0.03 else 1)

if __name__ == '__main__':
    main()
