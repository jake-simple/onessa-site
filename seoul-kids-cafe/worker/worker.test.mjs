import assert from "node:assert/strict";
import test from "node:test";
import availabilityWorker, {
  dayNoForDate,
  mergeParkingData,
  normalizeSession,
  parseFacilities,
  parseFacilityMetadataPage,
  refreshStartedSessions
} from "./worker.js";
import { PARKING_BY_FACILITY } from "./parking-data.js";

const PARKING_STATUSES = new Set(["available", "limited", "unavailable"]);

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

test("공식 안내 목록에서 고정 정원과 주소, 썸네일을 읽는다", () => {
  const html = `
    <div class="kidscafe_wrap">
      <h5>서울형 키즈카페 강남구 역삼1동점</h5>
      <div class="kidscafe_body type2">
        <div class="kidscafe_image">
          <p class="img"><img src="/icare/upload/facility.jpg" alt="시설 썸네일" /></p>
        </div>
        <div class="kidscafe_info">
          <dl>
            <dt>이용정원</dt>
            <dd><strong>개인</strong><span>24 명</span><strong>단체</strong><span>20 명</span></dd>
            <dt class="age">주&nbsp;&nbsp;&nbsp;소</dt>
            <dd class="age">서울특별시 강남구 언주로107길 4 2층 (역삼동)</dd>
          </dl>
          <a href="BD_selectKidsCafeView.do?q_fcltyId=GN240902&q_fcltyStle=" class="md_btn">이용안내</a>
        </div>
      </div>
    </div><!-- kidscafe_wrap end -->
    <a href="#" onclick="jsMovePage(28); return false;" title="마지막페이지로 가기">마지막</a>`;

  const page = parseFacilityMetadataPage(html);
  assert.equal(page.pageCount, 28);
  assert.deepEqual(page.facilities, [{
    id: "GN240902",
    address: "서울특별시 강남구 언주로107길 4 2층 (역삼동)",
    thumbnailUrl: "https://umppa.seoul.go.kr/icare/upload/facility.jpg",
    capacity: { individual: 24, group: 20 }
  }]);
});

test("정리해 둔 주차 표는 정해진 상태와 근거 문장만 담는다", () => {
  for (const [facilityId, parking] of Object.entries(PARKING_BY_FACILITY)) {
    assert.match(facilityId, /^[A-Z]{2}\d{6}$/, `${facilityId}: 시설 ID 형식`);
    assert.ok(PARKING_STATUSES.has(parking.status), `${facilityId}: 알 수 없는 상태 ${parking.status}`);
    assert.equal(typeof parking.note, "string", `${facilityId}: 근거 문장이 없습니다`);
    assert.ok(parking.note.includes("주차"), `${facilityId}: 근거 문장에 주차 안내가 없습니다`);
  }
});

test("정리해 둔 주차 표를 시설 정보에 붙인다", () => {
  const facilities = [{ id: "GN0001", name: "강남점" }, { id: "GD0001", name: "강동점" }];
  const parkingById = { GN0001: { status: "available", note: "주차 가능(건물 지하주차장 이용)" } };

  assert.deepEqual(mergeParkingData(facilities, parkingById), [
    { id: "GN0001", name: "강남점", parking: { status: "available", note: "주차 가능(건물 지하주차장 이용)" } },
    { id: "GD0001", name: "강동점" }
  ]);
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

test("오늘 이미 시작한 회차와 단체 회차를 구분한다", () => {
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
  const now = { year: "2026", month: "08", day: "11", hour: "10", minute: "01" };
  const session = normalizeSession(row, facility, "2026-08-11", now);
  const sessionAtStart = normalizeSession(row, facility, "2026-08-11", {
    ...now,
    minute: "00"
  });
  const futureDateSession = normalizeSession(row, facility, "2026-08-12", now);

  assert.equal(session.status, "ended");
  assert.equal(sessionAtStart.status, "ended");
  assert.equal(futureDateSession.status, "available");
  assert.equal(session.audience, "group");
});

test("캐시된 오늘 회차도 현재 시작 시각을 다시 반영한다", () => {
  const result = {
    id: "DJ230901",
    sessions: [
      { id: "past", startsAt: "10:00", status: "available" },
      { id: "future", startsAt: "12:00", status: "available" }
    ]
  };
  const refreshed = refreshStartedSessions(result, "2026-08-11", {
    year: "2026",
    month: "08",
    day: "11",
    hour: "11",
    minute: "00"
  });

  assert.equal(refreshed.sessions[0].status, "ended");
  assert.equal(refreshed.sessions[1].status, "available");
});

test("시설 목록 응답은 안내문을 다시 읽지 않고 주차 표만 붙인다", async (t) => {
  const previousCaches = globalThis.caches;
  const previousFetch = globalThis.fetch;
  const cacheStore = new Map();
  const facilities = [
    { id: "GN0001", name: "강남점", district: "강남구", officialReservationUrl: "https://example.com/GN0001" },
    { id: "GD0001", name: "강동점", district: "강동구", officialReservationUrl: "https://example.com/GD0001" }
  ];

  t.after(() => {
    if (previousCaches === undefined) delete globalThis.caches;
    else globalThis.caches = previousCaches;
    globalThis.fetch = previousFetch;
  });

  globalThis.caches = {
    default: {
      async match(request) {
        const response = cacheStore.get(request.url);
        return response ? response.clone() : undefined;
      },
      async put(request, response) {
        cacheStore.set(request.url, response.clone());
      }
    }
  };
  await globalThis.caches.default.put(
    new Request("https://cache.internal/__cache/facilities-v2"),
    Response.json({ facilities, districts: ["강남구", "강동구"] })
  );
  await globalThis.caches.default.put(
    new Request("https://cache.internal/__cache/facility-metadata-v1"),
    Response.json({ facilities: [{ id: "GN0001", address: "서울특별시 강남구", thumbnailUrl: "", capacity: {} }] })
  );

  globalThis.fetch = async (url) => {
    throw new Error("시설 목록 응답에서 예상하지 못한 외부 요청: " + url);
  };

  const pending = [];
  const response = await availabilityWorker.fetch(
    new Request("https://api.example.com/api/v2/facilities"),
    {},
    { waitUntil: (promise) => pending.push(promise) }
  );
  await Promise.all(pending);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.facilities.length, 2);
  assert.equal(payload.facilities[0].address, "서울특별시 강남구");
  for (const facility of payload.facilities) {
    assert.deepEqual(facility.parking, PARKING_BY_FACILITY[facility.id]);
  }
});

test("시설별 캐시는 서로 다른 검색 조합에서도 재사용한다", async (t) => {
  const previousCaches = globalThis.caches;
  const previousFetch = globalThis.fetch;
  const cacheStore = new Map();
  const upstreamCalls = new Map();
  const facilities = [
    { id: "GN0001", name: "강남점", district: "강남구", officialReservationUrl: "https://example.com/GN0001" },
    { id: "GD0001", name: "강동점", district: "강동구", officialReservationUrl: "https://example.com/GD0001" },
    { id: "GB0001", name: "강북점", district: "강북구", officialReservationUrl: "https://example.com/GB0001" }
  ];

  t.after(() => {
    if (previousCaches === undefined) delete globalThis.caches;
    else globalThis.caches = previousCaches;
    globalThis.fetch = previousFetch;
  });

  globalThis.caches = {
    default: {
      async match(request) {
        const response = cacheStore.get(request.url);
        return response ? response.clone() : undefined;
      },
      async put(request, response) {
        cacheStore.set(request.url, response.clone());
      }
    }
  };
  await globalThis.caches.default.put(
    new Request("https://cache.internal/__cache/facilities-v2"),
    Response.json({ facilities, districts: facilities.map((facility) => facility.district) })
  );

  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://umppa.seoul.go.kr/icare/user/kidsCafeResve/ND_selectResveTmeList.do");
    const facilityId = new URLSearchParams(init.body).get("q_fcltyId");
    upstreamCalls.set(facilityId, (upstreamCalls.get(facilityId) || 0) + 1);
    return Response.json({
      result: true,
      value: {
        tmeData: [{
          tmeSn: 1,
          tmeSeCode: "1001",
          tmeSeNm: "개인",
          useBeginTime: "1000",
          useEndTime: "1200",
          resvePsncpa: 20,
          resveNmpr: 5,
          restdeCtgCd: null
        }]
      }
    });
  };

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

  async function requestAvailability(ids) {
    const pending = [];
    const response = await availabilityWorker.fetch(
      new Request(`https://api.example.com/api/availability?date=${date}&ids=${ids.join(",")}`),
      {},
      { waitUntil: (promise) => pending.push(promise) }
    );
    await Promise.all(pending);
    assert.equal(response.status, 200);
    return response;
  }

  const firstResponse = await requestAvailability(["GN0001", "GD0001"]);
  const secondResponse = await requestAvailability(["GD0001", "GB0001"]);

  assert.equal(firstResponse.headers.get("X-Cache-Status"), "MISS");
  assert.equal(secondResponse.headers.get("X-Cache-Status"), "PARTIAL");
  assert.deepEqual(Object.fromEntries(upstreamCalls), {
    GD0001: 1,
    GN0001: 1,
    GB0001: 1
  });
});
