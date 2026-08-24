import assert from "node:assert/strict";
import test from "node:test";
import {
  PARKING_STATUS_BY_FACILITY,
  PARKING_STATUS_LABELS,
  parkingLabelForFacility,
  parkingStatusForFacility,
  parkingTokenColorForFacility
} from "./parking.js";

test("현재 공식 목록의 시설별 주차 판정값을 고정 데이터로 보관한다", () => {
  assert.equal(Object.keys(PARKING_STATUS_BY_FACILITY).length, 132);
  for (const status of Object.values(PARKING_STATUS_BY_FACILITY)) {
    assert.ok(PARKING_STATUS_LABELS[status]);
  }
});

test("등록되지 않은 새 시설은 주차 정보 없음으로 표시한다", () => {
  assert.equal(parkingStatusForFacility("NEW_FACILITY"), "unknown");
  assert.equal(parkingLabelForFacility("NEW_FACILITY"), "주차 정보 없음");
  assert.equal(parkingTokenColorForFacility("NEW_FACILITY"), "gray");
});

test("주차 상태에 맞는 칩 색상을 반환한다", () => {
  assert.equal(parkingTokenColorForFacility("DJ230901"), "green");
  assert.equal(parkingTokenColorForFacility("MP260701"), "orange");
  assert.equal(parkingTokenColorForFacility("GD250601"), "red");
});
