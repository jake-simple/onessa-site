# Onessa 브랜드 사이트 설계

날짜: 2026-06-10
상태: 승인됨 (구현 전)

## 목적

Onessa(*one essence*)의 브랜드 사이트. 회사의 선언(face the finite · only essential)과 FACE 철학을 보여주고, 세 앱(Spendy · Petals · Peek)을 소개한다. 블로그 없음 — 회사 + 앱 소개만.

소스 오브 트루스:
- 브랜딩·철학·태그라인: `~/MyContents/content-config.md` ("퍼스널 브랜딩 — Onessa × 파운더", "FACE")
- 제품 사실: `~/DayMoney/README.md`, `~/Petals/README.md`, `~/Peek/README.md` (사실 날조 금지)
- 영어 voice: `~/MyContents/voice-pack.md` 8항 — 담백한 단문, 과장 금지

## 확정된 결정

| 항목 | 결정 |
|------|------|
| 범위 | 회사 + 앱 소개만 (블로그 제외) |
| 구조 | 원페이지 — 홈 하나에 앱 섹션 |
| 서사 | 선언 먼저 (히어로 선언 → FACE → 앱 3 → 푸터) |
| 언어 | 영어만 |
| 스택 | 순수 정적 HTML/CSS, 빌드 도구·의존성 없음, JS 없거나 최소 |
| 디자인 | 밝은 여백형 — 흰 바탕, 검은 텍스트, 강조색 1개 이하 |
| 타이포 | 제목 세리프(Georgia 계열 시스템 폰트), 본문 시스템 산세리프, 웹폰트 로드 없음 |
| 위치 | `~/onessa-site/` 새 git 저장소 |
| 연락처 | jake@onessa.app |

## 페이지 구조 (index.html)

1. **히어로** — "Onessa" 워드마크 + 선언 *"Onessa makes you face what's finite — so only the essential remains."* + 보조 한 줄 *the one essential.*
2. **철학 (FACE)** — F가 목적, A·C·E가 떠받치는 위계를 4줄로. content-config.md의 영어 문구 사용:
   - **F** — Face what's finite.
   - **A** — Add nothing you don't need.
   - **C** — Craft the best of what remains.
   - **E** — Essential only.
3. **앱 섹션 ×3** — 각 앱: 이름 + 유한성 한 문장(무엇을 직시하게 하는가) + 설명 2~3문장 + 실제 스크린샷 1장 + 스토어 링크. 기능 나열 금지(느슨한 연결의 철칙 — 결정 하나·덜어낸 것 하나·가치 하나의 톤).
   - **Spendy** — *face the money of a single day.* 입력이 첫 화면, 조회보다 기록.
     링크: https://apps.apple.com/us/app/spendy-budget-diary/id6443419421
   - **Petals** — *face the whole year on one screen.* 스크롤 없는 1년 캘린더.
     링크 없음 — "Coming soon to the Mac App Store" 표기.
   - **Peek** — *face the time until what's next.* 메뉴바·잠금화면의 남은 시간.
     링크 2개: Mac https://apps.apple.com/us/app/peek-whats-next/id6758136586 · iPhone https://apps.apple.com/us/app/peek-up-next/id6760283607
4. **푸터** — jake@onessa.app · © Onessa.

IceDeck은 범위 밖 — 싣지 않는다.

## 에셋

- 스크린샷 소스: `~/DayMoney/AppStore/screenshots/captures/`, `~/Petals/AppStore/screenshots/*.png`, `~/Peek/fastlane/screenshots/`. 앱당 대표 1장을 골라 `assets/`로 복사(웹용으로 리사이즈·압축).
- 파비콘·로고: 간단한 텍스트 워드마크로 시작 (별도 로고 제작은 범위 밖).

## 파일 구성

```
onessa-site/
├── index.html
├── style.css
├── assets/        # 스크린샷, 파비콘
└── docs/superpowers/specs/  # 이 문서
```

## 검증 기준 (이 조건을 통과하면 끝)

- [ ] 로컬에서 index.html을 열면 모든 섹션·이미지·링크가 동작한다
- [ ] App Store 링크 3개(Spendy, Peek Mac, Peek iPhone)가 올바른 리스팅으로 연결된다
- [ ] Petals는 링크 없이 Coming soon으로 표기된다
- [ ] 모바일 폭(375px)에서 1열로 깨짐 없이 보인다
- [ ] 외부 요청 제로 (웹폰트·JS CDN·트래커 없음)
- [ ] 카피가 전부 영어이고, 제품 사실이 각 앱 README와 일치한다

## 범위 밖

호스팅·도메인 연결(추후), 블로그, IceDeck, 다국어, 애널리틱스, 로고 디자인.
