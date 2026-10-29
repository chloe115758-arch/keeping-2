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
r9 = rules_for('5. 일반적주의', '(1) 매일 세 잔 이상 정기적으로 술을 마시는 사람이 이 약이나 다른 해열진통제를 복용할 때는 주의한다.')
t('"술을 마시는 사람"(낱말 술)은 알코올로 잡는다', len(r9) == 1 and r9[0]['matched'][0]['key'] == 'alcohol', r9)
r10 = rules_for('6. 상호작용', '(1) 수술 전후와 기술적 문제로 투여를 중지한다. 마취기술도 포함한다.')
t('"수술", "기술"처럼 다른 낱말 속의 "술"은 알코올로 잡지 않는다', r10 == [], r10)
print('의약품 첨부문서(소비자용) 형식 — almagate가 규칙 0개였던 원인')
# 앞부분은 almagate(알마인정) 허가사항 화면에서 읽은 문장이고, 잘려 보이지 않던 뒤쪽 "…간격을 두고 복용할 것."은 시험을 위해 내가 이어 붙인 것이다
OTC = ('<DOC><SECTION>'
  '<ARTICLE title="1. 다음과 같은 사람은 이 약을 복용하지 말 것."><PARAGRAPH><![CDATA[(1) 임신 3개월 이내의 임부]]></PARAGRAPH></ARTICLE>'
  '<ARTICLE title="2. 이 약을 복용하는 동안 다음의 약을 복용하지 말 것."><PARAGRAPH><![CDATA[다른 제산제]]></PARAGRAPH></ARTICLE>'
  '<ARTICLE title="3. 다음과 같은 사람은 이 약을 복용하기 전에 의사, 치과의사, 약사와 상의할 것.">'
  '<PARAGRAPH><![CDATA[(1) 비스테로이드소염진통제(NSAID), 궤양 치료제, 디기탈리스 제제, 클로르프로마진, 란소프라졸, 프레드니솔론, 페니실린, 퀴놀론, 철(Fe)염 제제 : 흡수를 감소시킬 수 있으므로 2~3시간 간격을 두고 복용할 것.]]></PARAGRAPH>'
  '<PARAGRAPH><![CDATA[(2) 알코올 중독 환자]]></PARAGRAPH></ARTICLE>'
  '</SECTION></DOC>')
RO = C.extract_rules(OTC, None, 'otc')
inter = [r for r in RO if r['kind'] == 'interaction' and r['where'].startswith('3.')]
t('"상의할 것" 항목의 약 이름 나열 문장에서 철(Fe)염·란소프라졸과 2~3시간 간격을 읽는다', len(inter) == 1 and {'iron', 'ppi'} <= {m['key'] for m in inter[0]['matched']} and inter[0]['interval']['minHours'] == 2 and inter[0]['interval']['maxHours'] == 3, inter)
t('"복용하는 동안 … 복용하지 말 것" 항목은 상호작용으로 읽는다(다른 제산제)', any(r['kind'] == 'interaction' and 'antacid' in {m['key'] for m in r['matched']} for r in RO), RO)
t('전용 임부 항목이 없는 문서는 "복용하지 말 것" 항목에서 임신 문장을 찾고 tone이 avoid다', any(r['kind'] == 'state_pregnancy' and r['tone'] == 'avoid' and '임신 3개월' in r['excerpt'] for r in RO), RO)
t('"알코올 중독 환자"는 알코올 음식 안내로 잡지 않는다', not any('alcohol' in {m['key'] for m in r['matched']} for r in RO), RO)
t('전용 임부 항목이 있는 문서(레보티록신)는 첨부문서 방식으로 임신 규칙이 더 생기지 않는다', len([r for r in R if r['kind'] == 'state_pregnancy']) == 2, [r['where'] for r in R if r['kind'] == 'state_pregnancy'])
t('규칙 id가 중복되지 않는다', len({r['id'] for r in RO}) == len(RO))
print('간격 문장의 의미 구분 (clopidogrel 사례)')
for txt, lo, hi in [('2~3시간 간격', 2, 3), ('2∼3시간 간격', 2, 3), ('2～3시간 간격', 2, 3), ('2-3시간의 간격', 2, 3), ('2 ~ 3 시간 간격', 2, 3), ('최소 4시간 간격', 4, None), ('3시간 이상 간격', 3, None)]:
    iv = C._interval(txt)
    t('간격 읽기: "%s"' % txt, iv and iv['minHours'] == lo and iv['maxHours'] == hi, iv)
CLOPI = '오메프라졸 1일 1회 80 mg을 동시 또는 12시간 간격으로 이 약과 투여하였을 때 활성 대사체 45 %(부하용량) 그리고 …'
t('연구 결과 설명 문장(clopidogrel)의 12시간 간격은 안내가 아니다(actionable=false)', C._interval(CLOPI)['actionable'] is False, C._interval(CLOPI))
for txt in ['철제제는 적어도 2-3시간의 간격을 두고 복용한다.', '제산제와의 복용은 4시간 간격을 둔다.', '가능하면 2시간 이상의 간격을 두고 복용한다.', '부득이 함께 복용할 경우에 3시간 이상 간격을 둔다.', '투여간격에 주의하여 신중히 투여한다.(최소 4시간 간격)']:
    t('안내 문장은 actionable=true: ' + txt[:20], C._interval(txt)['actionable'] is True, C._interval(txt))
print('첨부문서 형식의 음식 안내')
r11 = C.extract_rules('<ARTICLE title="3. 다음과 같은 사람은 이 약을 복용하기 전에 의사, 치과의사, 약사와 상의할 것."><PARAGRAPH><![CDATA[(1) 매일 세 잔 이상 정기적으로 술을 마시는 사람]]></PARAGRAPH><PARAGRAPH><![CDATA[(2) 알코올 중독 환자]]></PARAGRAPH><PARAGRAPH><![CDATA[(3) 자몽주스와 함께 복용하는 사람]]></PARAGRAPH></ARTICLE>')
t('"술을 마시는 사람"과 "자몽주스"는 잡고 "알코올 중독 환자"는 잡지 않는다', sorted(m['key'] for r in r11 for m in r['matched']) == ['alcohol', 'grapefruit'] and len(r11) == 2, r11)
print('\n%d개 통과' % n)
