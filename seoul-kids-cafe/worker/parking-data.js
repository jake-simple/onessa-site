// 서울형 키즈카페 공식 이용안내(BD_selectKidsCafeView.do)의 주차 안내 문구를 읽고 정리한 표.
// 워커는 이 표를 그대로 내려보내기만 하고, 요청마다 안내문을 다시 읽지 않는다.
//
// 갱신 방법
//   1. cd seoul-kids-cafe/worker && npm run guides:dump
//      → guides.json 에 시설별 안내문 중 "주차"가 들어간 문장이 모인다.
//   2. 그 문장을 읽고 아래 표를 고친다.
//
// status
//   available   주차할 수 있는 곳이 안내돼 있음 (유료·무료 무관)
//   limited     주차는 되지만 협소·대수 제한 등으로 어렵다고 안내함
//   unavailable 주차 공간이 없다고 안내함
//   (표에 없는 시설은 태그를 붙이지 않는다)
//
// note 는 판단 근거가 된 안내문 원문 문장을 그대로 옮긴다.

export const PARKING_BY_FACILITY = {
};
