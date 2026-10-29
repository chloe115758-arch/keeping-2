/*
 * 서버 중계: 식약처 의약품 제품 허가정보 API (공공데이터포털)
 *
 * ⚠ 미검증 초안입니다. 아래 두 값은 공공데이터포털 "활용신청 상세기능정보"와 활용 가이드에서
 *   직접 확인해 환경변수로 넣어야 합니다. (추측으로 채우지 않았습니다)
 *     DRUG_LIST_OP    : 목록 조회 기능 이름 (예: 포털 표의 "의약품 제품 허가 목록" 아래 /get… 값)
 *     DRUG_NAME_PARAM : 제품명 검색 파라미터 이름 (활용 가이드의 요청 변수)
 * 인증키는 환경변수 DATA_GO_KR_KEY(Decoding 키)에만 둡니다.
 */
module.exports = async function handler(req, res) {
  const origin = process.env.ALLOW_ORIGIN;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);

  const name = String((req.query && req.query.name) || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'name이 필요해요' });
  const key = process.env.DATA_GO_KR_KEY, op = process.env.DRUG_LIST_OP, param = process.env.DRUG_NAME_PARAM;
  if (!key || !op || !param) return res.status(500).json({ error: '서버 환경변수(DATA_GO_KR_KEY, DRUG_LIST_OP, DRUG_NAME_PARAM)가 필요해요' });

  const u = new URL('https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService08/' + op);
  u.searchParams.set('serviceKey', key);
  u.searchParams.set('pageNo', '1');
  u.searchParams.set('numOfRows', '10');
  u.searchParams.set('type', 'json');
  u.searchParams.set(param, name);
  try {
    const r = await fetch(u);
    const j = await r.json();
    const items = (j && j.body && j.body.items) || [];
    const list = Array.isArray(items) ? items : (items.item ? [].concat(items.item) : []);
    const rows = list.map((x) => ({
      itemSeq: x.ITEM_SEQ,
      name: x.ITEM_NAME,
      company: x.ENTP_NAME,
      category: x.SPCLTY_PBLC,
      type: String(x.PRDUCT_TYPE || '').replace(/^\[\d+\]/, ''),
      ingredient: x.ITEM_INGR_NAME
    }));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ total: Number((j.body && j.body.totalCount) || rows.length), rows });
  } catch (e) {
    return res.status(502).json({ error: '허가정보에 연결하지 못했어요' });
  }
};
