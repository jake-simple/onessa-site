import assert from "node:assert/strict";
import test from "node:test";
import availabilityWorker, {
  dayNoForDate,
  normalizeSession,
  parseFacilities,
  parseFacilityMetadataPage,
  parseFacilityParking,
  refreshStartedSessions
} from "./worker.js";

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

test("이용안내 문구에서 주차 가능 여부를 읽는다", () => {
  const html = `
    <div class="kidscafe_view">
      <h4>이용안내</h4>
      <ul>
        <li>미끄럼 방지 양말을 반드시 착용해 주세요.</li>
        <li>주차 가능(건물 지하주차장 이용), 최초 30분 무료 이후 30분당 1,000원</li>
      </ul>
    </div>`;

  assert.deepEqual(parseFacilityParking(html), {
    status: "available",
    note: "주차 가능(건물 지하주차장 이용), 최초 30분 무료 이후 30분당 1,000원"
  });
});

test("주차 공간이 없다는 안내는 주차 불가로 읽는다", () => {
  const html = `<dl><dt>주차</dt><dd>별도의 주차공간이 없으니 대중교통을 이용해 주시기 바랍니다.</dd></dl>`;

  assert.deepEqual(parseFacilityParking(html), {
    status: "unavailable",
    note: "별도의 주차공간이 없으니 대중교통을 이용해 주시기 바랍니다."
  });
});

test("주차 공간이 협소하다는 안내는 주차 협소로 읽는다", () => {
  const html = `<p>주차장이 협소하여 대중교통 이용을 권장합니다.</p>`;

  assert.deepEqual(parseFacilityParking(html), {
    status: "limited",
    note: "주차장이 협소하여 대중교통 이용을 권장합니다."
  });
});

test("무료 주차가 안 된다는 요금 안내를 주차 불가로 읽지 않는다", () => {
  const html = `<p>평일 1시간 30분 무료, 이후 10분당 1,000원이며 주말 및 공휴일은 무료주차 불가입니다.</p>`;

  assert.equal(parseFacilityParking(html).status, "available");
});

test("주차를 언급하지 않은 안내문은 상태를 단정하지 않는다", () => {
  const html = `
    <div>
      <h4>이용안내</h4>
      <p>개인 텀블러를 지참해 주세요.<br />일회용컵은 제공되지 않습니다.</p>
    </div>`;

  assert.deepEqual(parseFacilityParking(html), { status: "unknown", note: "" });
});

test("스크립트에 섞인 문구는 주차 안내로 읽지 않는다", () => {
  const html = `<script>var label = "주차 불가";</script><dd>주차 가능합니다.</dd>`;

  assert.equal(parseFacilityParking(html).status, "available");
});

test("주차 안내가 여러 줄이면 가장 보수적인 상태를 고른다", () => {
  const html = `
    <ul>
      <li>인근 공영주차장을 이용하실 수 있습니다.</li>
      <li>시설 자체 주차공간은 없습니다.</li>
    </ul>`;

  assert.deepEqual(parseFacilityParking(html), {
    status: "unavailable",
    note: "시설 자체 주차공간은 없습니다."
  });
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

test("시설 목록에 안내문에서 읽은 주차 태그를 붙이고 캐시한다", async (t) => {
  const previousCaches = globalThis.caches;
  const previousFetch = globalThis.fetch;
  const cacheStore = new Map();
  const guideCalls = new Map();
  const facilities = [
    { id: "GN0001", name: "강남점", district: "강남구", officialReservationUrl: "https://example.com/GN0001" },
    { id: "GD0001", name: "강동점", district: "강동구", officialReservationUrl: "https://example.com/GD0001" }
  ];
  const guideHtmlById = {
    GN0001: "<dd>주차 가능(건물 지하주차장 이용)</dd>",
    GD0001: "<dd>별도의 주차공간이 없으니 대중교통을 이용해 주세요.</dd>"
  };

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
    const requestUrl = new URL(String(url));
    assert.equal(requestUrl.pathname, "/icare/user/kidsCafe/BD_selectKidsCafeView.do");
    const facilityId = requestUrl.searchParams.get("q_fcltyId");
    guideCalls.set(facilityId, (guideCalls.get(facilityId) || 0) + 1);
    return new Response(guideHtmlById[facilityId], { headers: { "Content-Type": "text/html" } });
  };

  async function requestFacilities() {
    const pending = [];
    const response = await availabilityWorker.fetch(
      new Request("https://api.example.com/api/v2/facilities"),
      {},
      { waitUntil: (promise) => pending.push(promise) }
    );
    await Promise.all(pending);
    assert.equal(response.status, 200);
    return response.json();
  }

  const firstPayload = await requestFacilities();
  const secondPayload = await requestFacilities();

  assert.deepEqual(firstPayload.facilities.map((facility) => facility.parking), [
    { status: "available", note: "주차 가능(건물 지하주차장 이용)" },
    { status: "unavailable", note: "별도의 주차공간이 없으니 대중교통을 이용해 주세요." }
  ]);
  assert.deepEqual(secondPayload.facilities.map((facility) => facility.parking?.status), ["available", "unavailable"]);
  assert.deepEqual(Object.fromEntries(guideCalls), { GN0001: 1, GD0001: 1 });
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
