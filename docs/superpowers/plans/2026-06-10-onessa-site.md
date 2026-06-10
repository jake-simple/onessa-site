# Onessa 브랜드 사이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onessa의 선언과 FACE 철학, 세 앱(Spendy·Petals·Peek)을 담은 원페이지 정적 사이트를 `~/onessa-site/`에 만든다.

**Architecture:** 빌드 도구 없는 순수 정적 사이트 — `index.html` + `style.css` + `assets/`. JS 없음, 웹폰트 없음, 외부 요청 제로. Apple·Tesla 풍 미니멀: 큰 세리프 타이포, 넉넉한 섹션 여백, 숨 쉬는 제품 이미지.

**Tech Stack:** HTML5, CSS3 (시스템 폰트만), `sips`(macOS 내장)로 이미지 리사이즈.

**Spec:** `docs/superpowers/specs/2026-06-10-onessa-site-design.md`

---

### Task 1: 에셋 준비

**Files:**
- Create: `assets/spendy.png` (소스: `~/DayMoney/AppStore/screenshots/captures/iphone-6.9/en/home.png`)
- Create: `assets/petals.png` (소스: `~/Petals/AppStore/screenshots/01-year.png`)
- Create: `assets/peek.jpg` (소스: App Store 공식 스크린샷 URL)
- Create: `assets/favicon.svg`

- [ ] **Step 1: 디렉터리 생성 및 로컬 스크린샷 복사·리사이즈**

```bash
mkdir -p ~/onessa-site/assets
sips --resampleWidth 720 ~/DayMoney/AppStore/screenshots/captures/iphone-6.9/en/home.png --out ~/onessa-site/assets/spendy.png
sips --resampleWidth 1800 ~/Petals/AppStore/screenshots/01-year.png --out ~/onessa-site/assets/petals.png
```

Expected: 두 파일 생성. `sips`가 각 파일의 최종 픽셀 크기를 출력.

- [ ] **Step 2: Peek 스토어 스크린샷 다운로드**

```bash
curl -sL "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/7b/59/f5/7b59f573-8d6b-7752-15cc-0b7d2e2aaf28/menubar_screenshot_en.jpg/1600x1000bb.jpg" -o ~/onessa-site/assets/peek.jpg
file ~/onessa-site/assets/peek.jpg
```

Expected: `JPEG image data`. (HTML 에러 페이지가 받아졌다면 URL 끝 해상도를 `800x500bb.jpg`로 바꿔 재시도.)

- [ ] **Step 3: 파비콘 생성**

`~/onessa-site/assets/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="74" font-family="Georgia, serif" font-size="84" text-anchor="middle" fill="#1d1d1f">O</text></svg>
```

- [ ] **Step 4: 검증 — 파일 4개와 크기 확인**

```bash
ls -la ~/onessa-site/assets/
```

Expected: `spendy.png`, `petals.png`, `peek.jpg`, `favicon.svg` 존재. 각 이미지 1MB 미만 권장(초과 시 `sips --resampleWidth`를 줄여 재실행).

- [ ] **Step 5: 커밋**

```bash
cd ~/onessa-site && git add assets/ && git commit -m "feat: 앱 스크린샷·파비콘 에셋 추가"
```

---

### Task 2: index.html

**Files:**
- Create: `index.html`

- [ ] **Step 1: index.html 작성**

`~/onessa-site/index.html` 전체 내용:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Onessa — Face what’s finite.</title>
  <meta name="description" content="Onessa makes you face what’s finite — so only the essential remains. Spendy, Petals, and Peek.">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="site-header">
    <span class="wordmark">Onessa</span>
  </header>

  <main>
    <section class="hero">
      <h1>Face what’s finite.</h1>
      <p class="hero-sub">Onessa makes you face what’s finite —<br>so only the essential remains.</p>
      <p class="hero-tag">the one essential.</p>
    </section>

    <section class="face" aria-label="How we build">
      <ul class="face-list">
        <li><strong>F</strong><span>Face what’s finite.</span></li>
        <li><strong>A</strong><span>Add nothing you don’t need.</span></li>
        <li><strong>C</strong><span>Craft the best of what remains.</span></li>
        <li><strong>E</strong><span>Essential only.</span></li>
      </ul>
    </section>

    <section class="app" id="spendy">
      <p class="app-kicker">Spendy</p>
      <h2>Face the money of a single day.</h2>
      <p class="app-desc">A budget app that opens to the input screen — recording comes before reviewing. A tag and a one-line note are enough. Even without an amount, it becomes a diary of the day.</p>
      <p class="app-links"><a href="https://apps.apple.com/us/app/spendy-budget-diary/id6443419421">Download on the App&nbsp;Store</a></p>
      <img src="assets/spendy.png" alt="Spendy home screen, with the input field on the first screen" class="shot shot-phone">
    </section>

    <section class="app" id="petals">
      <p class="app-kicker">Petals</p>
      <h2>Face the whole year on one screen.</h2>
      <p class="app-desc">A macOS calendar that shows all twelve months in a single window. No scrolling. Place images, text, and stickers on top — your year, on one canvas.</p>
      <p class="coming-soon">Coming soon to the Mac App&nbsp;Store</p>
      <img src="assets/petals.png" alt="Petals showing a full year of twelve months in one window" class="shot">
    </section>

    <section class="app" id="peek">
      <p class="app-kicker">Peek</p>
      <h2>Face the time until what’s next.</h2>
      <p class="app-desc">Your next event and the minutes left, always in sight — in the Mac menu bar, on the iPhone lock screen, in the Dynamic Island.</p>
      <p class="app-links">
        <a href="https://apps.apple.com/us/app/peek-whats-next/id6758136586">Peek for&nbsp;Mac</a>
        <span class="sep" aria-hidden="true">·</span>
        <a href="https://apps.apple.com/us/app/peek-up-next/id6760283607">Peek for&nbsp;iPhone</a>
      </p>
      <img src="assets/peek.jpg" alt="Peek in the Mac menu bar showing the next event and time remaining" class="shot">
    </section>
  </main>

  <footer class="site-footer">
    <a href="mailto:jake@onessa.app">jake@onessa.app</a>
    <p>© 2026 Onessa</p>
  </footer>
</body>
</html>
```

- [ ] **Step 2: 검증 — 브라우저에서 열기 (스타일 없이 구조만)**

```bash
open ~/onessa-site/index.html
```

Expected: 모든 텍스트·이미지 3장이 보이고, 링크 3개가 올바른 App Store 페이지로 이동.

- [ ] **Step 3: 커밋**

```bash
cd ~/onessa-site && git add index.html && git commit -m "feat: 원페이지 마크업 — 선언·FACE·앱 3종·푸터"
```

---

### Task 3: style.css

**Files:**
- Create: `style.css`

- [ ] **Step 1: style.css 작성**

`~/onessa-site/style.css` 전체 내용:

```css
:root {
  --text: #1d1d1f;
  --muted: #6e6e73;
  --bg: #fff;
  --hairline: #d2d2d7;
  --link: #06c;
  --serif: "New York", ui-serif, Georgia, "Times New Roman", serif;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--sans);
  color: var(--text);
  background: var(--bg);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }

.site-header { padding: 28px 24px; text-align: center; }
.wordmark { font-family: var(--serif); font-size: 20px; letter-spacing: 0.04em; }

.hero { padding: 140px 24px 160px; text-align: center; }
.hero h1 {
  font-family: var(--serif);
  font-weight: 600;
  font-size: clamp(44px, 8vw, 88px);
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.hero-sub {
  margin-top: 28px;
  font-size: clamp(18px, 2.4vw, 24px);
  color: var(--muted);
}
.hero-tag {
  margin-top: 48px;
  font-family: var(--serif);
  font-style: italic;
  font-size: 18px;
}

.face { border-top: 1px solid var(--hairline); }
.face-list {
  list-style: none;
  max-width: 640px;
  margin: 0 auto;
  padding: 120px 24px;
  display: grid;
  gap: 36px;
}
.face-list li {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: baseline;
}
.face-list strong { font-family: var(--serif); font-size: 40px; font-weight: 600; }
.face-list span { font-size: 22px; }

.app {
  border-top: 1px solid var(--hairline);
  padding: 140px 24px;
  text-align: center;
}
.app-kicker {
  font-size: 15px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.app h2 {
  font-family: var(--serif);
  font-weight: 600;
  font-size: clamp(32px, 5vw, 56px);
  letter-spacing: -0.01em;
  margin-top: 16px;
}
.app-desc {
  max-width: 560px;
  margin: 24px auto 0;
  font-size: 19px;
  color: var(--muted);
}
.app-links { margin-top: 28px; font-size: 17px; }
.app-links .sep { color: var(--hairline); margin: 0 12px; }
.coming-soon { margin-top: 28px; font-size: 17px; color: var(--muted); }

.shot {
  display: block;
  max-width: min(900px, 100%);
  height: auto;
  margin: 64px auto 0;
  border-radius: 18px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.12);
}
.shot-phone { max-width: min(340px, 80%); }

.site-footer {
  border-top: 1px solid var(--hairline);
  padding: 48px 24px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.site-footer a { color: var(--text); }
.site-footer p { margin-top: 8px; }

@media (max-width: 600px) {
  .hero { padding: 96px 20px 110px; }
  .app { padding: 100px 20px; }
  .face-list { padding: 90px 20px; }
  .face-list strong { font-size: 32px; }
  .face-list span { font-size: 19px; }
}
```

- [ ] **Step 2: 검증 — 브라우저 새로고침**

```bash
open ~/onessa-site/index.html
```

Expected: 흰 바탕·검은 세리프 타이포의 미니멀 레이아웃. 히어로 선언이 크게, 섹션마다 헤어라인 구분선, 스크린샷에 둥근 모서리·그림자.

- [ ] **Step 3: 커밋**

```bash
cd ~/onessa-site && git add style.css && git commit -m "feat: Apple 풍 미니멀 스타일 — 시스템 폰트, 외부 요청 제로"
```

---

### Task 4: 최종 검증 (스펙의 검증 기준)

- [ ] **Step 1: App Store 링크 3개 생존 확인**

```bash
for id in 6443419421 6758136586 6760283607; do
  curl -s "https://itunes.apple.com/lookup?id=$id&country=us" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['results'][0]['trackName'] if r['resultCount'] else 'NOT FOUND')"
done
```

Expected: `Spendy - Budget, Diary`, `Peek - What's Next?`, `Peek - Up Next` 순서로 출력. NOT FOUND가 있으면 해당 링크 수정.

- [ ] **Step 2: 외부 요청 제로 확인**

```bash
grep -nE 'https?://' ~/onessa-site/index.html ~/onessa-site/style.css | grep -v 'apps.apple.com'
```

Expected: 출력 없음 (apps.apple.com은 클릭 시 이동하는 링크일 뿐, 페이지 로드 시 요청 아님).

- [ ] **Step 3: 모바일 폭 확인**

브라우저 개발자 도구(⌘⌥I → 반응형 모드)에서 375px 폭으로 확인. 1열 유지, 가로 스크롤 없음, 텍스트·이미지 잘림 없음.

- [ ] **Step 4: 카피·사실 대조**

각 앱 설명이 해당 README의 사실과 일치하는지 확인 — Spendy: 입력이 첫 화면·금액 없이 기록(`~/DayMoney/README.md`), Petals: 12개월 한 윈도우·캔버스 꾸미기(`~/Petals/README.md`), Peek: 메뉴바·잠금화면·다이나믹 아일랜드(`~/Peek/README.md`). Petals는 링크 없이 Coming soon인지 확인.

- [ ] **Step 5: 수정사항 있으면 커밋, 없으면 완료**

```bash
cd ~/onessa-site && git status
```

Expected: clean이면 끝. 수정했다면 `git add -A && git commit -m "fix: 최종 검증 반영"`.
