/*
 * 서버 중계: 식품안전나라 건강기능식품 품목제조신고(원재료) API (서비스 C003)
 *
 * ⚠ 미검증 초안입니다. 요청 주소·항목 이름은 식품안전나라 화면에서 확인한 대로 썼지만,
 *   이 파일 자체는 실제 호출로 테스트하지 못했습니다. 배포 후 /api/supp?name=메가도스 로 먼저 확인하세요.
 * 인증키는 서버 환경변수 FOODSAFETY_KEY에만 둡니다. 응답에 키를 넣지 않습니다.
 */
module.exports = async function handler(req, res) {
  const origin = process.env.ALLOW_ORIGIN;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);

  const name = String((req.query && req.query.name) || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'name이 필요해요' });
  const key = process.env.FOODSAFETY_KEY;
  if (!key) return res.status(500).json({ error: '서버에 인증키가 설정되지 않았어요' });

  const url = 'http://openapi.foodsafetykorea.go.kr/api/' + encodeURIComponent(key) +
    '/C003/json/1/10/PRDLST_NM=' + encodeURIComponent(name);
  try {
    const r = await fetch(url);
    const j = await r.json();
    const c = (j && j.C003) || {};
    const date = (s) => (/^\d{8}$/.test(s || '') ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) : s || '');
    const rows = (c.row || []).map((x) => ({
      reportNo: x.PRDLST_REPORT_NO,
      name: x.PRDLST_NM,
      company: x.BSSH_NM,
      reportedAt: date(x.PRMS_DT),
      ingredientRaw: x.RAWMTRL_NM,
      intake: x.NTK_MTHD,
      functionality: x.PRIMARY_FNCLTY,
      cautions: x.IFTKN_ATNT_MATR_CN
    }));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ total: Number(c.total_count || 0), rows });
  } catch (e) {
    return res.status(502).json({ error: '식품안전나라에 연결하지 못했어요' });
  }
};
