/*
 * 키핑 데이터 팩 (2026-10-28 확인)
 *
 * 이 파일의 값은 모두 공식 화면·API 응답에서 직접 확인한 것만 담았습니다.
 * - 의약품 제품 허가정보 API (식약처, 공공데이터포털)
 * - DUR 병용금기 · 효능군중복 · 품목정보 API (식약처)
 * - 의약품안전나라 의약품 상세 화면 (사용상의 주의사항)
 * - 식품안전나라 건강기능식품 품목제조신고(원재료) API
 * - 건강기능식품 종합정보 서비스 > 의약품 병용섭취정보 (원료 33종 목록)
 *
 * 팩 밖의 약·영양제도 등록은 되지만 "확인 못 함"으로 표시합니다.
 * 값을 추가할 때는 반드시 source / 확인일을 남기세요. 추측으로 채우지 마세요.
 */
window.KEEPING_DATA = {
  version: '2026-10-28',
  checkedAt: '2026-10-28',

  sources: {
    nedrug: 'https://nedrug.mfds.go.kr/searchDrug',
    hid: 'https://data.mfds.go.kr/hid/main/main.do',
    dur: 'https://www.data.go.kr/data/15059486/openapi.do',
    permit: 'https://www.data.go.kr/data/15095677/openapi.do',
    foodsafety: 'https://www.foodsafetykorea.go.kr',
    dsld: 'https://dsld.od.nih.gov'
  },

  /* ---------- 약 (의약품 제품 허가정보 + DUR) ---------- */
  drugs: [
    {
      itemSeq: '198801649', name: '후로스판정', display: '후로스판정',
      nameFull: '후로스판정(플로로글루시놀)', company: '대화제약(주)',
      category: '전문의약품', type: '진경제',
      ingredientEn: 'Phloroglucinol', ingredientKo: '플로로글루시놀', ingrCode: null,
      dur: { usjntTaboo: 0, efcyDplct: 0, itemTypes: [] }
    },
    {
      itemSeq: '199501749', name: '브로목틸정', display: '브로목틸정 20mg',
      nameFull: '브로목틸정20밀리그램(옥틸로늄브롬화물)', company: '(주)테라젠이텍스',
      category: '전문의약품', type: '자율신경제',
      ingredientEn: 'Octylonium Bromide', ingredientKo: '옥틸로늄브롬화물', ingrCode: null,
      dur: { usjntTaboo: 0, efcyDplct: 0, itemTypes: ['첨가제주의'] }
    },
    {
      itemSeq: '201400771', name: '브로목틸정', display: '브로목틸정 40mg',
      nameFull: '브로목틸정40mg(옥틸로늄브롬화물)', company: '(주)테라젠이텍스',
      category: null, type: null,
      ingredientEn: null, ingredientKo: '옥틸로늄브롬화물', ingrCode: null,
      partial: true,
      dur: null
    },
    {
      itemSeq: '200402420', name: '이텍스시메티딘정', display: '이텍스시메티딘정',
      nameFull: '이텍스시메티딘정(시메티딘)', company: '(주)테라젠이텍스',
      category: '전문의약품', type: '소화성궤양용제',
      ingredientEn: 'Cimetidine', ingredientKo: '시메티딘', ingrCode: 'D000140',
      series: 'H2 수용체 길항제',
      dur: { usjntTaboo: 0, efcyDplct: 1, itemTypes: ['용량주의', '첨가제주의'] }
    },
    {
      itemSeq: '199000541', name: '알마겔에프현탁액', display: '알마겔에프현탁액',
      nameFull: '알마겔에프현탁액(알마게이트)(수출명:유만겔에프현탁액)', company: '(주)유한양행',
      category: '일반의약품', type: '제산제',
      ingredientEn: 'Almagate', ingredientKo: '알마게이트', ingrCode: null,
      dur: { usjntTaboo: 0, efcyDplct: 0, itemTypes: [] }
    },
    {
      itemSeq: '200000913', name: '코니트라캡슐', display: '코니트라캡슐',
      nameFull: '코니트라캡슐(이트라코나졸)(수출용)', company: '코오롱제약(주)',
      category: '전문의약품', type: '기타의 화학요법제',
      ingredientEn: 'Itraconazole', ingredientKo: '이트라코나졸', ingrCode: 'D000762',
      note: '허가정보에 수출용으로 표기된 제품입니다. 데이터 확인용 예시로만 사용했습니다.',
      dur: null
    },
    {
      itemSeq: '200403126', name: '시바스정', display: '시바스정',
      nameFull: '시바스정(심바스타틴)', company: '(주)휴온스',
      category: '전문의약품', type: '동맥경화용제',
      ingredientEn: 'Simvastatin', ingredientKo: '심바스타틴', ingrCode: 'D000027',
      dur: { usjntTaboo: 275, efcyDplct: null, itemTypes: ['임부금기', '첨가제주의'] }
    }
  ],

  /* ---------- DUR 병용금기 쌍 (성분 코드 기준) ---------- */
  pairs: [
    {
      a: 'D000762', b: 'D000027',
      nameA: '이트라코나졸', nameB: '심바스타틴',
      reason: '횡문근융해증', notified: '2009-03-03',
      durSeq: [19, 20],
      source: '식약처 DUR 병용금기 API', checkedAt: '2026-10-28'
    }
  ],

  /* ---------- 설명서(사용상의 주의사항)에서 확인한 문구 ---------- */
  labels: {
    '200402420': {
      url: 'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetailCache?cacheSeq=200402420aupdateTs2026-09-28%2014:58:05.0b',
      mentionSection: '사용상의 주의사항 6. 상호작용',
      mentionExcerpt: '…병용할 경우 … 신중하게 투여한다.',
      mentionNames: [
        '와르파린', '미다졸람', '디아제팜', '클로르디아제폭시드', '프로프라놀롤', '메토프롤롤',
        '테오필린', '페니토인', '리도카인', '퀴니딘', '니페디핀', '딜티아젬', '이미프라민',
        '프로카인아미드', '메트로니다졸', '에리트로마이신', '시클로스포린', '타크롤리무스',
        '메트포르민', '도페틸라이드', '글리피지드', '아타자나비어',
        '케토코나졸', '이트라코나졸', '포사코나졸',
        '카르무스틴', '플루오로우라실', '에피루비신', '모르핀'
      ],
      classRules: [],
      checkedAt: '2026-10-28'
    },
    '199000541': {
      url: 'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetailCache?cacheSeq=199000541aupdateTs2026-10-22%2010:10:11.093244b',
      mentionNames: [],
      interval: {
        minH: 2, maxH: 3,
        excerpt: '…2 ~ 3 시간 간격을 두고 복용한다.',
        section: '사용상의 주의사항 3. 상의할 것 · 다른 약물을 복용하고 있는 사람'
      },
      classRules: [
        {
          phrase: '궤양 치료제',
          drugTypes: ['소화성궤양용제'],
          sectionTitle: '사용상의 주의사항 3. 상의할 것',
          excerpt: '…궤양 치료제 … 흡수를 감소시킬 수 있으므로 2 ~ 3 시간 간격을 두고 복용한다.'
        },
        {
          phrase: '철(Fe)염 제제',
          suppKeys: ['iron'],
          sectionTitle: '사용상의 주의사항 3. 상의할 것',
          excerpt: '…철(Fe)염 제제 : 흡수를 감소시킬 수 있으므로 2 ~ 3 시간 간격을 두고 복용한다.'
        }
      ],
      checkedAt: '2026-10-28'
    }
  },

  /* ---------- 영양제 (식품안전나라 품목제조신고 원재료 API) ---------- */
  supplements: [
    {
      reportNo: '202400191526',
      name: '메가도스C 비타민C 3000mg', company: '고려은단헬스케어(주)',
      reportedAt: '2025-08-27', ingredientRaw: '비타민C', ingredientKeys: ['vitaminC'],
      intake: '1일 1회, 1회 1포(3 g)를 식사 후 물과 함께 섭취하십시오.',
      functionality: '[비타민C] ①결합조직 형성과 기능유지에 필요 ②철의 흡수에 필요 ③항산화 작용을 하여 유해산소로부터 세포를 보호하는데 필요',
      cautions: '과량 섭취하지 않도록 주의하십시오. 신장질환이 있는 경우 섭취 전 전문가와 상담하십시오. 이상사례 발생 시 섭취를 중단하고 전문가와 상담하십시오.'
    },
    {
      reportNo: '201600060051',
      name: '메가도스C 비타민C 3000mg', company: '고려은단 헬스케어(주)',
      reportedAt: '2016-03-03', ingredientRaw: '비타민C(고시형)', ingredientKeys: ['vitaminC'],
      intake: '1일 1회, 1회 1포를 충분한 물과 함께 섭취한다.',
      functionality: '①결합조직 형성과 기능유지에 필요②철의 흡수에 필요③항산화 작용을 하여 유해산소로부터 세포를 보호하는데 필요',
      cautions: '(1) 임산부와 수유기 여성은 섭취 시 전문가와 상담하시기 바랍니다. (2) 공복에 섭취 시 위장장애로 설사를 유발 할 수 있으니 음식물과 함께 섭취하거나 식후에 섭취하십시오. (3) 알레르기 체질이신 경우 성분을 확인 후 섭취하십시오. (4) 제품의 변질 및 변색된 경우에는 섭취하지 마시고 소비자상담실로 문의 하시기 바랍니다.'
    }
  ],

  /* ---------- 영양제 성분 사전 (officialScope = 식약처 의약품 병용섭취정보 33종) ---------- */
  supplementKeyList: [
    { id: 'vitaminC', ko: '비타민 C', scope: false, aliases: ['비타민C', '비타민 C', '비타민C(고시형)', '아스코르브산', 'ascorbic acid', 'vitamin c'] },
    { id: 'vitaminD', ko: '비타민 D', scope: false, aliases: ['비타민D', '비타민 D', '비타민D3', '콜레칼시페롤', 'cholecalciferol', 'vitamin d', 'vitamin d3'] },
    { id: 'iron', ko: '철분', scope: false, aliases: ['철분', '철', '철염', '철(Fe)염', 'Fe', 'iron', '황산제일철', '푸마르산제일철'] },
    { id: 'calcium', ko: '칼슘', scope: false, aliases: ['칼슘', 'calcium', '탄산칼슘'] },
    { id: 'magnesium', ko: '마그네슘', scope: false, aliases: ['마그네슘', 'magnesium', '산화마그네슘'] },
    { id: 'inositol', ko: '이노시톨', scope: false, aliases: ['이노시톨', 'inositol', 'myo-inositol', '미오이노시톨'] },
    { id: 'zinc', ko: '아연', scope: false, aliases: ['아연', 'zinc'] },

    { id: 'ginseng', ko: '인삼', scope: true, aliases: ['인삼', 'ginseng'] },
    { id: 'probiotics', ko: '프로바이오틱스', scope: true, aliases: ['프로바이오틱스', '유산균', 'probiotics'] },
    { id: 'aloe', ko: '알로에', scope: true, aliases: ['알로에', 'aloe'] },
    { id: 'omega3', ko: '오메가-3 (EPA 및 DHA)', scope: true, aliases: ['EPA 및 DHA 함유 유지', '오메가3', '오메가-3', 'epa', 'dha', 'omega3', 'omega-3', 'fish oil', '피쉬오일'] },
    { id: 'milkthistle', ko: '밀크씨슬', scope: true, aliases: ['밀크씨슬', '카르두스 마리아누스', 'milk thistle', 'silymarin'] },
    { id: 'gla', ko: '감마리놀렌산 함유 유지', scope: true, aliases: ['감마리놀렌산', '감마리놀렌산 함유 유지'] },
    { id: 'angelica', ko: '당귀', scope: true, aliases: ['당귀'] },
    { id: 'mate', ko: '마테', scope: true, aliases: ['마테'] },
    { id: 'dolwae', ko: '돌외잎', scope: true, aliases: ['돌외잎'] },
    { id: 'soy', ko: '대두', scope: true, aliases: ['대두'] },
    { id: 'lcarnitine', ko: 'L-카르니틴', scope: true, aliases: ['L-카르니틴', '카르니틴', 'l-carnitine'] },
    { id: 'greentea', ko: '녹차', scope: true, aliases: ['녹차', 'green tea'] },
    { id: 'chitosan', ko: '키토산/키토올리고당', scope: true, aliases: ['키토산', '키토올리고당'] },
    { id: 'spirulina', ko: '스피루리나', scope: true, aliases: ['스피루리나', 'spirulina'] },
    { id: 'glucosamine', ko: '글루코사민', scope: true, aliases: ['글루코사민', 'glucosamine'] },
    { id: 'pomegranate', ko: '석류', scope: true, aliases: ['석류'] },
    { id: 'eleuthero', ko: '가시오가피', scope: true, aliases: ['가시오가피'] },
    { id: 'africanmango', ko: '아프리카 망고', scope: true, aliases: ['아프리카 망고'] },
    { id: 'chlorella', ko: '클로렐라', scope: true, aliases: ['클로렐라', 'chlorella'] },
    { id: 'cla', ko: '공액리놀레산', scope: true, aliases: ['공액리놀레산', 'cla'] },
    { id: 'coq10', ko: '코엔자임 Q10', scope: true, aliases: ['코엔자임 Q10', '코엔자임Q10', 'coq10', 'coenzyme q10', '유비퀴논'] },
    { id: 'ginkgo', ko: '은행잎', scope: true, aliases: ['은행', '은행잎', '징코', 'ginkgo'] },
    { id: 'sawpalmetto', ko: '쏘팔메토', scope: true, aliases: ['쏘팔메토', 'saw palmetto'] },
    { id: 'ps', ko: '포스파티딜세린', scope: true, aliases: ['포스파티딜세린'] },
    { id: 'cranberry', ko: '크랜베리', scope: true, aliases: ['크랜베리', 'cranberry'] },
    { id: 'licorice', ko: '감초', scope: true, aliases: ['감초'] },
    { id: 'curcumin', ko: '울금 (커큐민)', scope: true, aliases: ['울금', '커큐민', 'curcumin', 'turmeric'] },
    { id: 'garlic', ko: '마늘', scope: true, aliases: ['마늘', 'garlic'] },
    { id: 'schisandra', ko: '오미자', scope: true, aliases: ['오미자'] },
    { id: 'fenugreek', ko: '호로파 종자', scope: true, aliases: ['호로파 종자', '호로파'] },
    { id: 'rhubarb', ko: '루바브뿌리', scope: true, aliases: ['루바브뿌리'] },
    { id: 'glucosaminechondroitin', ko: '글루코사민-콘드로이친', scope: true, aliases: ['글루코사민-콘드로이친'] },
    { id: 'honeysuckle', ko: '인동덩굴', scope: true, aliases: ['인동덩굴'] }
  ],

  /* 직접 입력 화면에서 고를 수 있는 성분 칩 (id 순서) */
  chipKeys: ['iron', 'calcium', 'magnesium', 'vitaminC', 'vitaminD', 'omega3', 'inositol', 'probiotics', 'ginseng', 'milkthistle', 'ginkgo', 'coq10']
};
