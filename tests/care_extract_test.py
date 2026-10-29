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
t('철분·알루미늄 제산제·콜레스티라민(5)): 간격 숫자는 없음', any({'iron', 'aluminumAntacid', 'cholestyramine'} <= keys(r) and r['interval'] is None and '(5)' in r['where'] for r in R))
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
t('걸린 키워드가 정답지와 같다(과다·누락 없음)', sorted({k for r in R for k in keys(r)}) == ['aluminumAntacid', 'biotin', 'calcium', 'cholestyramine', 'iron', 'ppi', 'stJohnsWort'], sorted({k for r in R for k in keys(r)}))
t('식사 관계: 실제 허가사항 문장("식사하기 적어도 1시간 전 공복에 복용한다")', any(r['kind'] == 'timing' for r in C.extract_rules('', '<ARTICLE title=""><PARAGRAPH><![CDATA[이 약은 식사하기 적어도 1시간 전 공복에 복용한다.]]></PARAGRAPH></ARTICLE>')))
t('간격 숫자 읽기: "2~3시간 간격", "4시간 이상 간격"', C._interval('2~3시간 간격')['minHours'] == 2 and C._interval('4시간 이상 간격')['minHours'] == 4)

print('오탐 방지 (클로드코드의 20개 성분 시험에서 나온 문제)')
def rules_for(article, *paras):
    xml = '<ARTICLE title="%s">' % article + ''.join('<PARAGRAPH><![CDATA[%s]]></PARAGRAPH>' % p for p in paras) + '</ARTICLE>'
    return C.extract_rules(xml)
# 아래 문장은 정규식 동작을 보려고 만든 시험용 문장이다(실제 허가사항 원문이 아니다)
r1 = rules_for('6. 상호작용', '(1) 수술: 수술과 전신마취 중에는 이 약의 투여를 일시적으로 중지해야 한다.')
t('"수술"의 낱글자 "술"을 알코올로 잡지 않는다', r1 == [], r1)
r2 = rules_for('6. 상호작용', '(2) 음주: 알코올 섭취 시 유산산증의 위험성이 증가된다.')
t('알코올·음주는 계속 잡는다', len(r2) == 1 and r2[0]['matched'][0]['key'] == 'alcohol', r2)
r3 = rules_for('5. 일반적주의', '(1) 비타민 B12 또는 칼슘의 섭취 또는 흡수가 부적절한 환자에서 비타민 B12 감소의 위험이 있다.')
t('일반적 주의의 맨 "칼슘" 언급(생리 설명)은 영양제 상호작용으로 잡지 않는다', r3 == [], r3)
r4 = rules_for('6. 상호작용', '(3) 칼슘제제와 병용투여시 흡수가 감소될 수 있다.')
t('상호작용의 "칼슘제제"는 잡는다', len(r4) == 1 and r4[0]['matched'][0]['key'] == 'calcium', r4)
r5 = rules_for('5. 일반적주의', '(2) 비오틴은 검사 결과에 간섭을 일으킬 수 있다.', '(3) 철분제제를 복용하는 환자는 …')
t('일반적 주의에서도 비오틴은 잡고 철분제제는 잡지 않는다', [m['key'] for r in r5 for m in r['matched']] == ['biotin'], r5)
r6 = rules_for('7. 임부 및 수유부에 대한 투여', '시타글립틴', '(1) 임신 중에는 투여하지 않는다.', '메트포르민염산염', '(1) 임부에 대한 안전성은 확립되지 않았으므로 투여하지 않는다.')
t('소제목 한 줄을 규칙으로 만들지 않고 subject로 남긴다', len(r6) == 2 and [r['subject'] for r in r6] == ['시타글립틴', '메트포르민염산염'], r6)
t('짧아도 문장으로 끝나면 소제목이 아니다', not C._is_heading('이 약을 투여하지 않는다.') and C._is_heading('임부에 대한 투여'))
r7 = rules_for('6. 상호작용', '(1) 다른 산 분비 억제제나 제산제와 마찬가지로 이 약 투여 중에는 케토코나졸의 흡수가 감소될 수 있다.')
t('"…제산제와 마찬가지로"는 같은 부류와의 비교라서 제산제 병용으로 잡지 않는다', 'antacid' not in {m['key'] for r in r7 for m in r['matched']}, r7)
r8 = rules_for('6. 상호작용', '(1) 제산제와 병용투여시 이 약의 흡수가 감소될 수 있다.', '(2) 알루미늄 함유 제산제와 병용투여시 흡수가 지연될 수 있다.')
t('일반 "제산제"와 "알루미늄 함유 제산제"를 구분해서 잡는다', [[m['key'] for m in r['matched']] for r in r8] == [['antacid'], ['aluminumAntacid']], r8)
print('\n%d개 통과' % n)
