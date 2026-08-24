export const PARKING_DATA_REVIEWED_ON = "2026년 8월 24일";

export const PARKING_STATUS_LABELS = Object.freeze({
  available: "주차 가능",
  limited: "주차 제한적",
  "weekday-only": "평일만 주차",
  nearby: "인근 주차장",
  unavailable: "주차 불가",
  unknown: "주차 정보 없음"
});

// 서울시 공식 시설 상세·오시는길 페이지를 시설별로 확인한 고정 판정값이다.
export const PARKING_STATUS_BY_FACILITY = Object.freeze({
  DJ230901: "available",
  MP260701: "limited",
  GJ240401: "available",
  YC231201: "limited",
  DJ250901: "limited",
  DJ260602: "available",
  GS260401: "available",
  GS241101: "limited",

  GN251201: "limited",
  GN240902: "available",

  GD230201: "available",
  GD250601: "unavailable",
  GD250101: "limited",
  GD230202: "limited",
  GD231201: "unavailable",
  GD240101: "limited",

  GB230601: "limited",
  GB251001: "limited",

  GS230801: "limited",
  GS240802: "available",
  GS241201: "limited",
  GS260601: "limited",

  GA240101: "nearby",
  GA241201: "unavailable",
  GA241203: "limited",
  GA250301: "limited",
  GA250401: "limited",
  GA251101: "limited",

  GJ230202: "available",
  GJ240903: "weekday-only",
  GJ240902: "weekday-only",

  GR241001: "unavailable",
  GR250201: "nearby",
  GR250505: "nearby",

  KC240902: "limited",
  KC240901: "available",
  KC260501: "limited",

  NW240701: "unavailable",
  NW260302: "limited",

  DB231001: "nearby",
  DB241103: "limited",
  DB241101: "limited",
  DB241102: "available",
  DB250401: "nearby",
  DB231201: "available",
  DB231202: "nearby",

  DM250102: "available",
  DM250301: "unavailable",
  DM250103: "available",
  DM250901: "unavailable",
  DM250304: "unavailable",

  DJ260401: "available",
  DJ260201: "nearby",
  DJ251003: "nearby",
  DJ241203: "limited",
  DJ241201: "limited",
  DJ241202: "available",
  DJ221102: "limited",
  DJ240701: "limited",
  DJ241008: "unknown",
  DJ260205: "limited",
  DJ241006: "limited",
  DJ230701: "limited",
  DJ241204: "unavailable",
  DJ241004: "limited",

  MP230802: "limited",
  MP251201: "limited",
  MP260201: "unavailable",
  MP260705: "nearby",
  MP260706: "available",

  SM240501: "limited",
  SM251101: "unknown",
  SM241101: "unavailable",
  SM250101: "limited",
  SM250102: "limited",
  SM260101: "limited",

  SC231001: "nearby",
  SC251201: "limited",
  SC231201: "limited",
  SC240404: "nearby",
  SC240801: "available",

  SD221201: "limited",
  SD240701: "weekday-only",

  SB240201: "unavailable",
  SB251201: "limited",
  SB240903: "available",
  SB240702: "nearby",
  SB240801: "limited",
  SB240902: "nearby",
  SB260302: "limited",

  SP240401: "limited",
  SP250301: "limited",
  SP250401: "unavailable",
  SP250402: "limited",
  SP251101: "nearby",
  SP260102: "limited",

  YC260201: "limited",
  YC260601: "limited",
  YC251204: "limited",
  YC251003: "limited",
  YC250501: "limited",
  YC250603: "unavailable",
  YC250202: "nearby",
  YC250201: "limited",
  YC231206: "nearby",
  YC221101: "unavailable",

  YF231001: "unavailable",
  YF241001: "nearby",
  YF260101: "unavailable",

  YS231001: "available",
  YS241201: "available",
  YS260401: "limited",

  EP260501: "nearby",
  EP260502: "nearby",
  EP260503: "nearby",
  EP250501: "unavailable",
  EP250301: "unavailable",
  EP250601: "unavailable",
  EP260302: "unavailable",

  JN220501: "unknown",
  JN260701: "limited",

  JG250301: "available",
  JG240301: "available",
  JG250701: "nearby",
  JG251201: "limited",

  JR240501: "available",
  JR220801: "limited",
  JR251102: "limited",
  JR250401: "unavailable",
  JR251101: "limited",
  JR250504: "available",
  JR260301: "unknown"
});

export function parkingStatusForFacility(facilityId) {
  return PARKING_STATUS_BY_FACILITY[facilityId] || "unknown";
}

export function parkingLabelForFacility(facilityId) {
  return PARKING_STATUS_LABELS[parkingStatusForFacility(facilityId)];
}
