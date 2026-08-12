import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function createServiceWorkerHarness({cachePutFails = false} = {}) {
  const source = await readFile(new URL("./public/image-cache-sw.js", import.meta.url), "utf8");
  const listeners = new Map();
  const entries = new Map();
  let fetchCount = 0;
  const cache = {
    async match(request) {
      return entries.get(request.url)?.clone();
    },
    async put(request, response) {
      if (cachePutFails) throw new Error("cache unavailable");
      entries.set(request.url, response.clone());
    },
    async keys() {
      return [...entries.keys()].map((url) => ({url}));
    },
    async delete(request) {
      return entries.delete(request.url);
    }
  };
  const context = {
    URL,
    caches: {
      async open() { return cache; },
      async keys() { return []; },
      async delete() { return true; }
    },
    async fetch() {
      fetchCount += 1;
      return new Response("official image", {status: 200});
    },
    self: {
      addEventListener(type, listener) { listeners.set(type, listener); },
      skipWaiting() {},
      clients: {async claim() {}}
    }
  };

  vm.runInNewContext(source, context);
  return {
    entries,
    fetchCount: () => fetchCount,
    async request(request) {
      let responsePromise;
      listeners.get("fetch")({
        request,
        respondWith(promise) { responsePromise = promise; }
      });
      return responsePromise;
    }
  };
}

test("같은 공식 썸네일은 브라우저 캐시에서 다시 읽는다", async () => {
  const harness = await createServiceWorkerHarness();
  const request = {
    method: "GET",
    destination: "image",
    url: "https://umppa.seoul.go.kr/icare/upload/fcltyInfoManage/facility.jpg"
  };

  const first = await harness.request(request);
  const second = await harness.request(request);

  assert.equal(await first.text(), "official image");
  assert.equal(await second.text(), "official image");
  assert.equal(harness.fetchCount(), 1);
  assert.equal(harness.entries.size, 1);
});

test("공식 시설 이미지가 아닌 요청은 가로채지 않는다", async () => {
  const harness = await createServiceWorkerHarness();
  const response = await harness.request({
    method: "GET",
    destination: "image",
    url: "https://example.com/other.jpg"
  });

  assert.equal(response, undefined);
  assert.equal(harness.fetchCount(), 0);
});

test("브라우저 캐시 저장에 실패해도 원본 이미지는 반환한다", async () => {
  const harness = await createServiceWorkerHarness({cachePutFails: true});
  const response = await harness.request({
    method: "GET",
    destination: "image",
    url: "https://umppa.seoul.go.kr/icare/upload/fcltyInfoManage/facility.jpg"
  });

  assert.equal(await response.text(), "official image");
  assert.equal(harness.fetchCount(), 1);
  assert.equal(harness.entries.size, 0);
});
