#!/usr/bin/env python3
"""실행: python3 tests/care_extract_test.py — 허가사항 자동 추출 점검 (정답지: 레보티록신 6개 규칙)"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
import care_extract as C

H = os.path.join(os.path.dirname(__file__), 'fixtures')
NB = open(os.path.join(H, 'levothyroxine_nb.xml'), encoding='utf-8').read()
UD = open(os.path.join(H, 'levothyroxine_ud.xml'), encoding='utf-8').read()
R = C.extract_rules(NB, UD, '201605340')
n = 0
def t(name, cond, detail=''):
    global n
    if cond: n += 1; print('  ok  ' + name)
    else: print('FAIL  ' + name + ' ' + str(detail)); sys.exit(1)
def keys(r): return {m['key'] for m in r['matched']}
def find(k): return [r for r in R if k in keys(r)]

print('문서 읽기')
arts = C.parse_doc(NB)
t('항목 제목을 읽는다', [a[0] for a in arts][:3] == ['1. 경고', '5. 일반적주의', '6. 상호작용'], [a[0] for a in arts])
t('상호작용 단락 수', len(dict(arts)['6. 상호작용']) == 9, len(dict(arts)['6. 상호작용']))
t('&nbsp;·태그가 정리된다', all('&nbsp;' not in p for _, ps in arts for p in ps))

print('정답지: 레보티록신')
cal = [r for r in find('calcium') if r['interval']]
t('칼슘 + 최소 4시간 간격(상호작용 (12))', len(cal) == 1 and cal[0]['interval']['minHours'] == 4 and cal[0]['interval']['qualifier'] == '최소' and '(12)' in cal[0]['where'], cal)
t('철분·알루미늄 제산제·콜레스티라민(5)): 간격 숫자는 없음', any({'iron', 'antacid', 'cholestyramine'} <= keys(r) and r['interval'] is None and '(5)' in r['where'] for r in R))
t('PPI((16))', any('ppi' in keys(r) and '(16)' in r['where'] for r in R))
t('세인트존스워트((15))', any('stJohnsWort' in keys(r) and '(15)' in r['where'] for r in R))
t('비오틴: 일반적 주의 7)과 상호작용 14)', {'5. 일반적주의 (7)', '6. 상호작용 (14)'} <= {r['where'] for r in find('biotin')}, [r['where'] for r in find('biotin')])
t('임신: "치료를 중단하지 않는다"가 원문 그대로 나온다', any(r['kind'] == 'state_pregnancy' and '임신 중에도 치료를 중단하지 않는다' in r['excerpt'] for r in R))
t('고령자 항목', any(r['kind'] == 'state_elderly' for r in R))
t('식사 문구가 없는 용법은 timing 규칙이 없다(추측하지 않는다)', not any(r['kind'] == 'timing' for r in R))

print('안전장치')
t('모든 규칙에 원문·위치·추출기 이름이 있다', all(r['excerpt'] and r['where'] and r['extractor'] for r in R))
SRC = ' '.join(p for _, ps in arts + C.parse_doc(UD) for p in ps)
t('문장을 만들지 않는다: 모든 excerpt가 원문에 그대로 들어 있다(길면 …로 줄임)', all(r['excerpt'].rstrip('…') in SRC for r in R), [r['where'] for r in R if r['excerpt'].rstrip('…') not in SRC])
bad = '1) 칼슘채널차단제와 병용투여시 혈압이 떨어질 수 있다. 2) 스테아르산마그네슘을 첨가제로 함유한다.'
nb = '<ARTICLE title="6. 상호작용"><PARAGRAPH><![CDATA[%s]]></PARAGRAPH></ARTICLE>' % bad
t('칼슘채널차단제는 칼슘으로, 스테아르산마그네슘은 마그네슘으로 매칭하지 않는다', C.extract_rules(nb) == [], C.extract_rules(nb))
t('"비타민K의존성 응고인자"를 비타민 K 영양제로 매칭하지 않는다(오탐 방지)', not any('vitaminK' in keys(r) for r in R), [r['where'] for r in find('vitaminK')])
t('걸린 키워드가 정답지와 같다(과다·누락 없음)', sorted({k for r in R for k in keys(r)}) == ['antacid', 'biotin', 'calcium', 'cholestyramine', 'iron', 'ppi', 'stJohnsWort'], sorted({k for r in R for k in keys(r)}))
t('식사 관계: 실제 허가사항 문장("식사하기 적어도 1시간 전 공복에 복용한다")', any(r['kind'] == 'timing' for r in C.extract_rules('', '<ARTICLE title=""><PARAGRAPH><![CDATA[이 약은 식사하기 적어도 1시간 전 공복에 복용한다.]]></PARAGRAPH></ARTICLE>')))
t('간격 숫자 읽기: "2~3시간 간격", "4시간 이상 간격"', C._interval('2~3시간 간격')['minHours'] == 2 and C._interval('4시간 이상 간격')['minHours'] == 4)
print('\n%d개 통과' % n)
