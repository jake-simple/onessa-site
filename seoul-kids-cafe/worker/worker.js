const SOURCE_ORIGIN = "https://umppa.seoul.go.kr";
const FACILITY_LIST_ENDPOINT = SOURCE_ORIGIN + "/icare/user/kidsCafe/BD_selectKidsCafeList.do";
const FACILITY_LIST_STYLES = ["2001", "2002"];
const FACILITY_PAGES = ["SC251201", "SD240701"].map((facilityId) => {
  return SOURCE_ORIGIN + "/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=" + facilityId + "&q_fcltyStle=";
});
const AVAILABILITY_ENDPOINT = SOURCE_ORIGIN + "/icare/user/kidsCafeResve/ND_selectResveTmeList.do";
const FACILITY_CACHE_SECONDS = 86400;
const AVAILABILITY_CACHE_SECONDS = 120;
const MAX_FACILITIES_PER_REQUEST = 24;
const UPSTREAM_CONCURRENCY = 6;
const UPSTREAM_TIMEOUT_MS = 9000;
const FACILITY_TIMEOUT_MS = 15000;

const ALLOWED_ORIGINS = new Set([
  "https://onessa.app",
  "https://www.onessa.app",
  "https://kids-cafe-finder.web.tossmini.com",
  "https://kids-cafe-finder.private-web.tossmini.com",
  "https://kids-cafe-finder.apps.tossmini.com",
  "https://kids-cafe-finder.private-apps.tossmini.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

const DISTRICT_BY_PREFIX = {
  GN: "강남구",
  GD: "강동구",
  GB: "강북구",
  GS: "강서구",
  GA: "관악구",
  GJ: "광진구",
  GR: "구로구",
  KC: "금천구",
  NW: "노원구",
  DB: "도봉구",
  DM: "동대문구",
  DJ: "동작구",
  MP: "마포구",
  SM: "서대문구",
  SC: "서초구",
  SD: "성동구",
  SB: "성북구",
  SP: "송파구",
  YC: "양천구",
  YF: "영등포구",
  YS: "용산구",
  EP: "은평구",
  JN: "종로구",
  JG: "중구",
  JR: "중랑구"
};

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function errorResponse(code, message, status) {
  return jsonResponse({ error: { code, message } }, status, {
    "Cache-Control": "no-store"
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  return ALLOWED_ORIGINS.has(origin) ? origin : false;
}

function withCors(response, origin, cacheStatus) {
  const headers = new Headers(response.headers);
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  if (cacheStatus) headers.set("X-Cache-Status", cacheStatus);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function handleOptions(origin) {
  if (origin === false) return errorResponse("ORIGIN_NOT_ALLOWED", "허용되지 않은 요청 출처입니다.", 403);
  return new Response(null, {
    status: 204,
    headers: {
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function plainText(value) {
  return decodeHtml(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(rawName) {
  return decodeHtml(rawName)
    .replace(/<[^>]*>/g, "")
    .replace(/^서울형\s*키즈카페\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFacilities(html) {
  const select = html.match(/<select[^>]+id=["']q_selFcltyId["'][^>]*>([\s\S]*?)<\/select>/i);
  if (!select) throw new Error("시설 선택 목록을 찾지 못했습니다.");

  const facilities = [];
  const optionPattern = /<option\s+value=["']([A-Z0-9]+)["'][^>]*>([\s\S]*?)<\/option>/gi;
  let match;

  while ((match = optionPattern.exec(select[1])) !== null) {
    const id = match[1];
    const district = DISTRICT_BY_PREFIX[id.slice(0, 2)];
    if (!district) continue;
    facilities.push({
      id,
      name: displayName(match[2]),
      district,
      officialReservationUrl: SOURCE_ORIGIN + "/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=" + encodeURIComponent(id) + "&q_fcltyStle="
    });
  }

  if (facilities.length < 5) throw new Error("시설 목록이 예상보다 적습니다.");
  return facilities;
}

function parseFacilityMetadataPage(html) {
  const facilities = [];
  const cardPattern = /<div\s+class=["']kidscafe_wrap["'][^>]*>([\s\S]*?)<\/div>\s*<!--\s*kidscafe_wrap end\s*-->/gi;
  let cardMatch;

  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const card = cardMatch[1];
    const idMatch = card.match(/BD_selectKidsCafeView\.do\?q_fcltyId=([A-Z0-9]+)/i);
    if (!idMatch) continue;

    const imageMatch = card.match(/<div\s+class=["']kidscafe_image["'][^>]*>[\s\S]*?<img\s+[^>]*src=["']([^"']+)["']/i);
    const addressMatch = card.match(/<dt[^>]*>\s*주(?:\s|&nbsp;)*소\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
    const capacityMatch = card.match(/<dt[^>]*>\s*이용정원\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
    const capacity = {};

    if (capacityMatch) {
      const capacityPattern = /<strong[^>]*>\s*(개인|단체)\s*<\/strong>\s*<span[^>]*>\s*(\d+)\s*명\s*<\/span>/gi;
      let capacityValue;
      while ((capacityValue = capacityPattern.exec(capacityMatch[1])) !== null) {
        capacity[capacityValue[1] === "개인" ? "individual" : "group"] = Number(capacityValue[2]);
      }
    }

    facilities.push({
      id: idMatch[1],
      address: addressMatch ? plainText(addressMatch[1]) : "",
      thumbnailUrl: imageMatch ? new URL(decodeHtml(imageMatch[1]), SOURCE_ORIGIN).toString() : "",
      capacity
    });
  }

  const lastPageMatch = html.match(/jsMovePage\((\d+)\);\s*return false;["'][^>]*title=["']마지막페이지로 가기["']/i);
  return {
    facilities,
    pageCount: lastPageMatch ? Number(lastPageMatch[1]) : 1
  };
}

async function fetchWithTimeout(url, init, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function loadFacilities(requestUrl, ctx) {
  const cacheKey = new Request("https://cache.internal/__cache/facilities-v2", { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);

  if (cached) {
    return { payload: await cached.json(), cacheStatus: "HIT" };
  }

  let facilities;
  let lastError;
  for (const facilityPage of FACILITY_PAGES) {
    try {
      const response = await fetchWithTimeout(facilityPage, {
        method: "GET",
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9"
        }
      }, FACILITY_TIMEOUT_MS);
      if (!response.ok) throw new Error("공식 시설 목록 응답이 올바르지 않습니다.");
      facilities = parseFacilities(await response.text());
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!facilities) throw lastError || new Error("공식 시설 목록을 불러오지 못했습니다.");

  const districts = [...new Set(facilities.map((facility) => facility.district))].sort((a, b) => a.localeCompare(b, "ko"));
  const payload = {
    fetchedAt: new Date().toISOString(),
    facilities,
    districts
  };
  const cacheResponse = jsonResponse(payload, 200, {
    "Cache-Control": "public, max-age=3600, s-maxage=" + FACILITY_CACHE_SECONDS
  });
  ctx.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
  return { payload, cacheStatus: "MISS" };
}

function seoulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return values;
}

function seoulDateString(date = new Date()) {
  const parts = seoulDateParts(date);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const requestedMs = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(requestedMs) || new Date(requestedMs).toISOString().slice(0, 10) !== date) return false;
  const todayMs = Date.parse(seoulDateString() + "T00:00:00Z");
  const difference = Math.round((requestedMs - todayMs) / 86400000);
  return difference >= 0 && difference <= 62;
}

function dayNoForDate(date) {
  return new Date(date + "T12:00:00+09:00").getUTCDay() + 1;
}

function formatTime(value) {
  const digits = String(value || "").padStart(4, "0");
  if (!/^\d{4}$/.test(digits)) return null;
  return digits.slice(0, 2) + ":" + digits.slice(2, 4);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sessionHasStarted(date, startsAt, now) {
  const nowDate = now.year + "-" + now.month + "-" + now.day;
  const nowTime = now.hour + ":" + now.minute;
  return date === nowDate && startsAt && startsAt <= nowTime;
}

function normalizeSession(row, facility, date, now = seoulDateParts()) {
  const capacity = numberOrNull(row.resvePsncpa);
  const reserved = numberOrNull(row.resveNmpr);
  const remainingSeats = capacity === null || reserved === null
    ? null
    : Math.max(0, capacity - reserved);
  const startsAt = formatTime(row.useBeginTime);
  const endsAt = formatTime(row.useEndTime);
  const category = String(row.tmeSeNm || "").trim();
  const audience = row.tmeSeCode === "1002" || category.includes("단체")
    ? "group"
    : row.tmeSeCode === "1003" || category.includes("공용")
      ? "shared"
      : "individual";

  let status = "unknown";
  if (row.restdeCtgCd) {
    status = "closed";
  } else if (remainingSeats !== null) {
    if (sessionHasStarted(date, startsAt, now)) status = "ended";
    else status = remainingSeats > 0 ? "available" : "sold-out";
  }

  return {
    id: facility.id + "-" + date + "-" + String(row.tmeSn) + "-" + String(row.tmeSeCode || ""),
    label: String(row.tmeSn) + "회차",
    category,
    audience,
    startsAt,
    endsAt,
    remainingSeats,
    status
  };
}

function refreshStartedSessions(result, date, now) {
  return {
    ...result,
    sessions: (result.sessions || []).map((session) => (
      session.status === "available" && sessionHasStarted(date, session.startsAt, now)
        ? {...session, status: "ended"}
        : session
    ))
  };
}

async function fetchFacilityAvailability(facility, date, dayNo, now) {
  const body = new URLSearchParams({
    q_fcltyId: facility.id,
    q_resveDe: date,
    q_dayNo: String(dayNo)
  });

  try {
    const response = await fetchWithTimeout(AVAILABILITY_ENDPOINT, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body.toString()
    });

    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.json();
    if (!payload || payload.result !== true || !payload.value || !Array.isArray(payload.value.tmeData)) {
      throw new Error("응답 형식이 변경되었습니다.");
    }

    return {
      ...facility,
      sessions: payload.value.tmeData.map((row) => normalizeSession(row, facility, date, now))
    };
  } catch (error) {
    return {
      ...facility,
      sessions: [],
      error: {
        code: error && error.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_FAILED",
        message: "현재 이 시설의 빈자리를 확인하지 못했습니다."
      }
    };
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = [];
  const workerCount = Math.min(limit, items.length);
  for (let index = 0; index < workerCount; index += 1) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function fetchFacilityMetadataPage(facilityStyle, page) {
  const url = new URL(FACILITY_LIST_ENDPOINT);
  url.searchParams.set("q_hiddenVal", "1");
  url.searchParams.set("q_rowPerPage", "5");
  url.searchParams.set("q_fcltyStle", facilityStyle);
  url.searchParams.set("q_currPage", String(page));

  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9"
    }
  }, FACILITY_TIMEOUT_MS);
  if (!response.ok) throw new Error("공식 시설 상세 목록 응답이 올바르지 않습니다.");
  return parseFacilityMetadataPage(await response.text());
}

async function loadFacilityMetadata(ctx) {
  const cacheKey = new Request("https://cache.internal/__cache/facility-metadata-v1", { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);

  if (cached) {
    return { payload: await cached.json(), cacheStatus: "HIT" };
  }

  const firstPages = await Promise.all(FACILITY_LIST_STYLES.map(async (facilityStyle) => ({
    facilityStyle,
    page: await fetchFacilityMetadataPage(facilityStyle, 1)
  })));
  const remainingPages = firstPages.flatMap(({ facilityStyle, page }) => (
    Array.from({ length: Math.max(0, page.pageCount - 1) }, (_, index) => ({
      facilityStyle,
      pageNumber: index + 2
    }))
  ));
  const loadedPages = await mapWithConcurrency(remainingPages, UPSTREAM_CONCURRENCY, ({ facilityStyle, pageNumber }) => (
    fetchFacilityMetadataPage(facilityStyle, pageNumber)
  ));
  const metadataById = new Map();

  for (const page of [...firstPages.map((entry) => entry.page), ...loadedPages]) {
    for (const facility of page.facilities) metadataById.set(facility.id, facility);
  }
  if (metadataById.size < 5) throw new Error("시설 상세 목록이 예상보다 적습니다.");

  const payload = {
    fetchedAt: new Date().toISOString(),
    facilities: [...metadataById.values()]
  };
  const cacheResponse = jsonResponse(payload, 200, {
    "Cache-Control": "public, max-age=3600, s-maxage=" + FACILITY_CACHE_SECONDS
  });
  ctx.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
  return { payload, cacheStatus: "MISS" };
}

function facilityAvailabilityCacheKey(requestUrl, date, facilityId) {
  const origin = new URL(requestUrl).origin;
  return new Request(origin + "/__cache/facility-availability-v1?date=" + encodeURIComponent(date) + "&id=" + encodeURIComponent(facilityId), {
    method: "GET"
  });
}

async function handleFacilities(request, ctx, origin) {
  try {
    const [facilitySource, metadataSource] = await Promise.all([
      loadFacilities(request.url, ctx),
      loadFacilityMetadata(ctx)
    ]);
    const metadataById = new Map(metadataSource.payload.facilities.map((facility) => [facility.id, facility]));
    const payload = {
      ...facilitySource.payload,
      facilities: facilitySource.payload.facilities.map((facility) => ({
        ...facility,
        ...metadataById.get(facility.id)
      }))
    };
    const cacheStatus = facilitySource.cacheStatus === "HIT" && metadataSource.cacheStatus === "HIT"
      ? "HIT"
      : "MISS";
    const response = jsonResponse(payload, 200, {
      "Cache-Control": "public, max-age=3600, s-maxage=" + FACILITY_CACHE_SECONDS
    });
    return withCors(response, origin, cacheStatus);
  } catch (error) {
    return withCors(errorResponse("FACILITY_SOURCE_FAILED", "공식 시설 목록을 불러오지 못했습니다.", 502), origin);
  }
}

async function handleAvailability(request, ctx, origin) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || seoulDateString();
  if (!validateDate(date)) {
    return withCors(errorResponse("INVALID_DATE", "오늘부터 62일 안의 날짜를 선택해 주세요.", 400), origin);
  }

  const requestedIds = [...new Set((url.searchParams.get("ids") || "").split(",").filter(Boolean))].sort();
  if (requestedIds.length === 0 || requestedIds.length > MAX_FACILITIES_PER_REQUEST) {
    return withCors(errorResponse("INVALID_FACILITIES", "한 번에 1~24개 시설을 조회할 수 있습니다.", 400), origin);
  }
  if (requestedIds.some((id) => !/^[A-Z0-9]{4,12}$/.test(id))) {
    return withCors(errorResponse("INVALID_FACILITIES", "시설 ID 형식이 올바르지 않습니다.", 400), origin);
  }

  let facilityPayload;
  try {
    facilityPayload = (await loadFacilities(request.url, ctx)).payload;
  } catch (error) {
    return withCors(errorResponse("FACILITY_SOURCE_FAILED", "공식 시설 목록을 불러오지 못했습니다.", 502), origin);
  }

  const facilitiesById = new Map(facilityPayload.facilities.map((facility) => [facility.id, facility]));
  const selected = requestedIds.map((id) => facilitiesById.get(id));
  if (selected.some((facility) => !facility)) {
    return withCors(errorResponse("UNKNOWN_FACILITY", "현재 공식 목록에 없는 시설이 포함되어 있습니다.", 400), origin);
  }

  const fetchedAt = new Date();
  const now = seoulDateParts(fetchedAt);
  const dayNo = dayNoForDate(date);
  const cache = caches.default;
  const cachedEntries = await Promise.all(selected.map(async (facility) => {
    const cacheKey = facilityAvailabilityCacheKey(request.url, date, facility.id);
    const cached = await cache.match(cacheKey);
    if (!cached) return { facility, cacheKey, entry: null };

    try {
      const entry = await cached.json();
      if (!entry || entry.result?.id !== facility.id || !entry.fetchedAt || !entry.expiresAt) {
        return { facility, cacheKey, entry: null };
      }
      return { facility, cacheKey, entry };
    } catch {
      return { facility, cacheKey, entry: null };
    }
  }));

  const missingEntries = cachedEntries.filter(({ entry }) => !entry);
  const freshEntries = await mapWithConcurrency(missingEntries, UPSTREAM_CONCURRENCY, async ({ facility, cacheKey }) => {
    const result = await fetchFacilityAvailability(facility, date, dayNo, now);
    const entry = {
      fetchedAt: fetchedAt.toISOString(),
      expiresAt: new Date(fetchedAt.getTime() + AVAILABILITY_CACHE_SECONDS * 1000).toISOString(),
      result
    };
    return { facility, cacheKey, entry };
  });

  if (freshEntries.length > 0) {
    ctx.waitUntil(Promise.all(freshEntries.map(({ cacheKey, entry }) => {
      const cacheResponse = jsonResponse(entry, 200, {
        "Cache-Control": "public, max-age=0, s-maxage=" + AVAILABILITY_CACHE_SECONDS
      });
      return cache.put(cacheKey, cacheResponse);
    })));
  }

  const freshEntriesById = new Map(freshEntries.map(({ facility, entry }) => [facility.id, entry]));
  const entries = cachedEntries.map(({ facility, entry }) => entry || freshEntriesById.get(facility.id));
  const oldestFetchedAt = entries.reduce((oldest, entry) => (
    entry.fetchedAt < oldest ? entry.fetchedAt : oldest
  ), entries[0].fetchedAt);
  const earliestExpiresAt = entries.reduce((earliest, entry) => (
    entry.expiresAt < earliest ? entry.expiresAt : earliest
  ), entries[0].expiresAt);
  const cacheHitCount = cachedEntries.length - missingEntries.length;
  const cacheStatus = cacheHitCount === cachedEntries.length
    ? "HIT"
    : cacheHitCount === 0
      ? "MISS"
      : "PARTIAL";
  const payload = {
    date,
    fetchedAt: oldestFetchedAt,
    expiresAt: earliestExpiresAt,
    results: entries.map((entry) => refreshStartedSessions(entry.result, date, now))
  };
  const response = jsonResponse(payload, 200, {
    "Cache-Control": "public, max-age=60, s-maxage=" + AVAILABILITY_CACHE_SECONDS
  });
  return withCors(response, origin, cacheStatus);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request);

    if (request.method === "OPTIONS") return handleOptions(origin);
    if (request.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", "GET 요청만 허용합니다.", 405);
    if (url.pathname.startsWith("/api/") && origin === false) {
      return errorResponse("ORIGIN_NOT_ALLOWED", "허용되지 않은 요청 출처입니다.", 403);
    }

    if (url.pathname === "/api/health") {
      return withCors(jsonResponse({ ok: true, service: "seoul-kids-cafe-availability" }, 200, {
        "Cache-Control": "no-store"
      }), origin);
    }
    if (url.pathname === "/api/facilities" || url.pathname === "/api/v2/facilities") {
      return handleFacilities(request, ctx, origin);
    }
    if (url.pathname === "/api/availability") return handleAvailability(request, ctx, origin);

    return jsonResponse({
      name: "서울형 키즈카페 빈자리 조회 API",
      endpoints: ["/api/health", "/api/v2/facilities", "/api/availability?date=YYYY-MM-DD&ids=FACILITY_ID"]
    });
  }
};

export {
  dayNoForDate,
  normalizeSession,
  parseFacilities,
  parseFacilityMetadataPage,
  refreshStartedSessions
};
