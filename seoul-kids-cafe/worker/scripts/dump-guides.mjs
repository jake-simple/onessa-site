// 서울형 키즈카페 전 지점의 공식 이용안내에서 "주차"가 들어간 문장을 모아 JSON으로 뽑는다.
// parking-data.js를 갱신할 때 쓰는 개발용 스크립트이며, 워커 런타임에는 포함되지 않는다.
//
//   cd seoul-kids-cafe/worker
//   npm run guides:dump              # guides.json 으로 저장
//   npm run guides:dump -- 경로.json  # 저장 위치 지정
//
// 결과 JSON: [{ id, name, district, guideUrl, parkingLines: [...] }]
// parkingLines 가 빈 배열이면 안내문에 주차 이야기가 없다는 뜻이다.

import { writeFile } from "node:fs/promises";
import { parseFacilities } from "../worker.js";

const SOURCE_ORIGIN = "https://umppa.seoul.go.kr";
const FACILITY_PAGE = SOURCE_ORIGIN + "/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=SC251201&q_fcltyStle=";
const FACILITY_GUIDE_ENDPOINT = SOURCE_ORIGIN + "/icare/user/kidsCafe/BD_selectKidsCafeView.do";
const CONCURRENCY = 4;
const TIMEOUT_MS = 20000;
const RETRIES = 2;
const REQUEST_HEADERS = {
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "ko-KR,ko;q=0.9"
};

function guideUrl(facilityId) {
  return FACILITY_GUIDE_ENDPOINT + "?q_fcltyId=" + encodeURIComponent(facilityId) + "&q_fcltyStle=";
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

function textLines(html) {
  const withBreaks = html
    .replace(/<(script|style|head|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(?:p|li|dd|dt|div|td|th|tr|h[1-6]|section|article)\s*>/gi, "\n");

  return decodeHtml(withBreaks.replace(/<[^>]*>/g, " "))
    .split("\n")
    .flatMap((line) => line.split(/(?<=다\.)\s+/))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
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

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const outputPath = process.argv[2] || "guides.json";
const facilities = parseFacilities(await fetchText(FACILITY_PAGE));
console.error(`시설 ${facilities.length}곳의 이용안내를 읽는 중…`);

const dumped = await mapWithConcurrency(facilities, CONCURRENCY, async (facility, index) => {
  const url = guideUrl(facility.id);
  try {
    const parkingLines = textLines(await fetchText(url)).filter((line) => line.includes("주차"));
    console.error(`  [${index + 1}/${facilities.length}] ${facility.id} ${facility.name} · 주차 문장 ${parkingLines.length}개`);
    return { id: facility.id, name: facility.name, district: facility.district, guideUrl: url, parkingLines };
  } catch (error) {
    console.error(`  [${index + 1}/${facilities.length}] ${facility.id} ${facility.name} · 실패: ${error.message}`);
    return { id: facility.id, name: facility.name, district: facility.district, guideUrl: url, error: String(error.message || error) };
  }
});

await writeFile(outputPath, JSON.stringify(dumped, null, 2) + "\n", "utf-8");
const failed = dumped.filter((entry) => entry.error).length;
const mentioned = dumped.filter((entry) => entry.parkingLines?.length).length;
console.error(`\n${outputPath} 저장 완료 · 주차 문구 있음 ${mentioned}곳 · 읽기 실패 ${failed}곳`);
