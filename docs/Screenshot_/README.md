# Phase A+B 시각 셸 스크린샷 (2026-05-29)

캡처 환경: `next start` (production build) + Playwright headless
배포 URL 부재 시점의 *시연·17:30 보고용* 증거 자료.

## 데스크탑 (1280×800, fullPage)

| 화면 | 파일 |
|---|---|
| 랜딩 (`/`) | [desktop-01-landing.png](desktop-01-landing.png) |
| 입력 폼 (`/submit`) | [desktop-02-submit.png](desktop-02-submit.png) |
| 동의 게이트 (`/consent`) | [desktop-03-consent.png](desktop-03-consent.png) |
| 진행 상태 (`/processing`) 🆕 | [desktop-04-processing.png](desktop-04-processing.png) |
| 결과 3종 탭 (`/result`) | [desktop-05-result.png](desktop-05-result.png) |
| 학부모 리포트 (`/parent`) | [desktop-06-parent.png](desktop-06-parent.png) |

## 모바일 (375×812, fullPage)

| 화면 | 파일 |
|---|---|
| 랜딩 (`/`) | [mobile-01-landing.png](mobile-01-landing.png) |
| 입력 폼 (`/submit`) | [mobile-02-submit.png](mobile-02-submit.png) |
| 동의 게이트 (`/consent`) | [mobile-03-consent.png](mobile-03-consent.png) |
| 진행 상태 (`/processing`) 🆕 | [mobile-04-processing.png](mobile-04-processing.png) |
| 결과 3종 탭 (`/result`) | [mobile-05-result.png](mobile-05-result.png) |
| 학부모 리포트 (`/parent`) | [mobile-06-parent.png](mobile-06-parent.png) |

## 재캡처 방법

```bash
# 1. 빌드 + 서버
pnpm --filter @pullim/web build
pnpm --filter @pullim/web start   # http://localhost:3030

# 2. Playwright headless로 캡처 (MCP 또는 직접)
#    데스크탑 1280×800, 모바일 375×812, fullPage:true
```

## 비고

- 결과 화면은 첫 탭(면접 준비 팩)만 노출됨. 다른 탭(진단 가이드·보완안)은 클릭 후 별도 캡처 가능.
- 진행 상태 화면은 90초 데모 사이클의 *현재 시각* 스냅샷. 다시 열면 `queued` 단계부터 시작.
- §6 가드레일 시각 라벨(노란 배지)이 결과·진행 화면 상단에 표시되는지 확인용.
