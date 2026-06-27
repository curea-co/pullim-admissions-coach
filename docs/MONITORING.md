# 베타 모니터링 — `admissions.pullim.ai`

- 목적: 베타 운영 중 **무엇이 깨지는지·돈이 새는지·§6을 어기는지**를 무료/저비용으로 감시.
- 원칙: opus 호출은 비싸고(과금) 느리다(~90초). 모니터링은 **`/api/health`(무료)** 로 하고, `/api/analyze`로 핑하지 않는다.

---

## 0. 무엇을 보나 (우선순위)
| # | 신호 | 왜 | 어디서 |
|---|---|---|---|
| 1 | **비용/남용** | 인증 전 공개 엔드포인트 + opus 과금. 인메모리 레이트리밋은 분산에서 약함 | Anthropic 콘솔 + Vercel 로그 |
| 2 | **에러** | analyze 실패(503 과부하·500 내부), 구성 누락 | Vercel 로그 / (선택) Sentry |
| 3 | **§6 위반 플래그** | 게이트 밖 섹션 금지 키워드 | Vercel 로그 `§6 guardrail flags` |
| 4 | **가동(uptime)** | 사이트/엔드포인트 다운 | `/api/health` + uptime 모니터 |

---

## 1. 헬스 엔드포인트 (이미 배포됨)
**`GET https://admissions.pullim.ai/api/health`** — opus 호출 없이 200 + 구성 상태.
```json
{ "ok": true, "env": "production", "analyzeReady": true,
  "config": { "aiKey": true, "rateLimitIpHeader": true, "rateLimitBackend": true, "authBackend": "mock" } }
```
- **`analyzeReady: false`** = 프로덕션 구성 누락(키/레이트 env) → /api/analyze가 fail-closed로 막힌 상태. **배포 직후·키 회전 후 반드시 확인**(우리가 실제로 키 이름 오타로 막혔던 사례).
- 비밀 값은 노출하지 않음(boolean만).

## 2. Uptime 모니터 (무료, 5분)
[UptimeRobot](https://uptimerobot.com) 또는 BetterStack 무료 플랜:
- **모니터 추가** → HTTP(s) → URL `https://admissions.pullim.ai/api/health`
- 키워드 검사: 응답에 `"analyzeReady":true` 포함 여부 → 없으면 알림(구성 깨짐/다운)
- 간격 5분, 알림 = 이메일/슬랙. **이거 하나로 다운 + 구성누락 둘 다 잡힌다.**

## 3. Vercel 로그 (에러 · §6 플래그)
Vercel → 프로젝트 → **Logs** (또는 `vercel logs <url>`). 우리 코드가 남기는 신호(생기부 원문/PII 없음):
| 로그 시그니처 | 의미 | 조치 |
|---|---|---|
| `[analyze] 내부 오류:` | analyze 500(서버/엔진/DTO) | 원인 확인, 재현 |
| `[analyze] §6 guardrail flags:` | 게이트 밖 금지 키워드(예 `학원@diagnosis...`) | EPO 검토 |
| `[analyze] 레이트리밋 구성 오류:` | RATE_LIMIT_* 미설정(프로덕션 fail-closed) | env 점검 |
| HTTP 503 (analyze) | Anthropic 과부하/키 누락 | 일시면 대기, 지속이면 키/쿼터 |
- **알림 자동화**: Vercel **Log Drains**(Pro)로 Datadog/Slack 등에 전달, 또는 위 시그니처를 주기적으로 확인.

## 4. 비용/남용 (Anthropic)
- [Anthropic 콘솔](https://console.anthropic.com) → **Usage**(일별 토큰·비용) 모니터링.
- **Spend limit(지출 한도) 설정** ← 베타 필수. 남용/버그로 인한 과금 폭주 상한.
- 키 누출 의심 시 즉시 회전(절대 코드/대화/PR에 평문 금지).
- 호출량 급증은 Vercel 로그의 `/api/analyze` 빈도로 교차 확인. (정확한 분산 레이트 제한은 KV 전환 후 — 현재 인메모리는 인스턴스별.)

## 5. 트래픽 (선택)
Vercel → **Analytics**(Web Analytics) 활성화(무료 티어) → 방문/페이지뷰. 또는 `@vercel/analytics` 패키지 추가.

## 6. 에러 알림 강화 (선택, 후속)
실시간 에러 알림이 필요하면 **Sentry**(`@sentry/nextjs`) 도입 — 스택트레이스·알림·릴리즈 추적. 베타 초기엔 Vercel 로그 + uptime 모니터로 충분.

---

## 베타 모니터링 최소 셋업 (권장)
1. ✅ `/api/health` (배포됨)
2. **UptimeRobot** → `/api/health` 키워드 `"analyzeReady":true` (5분)
3. **Anthropic spend limit** 설정
4. Vercel Logs에서 §6 플래그·`[analyze] 내부 오류` 주기 확인
→ 무료로 **다운·구성누락·과금폭주·§6위반·에러** 전부 커버.
