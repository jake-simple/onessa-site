import assert from "node:assert/strict";
import test from "node:test";
import { dayNoForDate, normalizeSession, parseFacilities } from "./worker.js";

test("공식 시설 선택 목록을 내부 시설 모델로 바꾼다", () => {
  const html = `
    <select id="q_selFcltyId">
      <option value="DJ230901" selected>서울형 키즈카페 시립 1호점</option>
      <option value="MP260701">서울형 키즈카페 시립 노고산점</option>
      <option value="GJ240401">서울형 키즈카페 시립 뚝섬자벌레점</option>
      <option value="YC231201">서울형 키즈카페 시립 목동점</option>
      <option value="GS241101">서울형 키즈카페 시립 화곡점</option>
    </select>`;

  const facilities = parseFacilities(html);
  assert.equal(facilities.length, 5);
  assert.deepEqual(facilities[0], {
    id: "DJ230901",
    name: "시립 1호점",
    district: "동작구",
    officialReservationUrl: "https://umppa.seoul.go.kr/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=DJ230901&q_fcltyStle="
  });
});

test("서울시 달력의 요일 번호는 일요일 1부터 시작한다", () => {
  assert.equal(dayNoForDate("2026-08-11"), 3);
  assert.equal(dayNoForDate("2026-08-15"), 7);
});

test("정원과 예약 인원으로 남은 자리를 계산한다", () => {
  const facility = { id: "DJ230901" };
  const row = {
    tmeSn: 1,
    tmeSeCode: "1003",
    tmeSeNm: "공용",
    useBeginTime: "0940",
    useEndTime: "1140",
    resvePsncpa: 33,
    resveNmpr: 7,
    restdeCtgCd: null
  };
  const now = { year: "2026", month: "08", day: "11", hour: "09", minute: "00" };
  const session = normalizeSession(row, facility, "2026-08-11", now);

  assert.equal(session.remainingSeats, 26);
  assert.equal(session.status, "available");
  assert.equal(session.audience, "shared");
  assert.equal(session.startsAt, "09:40");
});

test("오늘 이미 끝난 회차와 단체 회차를 구분한다", () => {
  const facility = { id: "DJ230901" };
  const row = {
    tmeSn: 2,
    tmeSeCode: "1002",
    tmeSeNm: "단체",
    useBeginTime: "1000",
    useEndTime: "1200",
    resvePsncpa: 30,
    resveNmpr: 0,
    restdeCtgCd: null
  };
  const now = { year: "2026", month: "08", day: "11", hour: "12", minute: "01" };
  const session = normalizeSession(row, facility, "2026-08-11", now);

  assert.equal(session.status, "ended");
  assert.equal(session.audience, "group");
});
