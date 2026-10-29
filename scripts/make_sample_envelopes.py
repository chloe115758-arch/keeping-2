#!/usr/bin/env python3
"""
연습용 약봉투 이미지(가상)와 인식 시연용 목록(manifest.json)을 만든다.

- 이미지는 이 스크립트가 그린 가상의 약봉투이고, 실제 처방·환자·약국과 무관하다("홍길동(예시)", "예시약국").
- manifest.json: 샘플 이미지(이름·크기) → 그 이미지에 쓰여 있다고 치는 줄과 위치(0~1 비율), 약 검색어.
  앱은 올린 파일의 이름과 이미지 크기가 목록과 같을 때만 "인식"한다. 실제 글자 인식(OCR)은 하지 않는다.
사용법: python3 scripts/make_sample_envelopes.py
필요:  pip install pillow, 한글 글꼴(Noto Sans CJK KR)
"""
import hashlib, json, os, sys
from PIL import Image, ImageDraw, ImageFont

OUT_IMG = 'assets/ocr-demo'
OUT_JSON = 'data/ocr-demo/manifest.json'
REG = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
KR = 1   # TTC 안의 한국어 글꼴 번호
W, H = 900, 1260
INK, MUTED, LINE, PAPER = (34, 34, 36), (107, 109, 116), (200, 200, 196), (251, 251, 248)

def font(path, size):
    return ImageFont.truetype(path, size, index=KR)

SAMPLES = [
  {'id': 'envelope-1', 'title': '연습용 샘플 1 · 평소 먹던 약', 'date': '2026-10-01',
   'rows': [('씬지로이드정0.075밀리그램', '1정', '1일 1회', '30일', '아침 공복')]},
  {'id': 'envelope-2', 'title': '연습용 샘플 2 · 새로 받은 처방', 'date': '2026-10-29',
   'rows': [('넥시움정20밀리그람', '1정', '1일 1회', '14일', '아침 식전'),
            ('알마겔에프현탁액', '1포', '1일 3회', '7일', '식후')]},
  {'id': 'envelope-3', 'title': '연습용 샘플 3 · 약이 여러 개인 처방', 'date': '2026-10-29',
   'rows': [('시바스정', '1정', '1일 1회', '30일', '저녁'),
            ('메토폴정', '1정', '1일 2회', '30일', '식후'),
            ('무코스타정', '1정', '1일 3회', '14일', '식후')]},
]

def draw_envelope(s):
    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)
    f_t, f_h, f_b, f_s, f_n = font(BOLD, 44), font(BOLD, 28), font(REG, 30), font(REG, 23), font(REG, 27)
    d.rectangle([30, 30, W - 30, H - 30], outline=LINE, width=3)
    d.rectangle([30, 30, W - 30, 150], fill=(238, 240, 236), outline=LINE, width=3)
    d.text((W // 2, 90), '처 방 조 제 약', font=f_t, fill=INK, anchor='mm')
    y = 190
    meta = [('약국', '예시약국   Tel 000-0000-0000'), ('환자', '홍길동(예시)'), ('조제일', s['date']), ('복용 안내', '정해진 시간에 복용하세요')]
    for k, v in meta:
        d.text((70, y), k, font=f_h, fill=MUTED)
        d.text((230, y), v, font=f_b, fill=INK)
        y += 56
    y += 16
    x = [50, 440, 500, 620, 700, 850]   # 열 경계: 약품명 | 1회 | 1일 | 일수 | 용법
    d.rectangle([x[0], y, x[-1], y + 56], fill=(238, 240, 236), outline=LINE, width=2)
    for i, h in enumerate(['약품명', '1회', '1일', '일수', '용법']):
        d.text(((x[i] + x[i + 1]) // 2, y + 28), h, font=f_h, fill=INK, anchor='mm')
    y += 56
    boxes, lines = [], []
    for name, once, daily, days, how in s['rows']:
        d.rectangle([x[0], y, x[-1], y + 96], outline=LINE, width=2)
        for xv in x[1:-1]:
            d.line([xv, y, xv, y + 96], fill=LINE, width=2)
        d.text((x[0] + 14, y + 48), name, font=f_n, fill=INK, anchor='lm')
        for i, t in enumerate([once, daily, days, how], start=1):
            d.text(((x[i] + x[i + 1]) // 2, y + 48), t, font=f_s, fill=INK, anchor='mm')
        # 약품명 칸 전체를 인식 위치로 쓴다 (0~1 비율)
        boxes.append([round(x[0] / W, 4), round(y / H, 4), round((x[1] - x[0]) / W, 4), round(96 / H, 4)])
        lines.append({'text': name, 'dose': {'once': once, 'daily': daily, 'days': days, 'how': how}})
        y += 96
    d.text((W // 2, H - 150), '※ 연습용 샘플이에요. 실제 처방이 아닙니다.', font=f_s, fill=MUTED, anchor='mm')
    d.text((W // 2, H - 108), '키핑 인식 시연 전용 · 이 이미지 파일만 인식됩니다', font=f_s, fill=MUTED, anchor='mm')
    return img, boxes, lines

def main():
    os.makedirs(OUT_IMG, exist_ok=True); os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    manifest = {'_meta': {
        'purpose': '연습용 약봉투 이미지가 올라오면 인식한 것처럼 보여주는 시연 목록. 실제 글자 인식(OCR)은 하지 않는다.',
        'match': '파일 이름(keeping-sample-envelope-N)과 PNG 이미지 크기(폭×높이)가 같을 때만 인식한다. 다른 이미지는 인식하지 않는다. (파일 내용 해시는 쓰지 않는다: 내려받는 과정에서 파일에 메타데이터가 덧붙을 수 있다)',
        'fictional': '환자·약국은 가상이다(홍길동(예시), 예시약국).',
        'generatedBy': 'scripts/make_sample_envelopes.py'}, 'samples': []}
    for s in SAMPLES:
        img, boxes, lines = draw_envelope(s)
        fn = 'keeping-sample-%s.png' % s['id']
        path = os.path.join(OUT_IMG, fn)
        img.save(path, optimize=True)
        manifest['samples'].append({
            'id': s['id'], 'title': s['title'], 'file': 'assets/ocr-demo/' + fn, 'fileName': fn, 'width': W, 'height': H,
            'items': [{'ocrText': l['text'], 'query': l['text'], 'box': b, 'dose': l['dose']} for l, b in zip(lines, boxes)]})
        print(fn, len(boxes), '줄')
    json.dump(manifest, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
