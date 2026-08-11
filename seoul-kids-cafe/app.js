(function () {
  "use strict";

  var API_BASE = document.documentElement.dataset.apiBase.replace(/\/$/, "");
  if (!API_BASE && (location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    API_BASE = "http://localhost:8787";
  }
  var CHUNK_SIZE = 24;
  var MAX_PARALLEL_CHUNKS = 2;
  var MIN_SEATS = 1;
  var MAX_SEATS = 10;

  var form = document.getElementById("searchForm");
  var dateInput = document.getElementById("dateInput");
  var seatInput = document.getElementById("seatInput");
  var seatCount = document.getElementById("seatCount");
  var decreaseSeats = document.getElementById("decreaseSeats");
  var increaseSeats = document.getElementById("increaseSeats");
  var districtInput = document.getElementById("districtInput");
  var searchButton = document.getElementById("searchButton");
  var searchNote = document.querySelector(".search-note");
  var resultsSection = document.getElementById("resultsSection");
  var resultCondition = document.getElementById("resultCondition");
  var resultsTitle = document.getElementById("resultsTitle");
  var updatedAt = document.getElementById("updatedAt");
  var statusMessage = document.getElementById("statusMessage");
  var resultList = document.getElementById("resultList");
  var facilityTemplate = document.getElementById("facilityTemplate");

  var facilities = [];
  var activeController = null;
  var searchSequence = 0;

  function seoulDateString(date) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    var values = {};
    parts.forEach(function (part) {
      if (part.type !== "literal") values[part.type] = part.value;
    });
    return values.year + "-" + values.month + "-" + values.day;
  }

  function addDays(dateString, days) {
    var date = new Date(dateString + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function formatSearchDate(dateString) {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(new Date(dateString + "T12:00:00+09:00"));
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
      var saved = Number(localStorage.getItem("kidsCafeSeats"));
      if (saved >= MIN_SEATS && saved <= MAX_SEATS) return saved;
    } catch (error) {
      // 로컬 저장이 차단돼도 검색 기능은 그대로 동작한다.
    }
    return 3;
  }

  function setSeats(value) {
    var next = Math.max(MIN_SEATS, Math.min(MAX_SEATS, Number(value) || MIN_SEATS));
    seatInput.value = String(next);
    seatCount.textContent = String(next);
    decreaseSeats.disabled = next <= MIN_SEATS;
    increaseSeats.disabled = next >= MAX_SEATS;
    try {
      localStorage.setItem("kidsCafeSeats", String(next));
    } catch (error) {
      // 저장 실패는 현재 검색에 영향을 주지 않는다.
    }
  }

  function setLoading(isLoading) {
    searchButton.disabled = isLoading;
    searchButton.querySelector("span:first-child").textContent = isLoading ? "확인하는 중" : "빈자리 찾기";
  }

  function setStatus(message, type) {
    statusMessage.className = "status" + (type ? " status--" + type : "");
    statusMessage.textContent = message;
  }

  async function fetchJson(url, signal) {
    var response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: signal
    });
    var data = await response.json().catch(function () { return null; });
    if (!response.ok) {
      var message = data && data.error && data.error.message
        ? data.error.message
        : "조회 요청에 실패했습니다.";
      throw new Error(message);
    }
    return data;
  }

  function populateDistricts(districts) {
    districts.forEach(function (district) {
      var option = document.createElement("option");
      option.value = district;
      option.textContent = district;
      districtInput.appendChild(option);
    });
    districtInput.disabled = false;
  }

  async function loadFacilities() {
    if (!API_BASE) {
      searchButton.disabled = true;
      searchNote.textContent = "실시간 조회 API 주소가 아직 연결되지 않았습니다.";
      throw new Error("실시간 조회 API가 연결되지 않았습니다.");
    }

    var payload = await fetchJson(API_BASE + "/api/facilities");
    facilities = payload.facilities || [];
    populateDistricts(payload.districts || []);
    searchNote.textContent = facilities.length + "개 통합 예약 시설을 날짜별로 나누어 확인합니다. 잔여석은 최대 2분 전 정보입니다.";
  }

  function chunksOf(items, size) {
    var chunks = [];
    for (var i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  function matchingSessions(result, requiredSeats) {
    return (result.sessions || []).filter(function (session) {
      return session.status === "available"
        && session.audience !== "group"
        && Number(session.remainingSeats) >= requiredSeats;
    });
  }

  function sessionSortValue(session) {
    return session.startsAt || "9999";
  }

  function renderResults(allResults, requiredSeats, fetchedTimes, isComplete) {
    var matches = allResults.map(function (result) {
      return {
        result: result,
        sessions: matchingSessions(result, requiredSeats).sort(function (a, b) {
          return sessionSortValue(a).localeCompare(sessionSortValue(b));
        })
      };
    }).filter(function (entry) {
      return entry.sessions.length > 0;
    });

    matches.sort(function (a, b) {
      var timeOrder = sessionSortValue(a.sessions[0]).localeCompare(sessionSortValue(b.sessions[0]));
      if (timeOrder !== 0) return timeOrder;
      return a.result.name.localeCompare(b.result.name, "ko");
    });

    resultList.replaceChildren();
    var totalSessions = 0;

    matches.forEach(function (entry) {
      totalSessions += entry.sessions.length;
      var fragment = facilityTemplate.content.cloneNode(true);
      var card = fragment.querySelector(".facility-card");
      card.querySelector(".facility-card__district").textContent = entry.result.district;
      card.querySelector(".facility-card__name").textContent = entry.result.name;
      card.querySelector(".facility-card__count").textContent = entry.sessions.length + "개 회차";

      var sessionList = card.querySelector(".session-list");
      entry.sessions.forEach(function (session) {
        var item = document.createElement("li");
        item.className = "session";

        var label = document.createElement("span");
        label.className = "session__label";
        label.textContent = session.label + (session.category ? " · " + session.category : "");

        var time = document.createElement("span");
        time.className = "session__time";
        time.textContent = session.startsAt + "–" + session.endsAt;

        var seats = document.createElement("span");
        seats.className = "session__seats";
        seats.textContent = session.remainingSeats + "자리 남음";

        item.append(label, time, seats);
        sessionList.appendChild(item);
      });

      var link = card.querySelector(".reservation-link");
      link.href = entry.result.officialReservationUrl;
      link.setAttribute("aria-label", entry.result.name + " 공식 사이트에서 예약(새 창)");
      resultList.appendChild(fragment);
    });

    if (fetchedTimes.length > 0) {
      var oldest = fetchedTimes.reduce(function (earliest, current) {
        return new Date(current) < new Date(earliest) ? current : earliest;
      });
      updatedAt.textContent = "가장 오래된 정보 " + formatFetchedAt(oldest) + " 기준";
    } else {
      updatedAt.textContent = "";
    }

    resultsTitle.textContent = matches.length + "곳 · " + totalSessions + "개 회차";

    if (isComplete && matches.length === 0) {
      setStatus("선택한 조건에 맞는 회차가 없습니다. 날짜나 필요한 좌석 수를 바꿔보세요.", "empty");
    }
  }

  async function searchAvailability() {
    if (facilities.length === 0) {
      setStatus("시설 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
      return;
    }

    if (activeController) activeController.abort();
    activeController = new AbortController();
    var signal = activeController.signal;
    var sequence = ++searchSequence;

    var date = dateInput.value;
    var requiredSeats = Number(seatInput.value);
    var district = districtInput.value;
    var selectedFacilities = district === "all"
      ? facilities
      : facilities.filter(function (facility) { return facility.district === district; });
    var chunks = chunksOf(selectedFacilities, CHUNK_SIZE);
    var nextChunkIndex = 0;
    var checkedCount = 0;
    var failedCount = 0;
    var allResults = [];
    var fetchedTimes = [];

    resultsSection.hidden = false;
    resultCondition.textContent = formatSearchDate(date) + " · " + requiredSeats + "자리 이상" + (district === "all" ? "" : " · " + district);
    resultsTitle.textContent = "예약 가능한 회차";
    updatedAt.textContent = "";
    resultList.replaceChildren();
    setStatus(selectedFacilities.length + "개 시설을 확인하고 있습니다. 결과가 확인되는 대로 보여드릴게요.");
    setLoading(true);

    requestAnimationFrame(function () {
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    async function runNextChunk() {
      while (nextChunkIndex < chunks.length) {
        var chunk = chunks[nextChunkIndex++];
        var ids = chunk.map(function (facility) { return facility.id; }).join(",");
        var url = API_BASE + "/api/availability?date=" + encodeURIComponent(date) + "&ids=" + encodeURIComponent(ids);

        try {
          var payload = await fetchJson(url, signal);
          if (sequence !== searchSequence) return;
          allResults = allResults.concat(payload.results || []);
          fetchedTimes.push(payload.fetchedAt);
          failedCount += (payload.results || []).filter(function (result) { return Boolean(result.error); }).length;
        } catch (error) {
          if (error.name === "AbortError") return;
          failedCount += chunk.length;
        }

        checkedCount += chunk.length;
        renderResults(allResults, requiredSeats, fetchedTimes, false);
        setStatus(checkedCount + "/" + selectedFacilities.length + "개 시설 확인 중");
      }
    }

    try {
      var workers = [];
      var workerCount = Math.min(MAX_PARALLEL_CHUNKS, chunks.length);
      for (var i = 0; i < workerCount; i += 1) workers.push(runNextChunk());
      await Promise.all(workers);

      if (sequence !== searchSequence || signal.aborted) return;
      renderResults(allResults, requiredSeats, fetchedTimes, true);

      if (failedCount > 0) {
        setStatus(failedCount + "개 시설은 현재 확인하지 못했습니다. 표시된 결과는 정상 조회된 시설 기준입니다.", "notice");
      } else if (resultList.children.length > 0) {
        setStatus("공식 사이트에서 최종 좌석을 확인한 뒤 예약해 주세요.");
      }
    } finally {
      if (sequence === searchSequence) setLoading(false);
    }
  }

  decreaseSeats.addEventListener("click", function () {
    setSeats(Number(seatInput.value) - 1);
  });

  increaseSeats.addEventListener("click", function () {
    setSeats(Number(seatInput.value) + 1);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    searchAvailability().catch(function () {
      setLoading(false);
      setStatus("빈자리를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    });
  });

  var today = seoulDateString(new Date());
  dateInput.value = today;
  dateInput.min = today;
  dateInput.max = addDays(today, 62);
  setSeats(readSavedSeats());

  loadFacilities().catch(function () {
    resultsSection.hidden = false;
    resultCondition.textContent = "연결 오류";
    resultsTitle.textContent = "시설 목록을 불러오지 못했습니다";
    setStatus("실시간 조회 서비스를 연결한 뒤 다시 시도해 주세요.", "error");
  });
})();
