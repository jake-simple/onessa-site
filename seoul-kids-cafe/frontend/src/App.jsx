import {useEffect, useMemo, useRef, useState} from "react";
import {AppShell} from "@astryxdesign/core/AppShell";
import {AspectRatio} from "@astryxdesign/core/AspectRatio";
import {Banner} from "@astryxdesign/core/Banner";
import {Button} from "@astryxdesign/core/Button";
import {CheckboxInput} from "@astryxdesign/core/CheckboxInput";
import {DateInput} from "@astryxdesign/core/DateInput";
import {EmptyState} from "@astryxdesign/core/EmptyState";
import {Grid} from "@astryxdesign/core/Grid";
import {Heading} from "@astryxdesign/core/Heading";
import {InternationalizationProvider} from "@astryxdesign/core/i18n";
import {Link} from "@astryxdesign/core/Link";
import {List, ListItem} from "@astryxdesign/core/List";
import {MultiSelector} from "@astryxdesign/core/MultiSelector";
import {NumberInput} from "@astryxdesign/core/NumberInput";
import {Section} from "@astryxdesign/core/Section";
import {Spinner} from "@astryxdesign/core/Spinner";
import {HStack, VStack} from "@astryxdesign/core/Stack";
import {Text} from "@astryxdesign/core/Text";
import {Theme} from "@astryxdesign/core/theme";
import {ToggleButton} from "@astryxdesign/core/ToggleButton";
import {neutralTheme} from "@astryxdesign/theme-neutral/built";

const API_BASE = document.documentElement.dataset.apiBase?.replace(/\/$/, "")
  || ((location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:8787"
    : "");
const CHUNK_SIZE = 24;
const MAX_PARALLEL_CHUNKS = 2;
const RESULT_PAGE_SIZE = 10;
const MIN_SEATS = 1;
const MAX_SEATS = 10;
const SEATS_STORAGE_KEY = "kidsCafeSeatsV2";
const DISTRICTS_STORAGE_KEY = "kidsCafeDistricts";
const FAVORITES_STORAGE_KEY = "kidsCafeFavoritesV1";
const KOREAN_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const OFFICIAL_FACILITY_GUIDE_BASE = "https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do";
const NAVER_MAP_SEARCH_BASE = "https://map.naver.com/p/search";
const RESULT_ACTION_LINK_STYLE = {
  alignItems: "center",
  backgroundColor: "var(--color-background-surface)",
  borderColor: "var(--color-border-emphasized)",
  borderRadius: "var(--radius-element)",
  borderStyle: "solid",
  borderWidth: "var(--border-width)",
  boxSizing: "border-box",
  color: "var(--color-text-primary)",
  justifyContent: "center",
  minHeight: "var(--size-element-md)",
  paddingInline: "var(--spacing-2)",
  whiteSpace: "nowrap",
  width: "100%"
};
const RESULT_PRIMARY_ACTION_LINK_STYLE = {
  ...RESULT_ACTION_LINK_STYLE,
  backgroundColor: "var(--color-accent)",
  borderColor: "var(--color-accent)",
  color: "var(--color-on-accent)"
};
const ASTRYX_KOREAN_OVERRIDES = {
  "ko-KR": {
    "@astryx.appShell.skipToContent": "본문으로 건너뛰기",
    "@astryx.button.loading": "처리 중",
    "@astryx.calendar.previousMonth": "이전 달",
    "@astryx.calendar.nextMonth": "다음 달",
    "@astryx.calendar.daySelected": "{date}, 선택됨",
    "@astryx.dateInput.dialogLabel": "날짜 선택",
    "@astryx.dateInput.closeCalendar": "달력 닫기",
    "@astryx.dateInput.openCalendar": "달력 열기",
    "@astryx.dateInput.toggleCalendarClose": "달력 닫기",
    "@astryx.multiSelector.searchOptions": "지역 옵션 검색",
    "@astryx.multiSelector.selectPlaceholder": "지역 선택…",
    "@astryx.multiSelector.clearAll": "{label} 선택 모두 지우기",
    "@astryx.typeahead.emptySearchResults": "검색 결과가 없습니다"
  }
};

function localizeCalendarWeekdays() {
  document.querySelectorAll(".astryx-calendar").forEach((calendar) => {
    calendar.querySelectorAll('[role="columnheader"]').forEach((header, index) => {
      const label = KOREAN_WEEKDAY_LABELS[index];
      if (label && header.textContent !== label) header.textContent = label;
    });
  });
}

function seoulDateString(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = {};
  parts.forEach((part) => {
    if (part.type !== "literal") values[part.type] = part.value;
  });
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatSearchDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date(`${dateString}T12:00:00+09:00`));
}

function formatFetchedAt(isoString) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function readSavedSeats() {
  try {
    const saved = Number(localStorage.getItem(SEATS_STORAGE_KEY));
    if (saved >= MIN_SEATS && saved <= MAX_SEATS) return saved;
  } catch {
    // 브라우저 저장소가 차단돼도 현재 검색은 그대로 동작한다.
  }
  return MIN_SEATS;
}

function readSavedDistricts() {
  try {
    const saved = JSON.parse(localStorage.getItem(DISTRICTS_STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) return saved.filter((district) => typeof district === "string");
  } catch {
    // 브라우저 저장소가 차단돼도 현재 검색은 그대로 동작한다.
  }
  return [];
}

function readSavedFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) return [...new Set(saved.filter((id) => typeof id === "string"))];
  } catch {
    // 브라우저 저장소가 차단돼도 검색과 현재 화면은 그대로 동작한다.
  }
  return [];
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    method: "GET",
    headers: {Accept: "application/json"},
    signal
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "조회 요청에 실패했습니다.";
    throw new Error(message);
  }
  return data;
}

function chunksOf(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function officialFacilityGuideUrl(facilityId) {
  return `${OFFICIAL_FACILITY_GUIDE_BASE}?q_fcltyId=${encodeURIComponent(facilityId)}&q_fcltyStle=`;
}

function naverMapSearchUrl(facility) {
  return `${NAVER_MAP_SEARCH_BASE}/${encodeURIComponent(`서울형 키즈카페 ${facility.name}`)}`;
}

function sessionSortValue(session) {
  return session.startsAt || "9999";
}

function seoulTimeString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => (
    [part.type, part.value]
  )));
  return `${values.hour}:${values.minute}`;
}

function matchingSessions(result, requiredSeats, searchDate, now) {
  const isToday = searchDate === seoulDateString(now);
  const nowTime = isToday ? seoulTimeString(now) : "";
  return (result.sessions || []).filter((session) => (
    session.status === "available"
      && session.audience !== "group"
      && Number(session.remainingSeats) >= requiredSeats
      && (!isToday || (session.startsAt && session.startsAt > nowTime))
  )).sort((a, b) => sessionSortValue(a).localeCompare(sessionSortValue(b)));
}

function facilityCapacityText(capacity) {
  const labels = [];
  if (Number.isFinite(capacity?.individual)) labels.push(`개인 ${capacity.individual}명`);
  if (Number.isFinite(capacity?.group)) labels.push(`단체 ${capacity.group}명`);
  return labels.join(" · ");
}

function FavoriteStarOutlineIcon() {
  return (
    <svg className="kids-cafe-favorite-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
    </svg>
  );
}

function FavoriteStarSolidIcon() {
  return (
    <svg className="kids-cafe-favorite-icon kids-cafe-favorite-icon--active" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
    </svg>
  );
}

function FacilityResults({entries, favoriteIds, onFavoriteChange}) {
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
  const loadMoreRef = useRef(null);
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const visibleEntries = entries.slice(0, visibleCount);
  const hasMore = visibleCount < entries.length;

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisibleCount((current) => Math.min(current + RESULT_PAGE_SIZE, entries.length));
    }, {rootMargin: "240px 0px"});

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [entries.length, hasMore]);

  return (
    <VStack gap={5}>
      <List hasDividers density="spacious" header={<Heading level={2}>예약 가능한 시설</Heading>}>
        {visibleEntries.map(({result, sessions}) => {
          const capacityText = facilityCapacityText(result.capacity);
          return (
            <ListItem
              key={result.id}
              className="kids-cafe-result-item"
              startContent={(
                <AspectRatio ratio={4 / 3} fit="cover" className="kids-cafe-result-item__thumbnail">
                  {result.thumbnailUrl ? (
                    <img src={result.thumbnailUrl} alt={`${result.name} 시설 사진`} loading="lazy" />
                  ) : (
                    <HStack
                      width="100%"
                      height="100%"
                      hAlign="center"
                      vAlign="center"
                      className="kids-cafe-result-thumbnail__placeholder"
                    >
                      <Text type="supporting" color="secondary">사진 없음</Text>
                    </HStack>
                  )}
                </AspectRatio>
              )}
              label={(
                <Text type="large" weight="semibold" color="primary">
                  {result.name}
                </Text>
              )}
              endContent={(
                <ToggleButton
                  label={`${result.name} 즐겨찾기`}
                  tooltip={`${result.name} 즐겨찾기`}
                  icon={<FavoriteStarOutlineIcon />}
                  pressedIcon={<FavoriteStarSolidIcon />}
                  isIconOnly
                  size="lg"
                  isPressed={favoriteIdSet.has(result.id)}
                  onPressedChange={(isPressed) => onFavoriteChange(result.id, isPressed)}
                />
              )}
              description={
                <VStack gap={3}>
                  <VStack gap={1}>
                    {capacityText && (
                      <Text type="label" hasTabularNumbers>
                        이용 정원 · {capacityText}
                      </Text>
                    )}
                    {result.address && (
                      <Text type="supporting" color="secondary">
                        주소 · {result.address}
                      </Text>
                    )}
                    <Text type="supporting" color="secondary">
                      {result.district} · {sessions.length}개 회차
                    </Text>
                  </VStack>
                  <VStack gap={1.5}>
                    {sessions.map((session) => (
                      <HStack key={`${result.id}-${session.id || session.startsAt}`} gap={2} wrap="wrap" vAlign="center">
                        <Text type="label" hasTabularNumbers>
                          {session.startsAt}–{session.endsAt}
                        </Text>
                        <Text type="supporting">
                          {session.label}{session.category ? ` · ${session.category}` : ""}
                        </Text>
                        <Text type="label" color="accent" hasTabularNumbers>
                          {session.remainingSeats}자리 남음
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                  <Grid columns={{minWidth: 112, max: 3, repeat: "fit"}} gap={2} width="100%" maxWidth={440}>
                    <Link
                      href={officialFacilityGuideUrl(result.id)}
                      target="_blank"
                      isStandalone
                      aria-label="이용 안내 (새 창에서 열림)"
                      color="inherit"
                      style={RESULT_ACTION_LINK_STYLE}
                    >
                      이용 안내
                    </Link>
                    <Link
                      href={result.officialReservationUrl}
                      target="_blank"
                      isStandalone
                      aria-label="공식 사이트 예약 (새 창에서 열림)"
                      color="inherit"
                      style={RESULT_PRIMARY_ACTION_LINK_STYLE}
                    >
                      공식 사이트 예약
                    </Link>
                    <Link
                      href={naverMapSearchUrl(result)}
                      target="_blank"
                      isStandalone
                      label="네이버 지도에서 보기 (새 창에서 열림)"
                      tooltip="네이버 지도에서 보기"
                      color="inherit"
                      style={RESULT_ACTION_LINK_STYLE}
                    >
                      <img
                        src="/seoul-kids-cafe/naver-map-icon-v1.png"
                        alt=""
                        aria-hidden="true"
                        className="kids-cafe-naver-map-icon"
                      />
                    </Link>
                  </Grid>
                </VStack>
              }
            />
          );
        })}
      </List>
      {hasMore && (
        <HStack
          ref={loadMoreRef}
          width="100%"
          hAlign="center"
          aria-label="다음 시설 불러오기"
          className="kids-cafe-results-load-sentinel"
        >
          <Spinner size="sm" label="다음 시설 불러오는 중" />
        </HStack>
      )}
    </VStack>
  );
}

export default function App() {
  const today = useMemo(() => seoulDateString(new Date()), []);
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState(readSavedSeats);
  const [facilities, setFacilities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [selectedDistricts, setSelectedDistricts] = useState(readSavedDistricts);
  const [favoriteIds, setFavoriteIds] = useState(readSavedFavorites);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [facilityState, setFacilityState] = useState("loading");
  const [facilityError, setFacilityError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({checked: 0, total: 0});
  const [failedCount, setFailedCount] = useState(0);
  const [fetchedTimes, setFetchedTimes] = useState([]);
  const [activeCriteria, setActiveCriteria] = useState(null);
  const activeController = useRef(null);
  const searchSequence = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(SEATS_STORAGE_KEY, String(seats));
    } catch {
      // 저장 실패는 현재 검색에 영향을 주지 않는다.
    }
  }, [seats]);

  useEffect(() => {
    try {
      localStorage.setItem(DISTRICTS_STORAGE_KEY, JSON.stringify(selectedDistricts));
    } catch {
      // 저장 실패는 현재 검색에 영향을 주지 않는다.
    }
  }, [selectedDistricts]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      // 저장 실패는 현재 화면의 즐겨찾기 상태에 영향을 주지 않는다.
    }
  }, [favoriteIds]);

  useEffect(() => {
    if (favoriteIds.length === 0) setFavoritesOnly(false);
  }, [favoriteIds.length]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFacilities() {
      if (!API_BASE) throw new Error("실시간 조회 API가 연결되지 않았습니다.");
      const payload = await fetchJson(`${API_BASE}/api/v2/facilities`, controller.signal);
      const loadedFacilities = payload.facilities || [];
      const loadedFacilityIds = new Set(loadedFacilities.map((facility) => facility.id));
      setFacilities(loadedFacilities);
      setDistricts(payload.districts || []);
      setSelectedDistricts((current) => current.filter((district) => (
        (payload.districts || []).includes(district)
      )));
      setFavoriteIds((current) => current.filter((id) => loadedFacilityIds.has(id)));
      setFacilityState("ready");
    }

    loadFacilities().catch((error) => {
      if (error.name === "AbortError") return;
      setFacilityError(error.message || "시설 목록을 불러오지 못했습니다.");
      setFacilityState("error");
    });

    return () => controller.abort();
  }, []);

  useEffect(() => () => activeController.current?.abort(), []);

  useEffect(() => {
    localizeCalendarWeekdays();
    const observer = new MutationObserver(localizeCalendarWeekdays);
    observer.observe(document.body, {childList: true, subtree: true});
    return () => observer.disconnect();
  }, []);

  const requiredSeats = activeCriteria?.seats ?? seats;
  const resultDate = activeCriteria?.date ?? date;
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const facilitiesById = useMemo(() => new Map(
    facilities.map((facility) => [facility.id, facility])
  ), [facilities]);
  const entries = useMemo(() => {
    const now = new Date();
    return results.filter((result) => (
      !activeCriteria?.favoritesOnly || favoriteIdSet.has(result.id)
    )).map((result) => {
      const facility = facilitiesById.get(result.id);
      return {
        result: facility ? {...result, ...facility, sessions: result.sessions} : result,
        sessions: matchingSessions(result, requiredSeats, resultDate, now)
      };
    }).filter((entry) => entry.sessions.length > 0).sort((a, b) => {
      const timeOrder = sessionSortValue(a.sessions[0]).localeCompare(sessionSortValue(b.sessions[0]));
      return timeOrder || a.result.name.localeCompare(b.result.name, "ko");
    });
  }, [activeCriteria?.favoritesOnly, facilitiesById, favoriteIdSet, requiredSeats, resultDate, results]);

  const totalSessions = entries.reduce((total, entry) => total + entry.sessions.length, 0);
  const oldestFetchedAt = fetchedTimes.length > 0
    ? fetchedTimes.reduce((earliest, current) => (
      new Date(current) < new Date(earliest) ? current : earliest
    ))
    : "";

  async function searchAvailability(event) {
    event.preventDefault();
    if (facilityState !== "ready" || facilities.length === 0) return;

    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const sequence = ++searchSequence.current;
    const facilitiesInDistricts = favoritesOnly || selectedDistricts.length === 0
      ? facilities
      : facilities.filter((facility) => selectedDistricts.includes(facility.district));
    const selectedFacilities = favoritesOnly
      ? facilitiesInDistricts.filter((facility) => favoriteIdSet.has(facility.id))
      : facilitiesInDistricts;
    const criteria = {
      date,
      seats,
      districts: favoritesOnly ? [] : [...selectedDistricts],
      favoritesOnly
    };
    const chunks = chunksOf(selectedFacilities, CHUNK_SIZE);
    let nextChunkIndex = 0;
    let checkedCount = 0;
    let failures = 0;
    let collectedResults = [];
    let collectedTimes = [];

    setActiveCriteria(criteria);
    setHasSearched(true);
    setIsSearching(true);
    setResults([]);
    setProgress({checked: 0, total: selectedFacilities.length});
    setFailedCount(0);
    setFetchedTimes([]);

    async function runNextChunk() {
      while (nextChunkIndex < chunks.length) {
        const chunk = chunks[nextChunkIndex++];
        const ids = chunk.map((facility) => facility.id).join(",");
        const url = `${API_BASE}/api/availability?date=${encodeURIComponent(date)}&ids=${encodeURIComponent(ids)}`;

        try {
          const payload = await fetchJson(url, controller.signal);
          if (sequence !== searchSequence.current) return;
          collectedResults = collectedResults.concat(payload.results || []);
          if (payload.fetchedAt) collectedTimes.push(payload.fetchedAt);
          failures += (payload.results || []).filter((result) => Boolean(result.error)).length;
        } catch (error) {
          if (error.name === "AbortError") return;
          failures += chunk.length;
        }

        checkedCount += chunk.length;
        setResults([...collectedResults]);
        setFetchedTimes([...collectedTimes]);
        setFailedCount(failures);
        setProgress({checked: checkedCount, total: selectedFacilities.length});
      }
    }

    try {
      const workers = [];
      const workerCount = Math.min(MAX_PARALLEL_CHUNKS, chunks.length);
      for (let index = 0; index < workerCount; index += 1) workers.push(runNextChunk());
      await Promise.all(workers);
    } finally {
      if (sequence === searchSequence.current && !controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }

  const conditionDistricts = activeCriteria?.favoritesOnly
    ? "즐겨찾기 전체"
    : activeCriteria?.districts.length
    ? activeCriteria.districts.join(", ")
    : "전체 서울";

  function updateFavorite(facilityId, isFavorite) {
    setFavoriteIds((current) => (
      isFavorite
        ? [...new Set([...current, facilityId])]
        : current.filter((id) => id !== facilityId)
    ));
  }

  return (
    <Theme theme={neutralTheme} mode="light">
      <InternationalizationProvider
        locale="ko-KR"
        dir="ltr"
        overrides={ASTRYX_KOREAN_OVERRIDES}
      >
        <AppShell height="auto" variant="wash" contentPadding={0}>
          <HStack width="100%" hAlign="center">
            <VStack width="100%" maxWidth="60rem" gap={0}>
              <Section
                variant="muted"
                padding={6}
                paddingBlock={8}
                dividers={["bottom"]}
                className="kids-cafe-hero"
              >
                <HStack
                  aria-hidden="true"
                  className="kids-cafe-hero__shape kids-cafe-hero__shape--sun"
                />
                <HStack
                  aria-hidden="true"
                  className="kids-cafe-hero__shape kids-cafe-hero__shape--play"
                />
                <VStack as="header" gap={4} maxWidth="42rem" className="kids-cafe-hero__content">
                  <Link href="https://onessa.app" isStandalone>onessa</Link>
                  <VStack gap={2}>
                    <Text type="label" color="accent" className="kids-cafe-hero__eyebrow">
                      서울형 키즈카페
                    </Text>
                    <Heading level={1} type="display-1" textWrap="balance">
                      오늘, 아이들과<br />갈 수 있는 곳만.
                    </Heading>
                    <Text type="large" color="secondary">
                      시설마다 들어가 보지 말고, 필요한 자리만 한 번에 찾아보세요.
                    </Text>
                  </VStack>
                </VStack>
              </Section>

              <Section variant="section" padding={6} dividers={["bottom"]}>
                <VStack gap={6}>
                  <VStack gap={1}>
                    <Heading level={2}>언제, 몇 자리 필요한가요?</Heading>
                    <Text type="supporting">회원가입 없이 바로 확인할 수 있어요.</Text>
                  </VStack>

                  {facilityState === "error" && (
                    <Banner
                      status="error"
                      title="시설 목록을 불러오지 못했습니다"
                      description={facilityError}
                    />
                  )}

                  <form onSubmit={searchAvailability}>
                    <VStack gap={4}>
                      <Grid columns={{minWidth: 240, max: 3, repeat: "fit"}} gap={4}>
                        <DateInput
                          label="날짜"
                          value={date}
                          onChange={(nextDate) => nextDate && setDate(nextDate)}
                          min={today}
                          max={addDays(today, 62)}
                          format={formatSearchDate}
                          placeholder="날짜 선택"
                          width="100%"
                        />
                        <NumberInput
                          label="필요한 좌석"
                          value={seats}
                          onChange={(value) => setSeats(Math.max(MIN_SEATS, Math.min(MAX_SEATS, value)))}
                          min={MIN_SEATS}
                          max={MAX_SEATS}
                          step={1}
                          units="자리"
                          width="100%"
                          isIntegerOnly
                        />
                        <VStack gap={1}>
                          <MultiSelector
                            label="지역"
                            options={districts}
                            value={favoritesOnly ? [] : selectedDistricts}
                            onChange={setSelectedDistricts}
                            placeholder={favoritesOnly ? "즐겨찾기 전체" : "전체 서울"}
                            triggerDisplay="badges"
                            maxBadges={2}
                            hasSearch
                            searchPlaceholder="지역 검색…"
                            width="100%"
                            isLoading={facilityState === "loading"}
                            isDisabled={facilityState !== "ready" || favoritesOnly}
                            disabledMessage={favoritesOnly
                              ? "즐겨찾기만 확인할 때는 지역 필터를 사용하지 않습니다."
                              : "시설 목록을 불러온 뒤 선택할 수 있습니다."}
                          />
                        </VStack>
                      </Grid>
                      <CheckboxInput
                        label={`즐겨찾기만 확인 (${favoriteIds.length})`}
                        value={favoritesOnly}
                        onChange={setFavoritesOnly}
                        isDisabled={favoriteIds.length === 0}
                        disabledMessage="검색 결과에서 별 아이콘을 눌러 시설을 즐겨찾기에 추가해 주세요."
                        size="sm"
                      />
                      <Button
                        label="빈자리 찾기"
                        type="submit"
                        variant="primary"
                        size="lg"
                        width="100%"
                        isLoading={isSearching}
                        isDisabled={facilityState !== "ready"}
                      />
                    </VStack>
                  </form>

                  <Text type="supporting" color="secondary">
                    {facilityState === "ready"
                      ? `${facilities.length}개 통합 예약 시설을 확인합니다. 잔여석은 최대 2분 전 정보입니다.`
                      : "시설 목록을 불러오고 있습니다."}
                  </Text>
                </VStack>
              </Section>

              {hasSearched && activeCriteria && (
                <Section variant="section" padding={6} dividers={["bottom"]}>
                  <VStack gap={5}>
                    <HStack gap={4} hAlign="between" vAlign="start" wrap="wrap">
                      <VStack gap={1}>
                        <Text type="label" color="accent">검색 결과</Text>
                        <Heading level={2}>{entries.length}곳 · {totalSessions}개 회차</Heading>
                        <Text type="supporting">
                          {formatSearchDate(activeCriteria.date)} · {activeCriteria.seats}자리 이상 · {conditionDistricts}
                        </Text>
                      </VStack>
                      {oldestFetchedAt && (
                        <Text type="supporting">가장 오래된 정보 {formatFetchedAt(oldestFetchedAt)} 기준</Text>
                      )}
                    </HStack>

                    {isSearching && (
                      <Spinner
                        size="md"
                        label={`${progress.checked}/${progress.total}개 시설 확인 중`}
                      />
                    )}

                    {!isSearching && failedCount > 0 && (
                      <Banner
                        status="warning"
                        title={`${failedCount}개 시설은 확인하지 못했습니다`}
                        description="표시된 결과는 정상 조회된 시설 기준입니다."
                      />
                    )}

                    {!isSearching && entries.length === 0 ? (
                      <EmptyState
                        title="조건에 맞는 회차가 없습니다"
                        description="날짜, 필요한 좌석 수 또는 지역을 바꿔 다시 검색해 보세요."
                        headingLevel={3}
                      />
                    ) : (
                      entries.length > 0 && (
                        <FacilityResults
                          entries={entries}
                          favoriteIds={favoriteIds}
                          onFavoriteChange={updateFavorite}
                        />
                      )
                    )}

                    {!isSearching && entries.length > 0 && failedCount === 0 && (
                      <Text type="supporting">
                        공식 사이트에서 최종 좌석을 확인한 뒤 예약해 주세요.
                      </Text>
                    )}
                  </VStack>
                </Section>
              )}

              <Section variant="transparent" padding={6} dividers={["bottom"]}>
                <List
                  listStyle="decimal"
                  density="spacious"
                  hasDividers
                  header={<Heading level={2}>검색은 여기서, 예약은 공식 사이트에서.</Heading>}
                >
                  <ListItem label="조건 선택" description="날짜, 필요한 좌석 수와 여러 지역을 고릅니다." />
                  <ListItem label="빈자리 확인" description="선택한 좌석 수 이상 남은 회차만 확인합니다." />
                  <ListItem label="직접 예약" description="서울시 공식 예약 페이지로 이동해 직접 예약합니다." />
                </List>
              </Section>

              <Section variant="muted" padding={6}>
                <VStack as="footer" gap={2}>
                  <Text type="label">꼭 확인해 주세요.</Text>
                  <Text type="supporting">
                    이 사이트는 서울시 공식 서비스가 아닌 빈자리 검색 보조 도구입니다. 실제 예약 가능 여부는 공식 예약 화면에서 최종 확인해 주세요.
                  </Text>
                  <Text type="supporting">자동 예약, 회원가입, 개인정보 수집을 하지 않습니다.</Text>
                  <Link
                    href="https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeList.do"
                    isExternalLink
                    isStandalone
                    newTabLabel="(새 창에서 열림)"
                  >
                    서울형 키즈카페 공식 목록
                  </Link>
                </VStack>
              </Section>
            </VStack>
          </HStack>
        </AppShell>
      </InternationalizationProvider>
    </Theme>
  );
}
