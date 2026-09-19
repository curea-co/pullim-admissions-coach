# LLM 게이트웨이 OpenRouter 전환 계획 — 2026-09-18

작성일: 2026-09-18 (금)
범위: 입시코치 진단 파이프라인의 LLM 호출을 Anthropic 직결 → OpenRouter 경유로 바꾸는 설계
대상 코드: **`pullim-api`** (입시코치 레포에는 LLM 호출 코드가 없다)
선행 문서: [`016_llm_integration_trial_2026-09-18.md`](016_llm_integration_trial_2026-09-18.md)

> **이 문서의 위치(2026-09-18 갱신):** ~~실행 전 계획서~~ → **실행 완료 기록**.
> 계획대로 **경로 B(OpenAI 호환)** 를 택해 포트와 두 어댑터를 넣었다. §10 이 실행 결과다.
> §1~§9 는 결정 당시 판단 근거로 남긴다 — §3 의 "미확인 항목"은 경로 B 선택으로 무의미해졌다.

---

## 1. 요약

**어댑터 포트를 먼저 만들고, 그 뒤에 게이트웨이를 고른다.**

지금 진단 파이프라인은 Anthropic SDK 를 4곳에서 직접 부른다. 게이트웨이를 바꾸려면
그 4곳을 모두 건드려야 하는데, 호출부는 "구조화된 출력을 받는다"는 것 외에 벤더를 알
필요가 없다. 포트를 세우면 게이트웨이 선택이 **설정 한 줄**로 줄고, 두 경로를 나란히
두고 출력을 비교할 수 있다.

전환 경로는 두 갈래이고, **어느 쪽인지는 §3 의 확인 1건으로 갈린다.**
포트를 먼저 만들면 그 확인 결과와 무관하게 Phase 1 을 진행할 수 있다.

**중요 — 이 레포에는 이미 OpenRouter 프로바이더가 있다.** 새로 만드는 게 아니라
*모자란 부분을 채우고 admissions 를 그 아래로 넣는* 작업이다(§2.2).

---

## 2. 확인된 사실

### 2.1 현재 admissions 의 Anthropic 결합

LLM 호출 지점은 4곳이고 네 곳 모두 같은 모양이다.

| 파일 | 역할 | 모델 |
|---|---|---|
| `engine/diagnose.ts` | 3역량 진단 | `claude-haiku-4-5` |
| `engine/interview.ts` | 면접 팩 | `claude-haiku-4-5` |
| `engine/prescribe.ts` | 보완 처방 | `claude-haiku-4-5` |
| `engine/twin-judge.ts` | 종단 트윈 판정 | `claude-haiku-4-5` |

네 곳이 같은 모델이 됐다.

네 곳이 공통으로 쓰는 Anthropic **전용** 표면:

```ts
anthropic.messages.parse({
  model, max_tokens,
  output_config: {
    format: zodOutputFormat(SomeZodSchema),             // ① SDK 헬퍼
  },
  // thinking·effort 는 보내지 않는다 — Haiku 4.5 가 거부한다(400).
  system: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }],  // ④
  messages: [...],
});
res.parsed_output                                       // ③ 의 산출
```

①~③ 이 전환에서 다뤄야 할 전부다. 스트리밍·tool use 는 쓰지 않는다.

> **2026-09-18 갱신:** 진단 3콜 모델이 `claude-opus-4-8` → `claude-haiku-4-5` 로 바뀌었다.
> opus 는 선정 근거가 코드·ADR 어디에도 없이 신설 커밋(#256)부터 박혀 있었고, 유저 분석 1건마다
> 3콜이 나가 건당 비용이 5배였다. 이에 따라 `thinking`·`effort` 도 제거됐다(Haiku 4.5 미지원).
> 아래 ①②(Anthropic 전용 파라미터)가 사라져 **전환 표면이 그만큼 줄었다.**

포트는 이미 하나 있다 — `AnthropicProviderInterface`. 다만 **`Promise<Anthropic>` 을
반환해서 SDK 타입이 그대로 새어나온다.** 호출부 4곳이 `anthropic: Anthropic` 을 인자로
받으므로, 이 포트로는 게이트웨이를 못 바꾼다.

### 2.2 이 레포에는 이미 OpenRouter 프로바이더가 있다

`src/common/llm/` 에 3-프로바이더 구성이 서 있다(ADR-074).

```
interface/llm-provider.interface.ts      LlmProviderInterface (포트)
infrastructure/runtime-llm.provider.ts   capability 라우팅 + vendor-네임스페이스 라우팅
infrastructure/openrouter-llm.provider.ts  ← 이미 존재
infrastructure/anthropic-llm.provider.ts
infrastructure/gemini-llm.provider.ts
```

기존 OpenRouter 프로바이더가 **이미 갖춘 것**(재사용 대상):

- `POST {baseUrl}/api/v1/chat/completions` (OpenAI 호환) 호출
- **서비스별 API 키** — `OPENROUTER_API_KEY_<SERVICE>` 우선, 공유 키 폴백.
  OpenRouter 대시보드에서 서비스 단위 사용량·예산이 분리된다.
- **SSRF allowlist** — `openrouter.ai` host + https 강제
- HTTP status → `LlmProviderError` 코드 매핑, 타임아웃(60s)

**갖추지 못한 것**(이번에 채울 대상):

- `response_format` (구조화 출력) — `LlmProviderInterface` 에 해당 메서드 자체가 없다
- `reasoning` (thinking/effort)
- `cache_control` (프롬프트 캐싱)

그리고 **admissions 는 이 추상화를 통째로 우회한다.** 다른 6개 서비스(writing·studio·
classbot·store·junior 등)는 `LlmProviderInterface` 를 쓰는데 admissions 만 SDK 직결이다.

### 2.3 OpenRouter 쪽 사실 (2026-09-18 문서 확인)

**OpenAI 호환 경로** — `https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer`

| 필요 기능 | OpenRouter 파라미터 | 확인 내용 |
|---|---|---|
| 구조화 출력 | `response_format: { type: 'json_schema', json_schema: { name, strict, schema } }` | **일부 모델만 지원.** 미지원 모델이면 요청이 에러로 실패한다 |
| 사고 깊이 | `reasoning: { effort, max_tokens, exclude }` | `effort` 는 `max`~`none`. Claude 계열은 `budget = max(min(max_tokens × 비율, 128000), 1024)` 로 **환산**된다 |
| 프롬프트 캐싱 | 콘텐츠 블록의 `cache_control: { type: 'ephemeral' }` | 최대 **4 breakpoint**. `usage.prompt_tokens_details` 에 `cached_tokens`·`cache_write_tokens`. 쓰기 1.25×, 읽기 0.1× |

**Anthropic 호환 경로("Anthropic Skin")** — `https://openrouter.ai/api`

- Anthropic Messages API 와 같은 요청·응답 형식을 받는 별도 엔드포인트.
- 인증은 `ANTHROPIC_AUTH_TOKEN`(= `Authorization: Bearer`), `ANTHROPIC_API_KEY` 는 빈 값.
- OpenRouter 는 "thinking 블록·native tool use·스트리밍·멀티턴이 Anthropic 직결과 같이 동작"한다고 서술한다.
- 명시된 제약: **"Anthropic 1P 프로바이더에서만 동작이 보장된다"** — 프로바이더 우선순위를 Anthropic 1P 로 고정해야 한다.

`zod` 는 `^3.25.76` 이지만 `zod/v4` 서브패스를 쓰고 있고 **`z.toJSONSchema()` 가 동작한다**
(실행 확인). JSON Schema 변환에 새 의존성이 필요 없다.

---

## 3. 결정적 미확인 항목 — 이것 하나가 경로를 가른다

**Anthropic Skin 이 `output_config.format`(구조화 출력)을 통과시키는가?**

- OpenRouter **공식 API 레퍼런스에는 Anthropic Skin 자체가 문서화돼 있지 않다.**
  근거는 OpenRouter 블로그 튜토리얼(1st-party 이지만 Claude Code 용 문서)이고,
  그 글은 thinking·tool use·스트리밍·멀티턴만 열거한다. **구조화 출력은 언급이 없다.**
- 우리 파이프라인은 네 곳 모두 구조화 출력에 의존한다. 이게 안 통과하면 Skin 경로는 탈락이다.

**확인 방법:** 최소 요청 1건을 Skin 으로 보내 `output_config.format` 이 살아오는지 본다.
비용은 센트 단위. `twin-judge` 모양(Haiku + 작은 스키마, thinking 없음)이 가장 싸다.

이 확인 전까지 §4 의 두 경로 중 하나를 고르지 않는다.

---

## 4. 두 경로

### 경로 A — Anthropic Skin (baseURL 교체)

Anthropic SDK 를 그대로 두고 `anthropic.provider.ts` 의 클라이언트 생성만 바꾼다.

```ts
new Anthropic({ baseURL: 'https://openrouter.ai/api', authToken: openRouterKey });
```

- **장점:** `messages.parse`·`zodOutputFormat`·`thinking`·`cache_control` 코드가 한 줄도 안 바뀐다. 호출부 4곳 무변경.
- **단점:** OpenRouter 의 서비스별 키·SSRF allowlist·에러 분류(§2.2)를 **못 쓴다** — 그건 `OpenRouterLlmProvider` 에 붙어 있다. Anthropic 1P 프로바이더 고정이 필요하고, Skin 이 문서화되지 않은 표면이라 계약이 바뀌어도 알기 어렵다.
- **가능 조건:** §3 이 통과일 때만.

### 경로 B — OpenAI 호환 (기존 프로바이더 확장)

`OpenRouterLlmProvider` 에 구조화 출력 메서드를 더하고 admissions 를 그 아래로 넣는다.

| Anthropic | → | OpenRouter |
|---|---|---|
| `output_config.format = zodOutputFormat(S)` | → | `response_format.json_schema.schema = z.toJSONSchema(S)`, `strict: true` |
| `thinking: {type:'adaptive'}` + `output_config.effort` | → | `reasoning: { effort }` |
| `system[0].cache_control` | → | 시스템 메시지 콘텐츠 블록의 `cache_control` |
| `res.parsed_output` | → | `S.parse(JSON.parse(choices[0].message.content))` |

- **장점:** 서비스별 키·예산 분리, SSRF allowlist, 에러 분류를 그대로 물려받는다. 다른 6개 서비스와 같은 추상화 아래로 들어간다. 문서화된 공식 표면이다.
- **단점:** 변환 계층을 직접 써야 하고, 구조화 출력 지원 모델로 선택이 좁아진다. `thinking: adaptive`(예산 없는 모드)와 `reasoning.effort`(비율 환산)는 **동작이 같지 않다** — 출력 동등성 검증이 필요하다.

**현재 기울기: B.** A 가 코드는 적게 바뀌지만, 이 레포가 이미 쌓아둔 운영 장치(키 분리·
SSRF·에러 분류)를 버리는 대가가 크다. §3 확인 결과에 따라 확정한다.

---

## 5. 설계 — 어댑터 포트

경로 A·B 어느 쪽이든 **호출부는 이 포트만 안다.** 이게 "어댑터 미리 만들기"의 실체다.

```ts
// src/admissions/engine/ports/structured-llm.port.ts
export interface StructuredGenerateParams<T> {
  /** 출력 계약. 어댑터가 벤더 형식으로 변환한다. */
  schema: z.ZodType<T>;
  /** OpenRouter json_schema.name 이 필수라 호출부가 준다. */
  schemaName: string;
  /** 캐시 대상 — byte-안정이어야 한다. */
  system: string;
  user: string;
  maxOutputTokens: number;
  /** 미지정 시 어댑터 기본. Haiku 경로는 생략한다. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  model?: string;
  /** OPENROUTER_API_KEY_<SERVICE> 선택용. admissions 고정. */
  service?: string;
}

export interface StructuredGenerateResult<T> {
  value: T;
  /** 실제 사용 모델 — diagnosis_results.model 기록용. */
  model: string;
  usage?: { inputTokens: number; outputTokens: number; cachedTokens: number };
}

export abstract class StructuredLlmPort {
  abstract generate<T>(p: StructuredGenerateParams<T>): Promise<StructuredGenerateResult<T>>;
}
```

구현 2종:

- `AnthropicStructuredAdapter` — 현재 동작 그대로(`messages.parse` + `zodOutputFormat`)
- `OpenRouterStructuredAdapter` — §4-B 변환표대로

호출부 변경은 인자 하나뿐이다.

```ts
- export async function diagnose(anthropic: Anthropic, profile, cohort)
+ export async function diagnose(llm: StructuredLlmPort, profile, cohort)
```

`usage` 를 포트가 돌려주는 이유: doc 016 §5.5 의 비용 재추정이 아직 미실측인데,
게이트웨이를 바꾸면 가격 구조가 또 달라진다. 포트가 usage 를 올려주면 워커가
`diagnosis_results` 에 기록해 **실측이 자동으로 쌓인다.**

---

## 6. 단계

| # | 단계 | 내용 | 검증 |
|---|---|---|---|
| 0 | **Skin 확인** | §3 — `output_config.format` 통과 여부 1회 실측 | 통과/실패 이진 |
| 1 | **포트 + Anthropic 어댑터** | §5 포트 신설, 호출부 4곳을 포트로 교체. **동작 무변경 리팩터** | 기존 스펙 전부 통과(4077건) |
| 2 | **OpenRouter 어댑터** | §4-B 변환. 단위 스펙(스키마 변환·effort 매핑·캐시 블록·에러 분류) | 신규 스펙 |
| 3 | **설정 스위치** | `ADMISSIONS_LLM_GATEWAY=anthropic\|openrouter`, 기본 `anthropic` | 미설정 시 기존 동작 |
| 4 | **출력 동등성** | 골드 5건을 양쪽 게이트웨이로 돌려 구조·게이트·문체 플래그 비교 | doc 016 §5.3-2 회귀와 합침 |
| 5 | **전환** | 기본값을 openrouter 로. 실패 시 스위치 되돌리기 | 실측 비용·지연 기록 |

Phase 1 이 핵심이다 — **여기까지는 게이트웨이 결정과 무관하게 순이득**이다(SDK 타입
누수 제거, usage 기록 가능, 테스트 대역 주입 쉬워짐). Phase 0 이 늦어져도 1 은 진행한다.

가장 싼 첫 이식 대상은 `twin-judge` 다. Haiku + 작은 스키마 + thinking 없음이라
변환 표면이 가장 좁다.

---

## 7. 리스크

1. **구조화 출력 모델 제약** — OpenRouter 는 미지원 모델이면 요청을 실패시킨다. `anthropic/claude-haiku-4.5`·`google/gemini-3.8-flash` 는 둘 다 `structured_outputs` 지원을 확인했다(2026-09-18 모델 목록 조회).
2. **캐싱이 깨질 위험** — 시스템 프롬프트 캐싱이 비용의 핵심인데(doc 016 §3.6 은 캐싱 효과를 총비용의 약 5% 로 정정했지만, 3콜 구조에서는 시스템이 3번 반복되므로 재계산이 필요하다), OpenRouter 는 프로바이더를 라우팅한다. 프로바이더가 바뀌면 캐시가 날아간다 — **프로바이더 고정이 필요**하다.
3. **`thinking: adaptive` ↔ `reasoning.effort` 는 같지 않다** — 전자는 모델이 알아서 정하는 모드, 후자는 `max_tokens` 비율 환산 예산이다. 출력 품질이 달라질 수 있어 §6-4 동등성 검증이 형식적 절차가 아니다.
4. **모델 ID 표기 변경** — `claude-haiku-4-5` → `anthropic/claude-haiku-4.5` 류의 vendor-네임스페이스. `engine/models.ts` 하드코딩을 게이트웨이별로 해소해야 한다.
5. **Skin 은 문서화되지 않은 표면** — 경로 A 를 택하면 계약 변경을 사전에 알기 어렵다.

---

## 8. 미결 (착수 전 결정 필요)

1. **경로 A vs B** — §3 확인 후. 현재 기울기는 B.
2. **admissions 를 `LlmProviderInterface` 아래로 완전히 넣을지**, 아니면 `StructuredLlmPort` 를 admissions 소유로 둘지. 전자는 6개 서비스와 통일되지만 공용 포트에 구조화 출력 메서드를 추가해야 한다(다른 서비스는 안 쓴다). **후자를 제안한다** — 공용 포트를 admissions 사정으로 넓히지 않는다.
3. **OpenRouter 수수료를 포함한 비용 모델** — doc 016 §5.5 재추정이 아직 미실측이다. Phase 1 의 usage 기록이 쌓이면 양쪽을 같은 기준으로 비교할 수 있다.

---

## 9. 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-09-18 | 초안. 현재 결합 표면(§2.1)·기존 OpenRouter 자산(§2.2)·OpenRouter 기능 확인(§2.3)·결정적 미확인 1건(§3)·두 경로(§4)·어댑터 포트 설계(§5)·6단계(§6)·리스크 5건(§7) |


---

## 10. 실행 결과 (2026-09-18)

### 10.1 무엇이 들어갔나

경로 **B**(OpenAI 호환)를 택했다. §3 의 Anthropic Skin 확인은 하지 않았다 — 경로 B 로 가면
필요 없는 판단이었고, 기존 OpenRouter 자산(서비스별 키·SSRF allowlist·에러 분류)을 그대로
물려받는 쪽이 더 컸다.

| 파일 | 내용 |
|---|---|
| `engine/ports/structured-llm.port.ts` | **신규** — 엔진이 아는 유일한 LLM 절단선. `generate<T>()` + `modelId()` |
| `.../infrastructure/openrouter-structured.adapter.ts` | **신규** — 기본 경로. `OpenRouterLlmConfig` 재사용 |
| `.../infrastructure/anthropic-structured.adapter.ts` | **신규** — 되돌리기 경로(haiku-4.5) |
| `engine/models.ts` | 게이트웨이별 모델 상수 2종으로 분리 |
| `engine/{diagnose,interview,prescribe,twin-judge,analyze}.ts` | `anthropic: Anthropic` → `llm: StructuredLlmPort` |
| `diagnoses.module.ts` | `ADMISSIONS_LLM_GATEWAY` 로 어댑터 선택하는 useFactory |
| `common/config/env.ts` | 게이트웨이 env override + 부팅 검증(오타 거부) |

**엔진에서 `@anthropic-ai/sdk` import 가 사라졌다** — 어댑터에만 남는다.

### 10.2 설계에서 바뀐 것

계획 §5 의 포트는 `effort`·`service`·`model` 필드를 뒀는데 **전부 뺐다.**

- `effort`: Haiku 4.5 가 거부하고 Gemini 는 기본 사고를 한다. 넘길 곳이 없었다.
- `model`·`service`: 어댑터가 소유하는 편이 맞다 — 호출부가 모델을 알 이유가 없다.

대신 `modelId()` 를 더했다(워커가 `diagnosis_results.model` 에 기록해야 한다).

**`z.toJSONSchema` 는 쓰지 않았다.** `zodOutputFormat(schema).schema` 가 이미 JSON Schema 를
`additionalProperties:false` + `required` 까지 붙여 내놓고, 그 형태가 OpenRouter strict 모드가
요구하는 것과 정확히 같다. 같은 helper 의 `parse` 로 응답 검증까지 된다. §4-B 표의 변환 2줄이
헬퍼 하나로 끝났다.

### 10.3 운영

- **기본 게이트웨이는 `openrouter`**(`google/gemini-3.8-flash`). `ADMISSIONS_LLM_GATEWAY=anthropic` 으로 haiku-4.5 직결로 되돌린다.
- **배포 선행 조건:** 통합 시크릿에 `OPENROUTER_API_KEY` 또는 `OPENROUTER_API_KEY_ADMISSIONS` 가 있어야 한다. 없으면 부팅은 되고 **진단 호출 시점에 fail-closed** 한다(기존 provider 동형).
- 어댑터가 호출마다 usage 를 로깅한다(`LLM <schema> openrouter in=… out=… reasoning=… cost=…`). DB 컬럼 추가 없이 게이트웨이 비교 기준선이 쌓인다.

### 10.4 골드 5건 회귀 (gemini-3.8-flash)

**5건 전부 통과. §6 가드레일 위반 0건, 문체 플래그 0건.**

| case | 계열 | 학교유형 | 결과 | 면접 유형 분포 |
|---|---|---|---|---|
| 01 박준호 | 이공 | 일반고 | PASS | record 8 · passage 1 |
| 02 김서연 | 인문 | 일반고 | PASS | record 6 · passage 2 |
| 03 이도윤 | 의치한 | 특목고 | PASS | record 6 · passage 1 · **mmi 2** |
| 04 최하은 | 예체능 | 자사고 | PASS | record 7 · passage 1 |
| 05 박민준 | 기타 | 검정고시 | PASS | record 8 |

목표 대학·계열 KB 가 실제로 작동한다 — 의치한 케이스에만 MMI 가 나왔고, 나머지는 제시문/생기부
기반으로 갈렸다. 케이스당 약 50초.

회귀를 돌리는 과정에서 **게이트 결함 3건**이 드러났다. 셋 다 고쳤다.

**(a) §6 금지 키워드가 단어 경계를 넘어 붙었다 — 하드 게이트 오탐**

`filterActions`·`lintGuardrails` 가 공백을 모두 제거한 뒤 부분문자열로 비교하고 있었다
(띄어쓰기 우회 차단 목적). 그 결과:

```
"음악 미학 원서를 읽고"  → "미학원서" ⊃ 학원  → 정상 처방이 제거됨
"사회과학 원서 강독"     → "과학원서" ⊃ 학원  → 같은 오탐
```

`filterActions` 는 **하드 게이트**라 이 오탐이 정상 처방을 조용히 삭제한다. 키워드별 정규식으로
바꿔 ① 붙은 형태(`사설학원`·`입시학원`)는 계속 잡고 ② 음절 사이에 공백이 낀 형태는 앞 글자가
한글이 아닐 때만 잡도록 했다 — `학 원`(우회)은 잡히고 `미학 원서`는 통과한다. 회귀 7건 동반.

**(b) 문체 게이트의 2인칭 규칙이 면접관의 말까지 잡았다**

MMI 상황 제시문 `"[상황] 당신은 4인 1조 프로젝트의 조장이다"` 가 위반으로 잡혔다. 시스템
프롬프트가 금지하는 것은 **학생을 향한 코칭 화법**의 2인칭(`"당신의 기록에는…"`)이지, 면접관이
수험생에게 상황을 주는 구어가 아니다. `interview.questions[].question`·`.followups` 경로를
규칙에서 제외했다.

**(c) 같은 문제가 진학후시점 규칙에도 있었다**

`"대학 진학 후 팀 활동을 수행할 역량이 충분하다고 보십니까?"`(검정고시 지원자에게 던지는 압박
질문)가 잡혔다. 같은 경로 제외를 적용했다. **`answerDirection` 의 `"향후 대학 진학 후 보완할
학습 계획을 연결한다"` 는 계속 잡힌다** — 그건 진짜 위반이고, 실제로 회귀 중 1회 잡아냈다.

### 10.5 일시적 실패 관측

Gemini 경로에서 HTTP 200 인데도 실패하는 경우가 두 종류 관측됐다.

| 증상 | 관측 |
|---|---|
| 빈 `content` | 비교 실행 중 1회 |
| 잘린 JSON(파싱 실패) | 골드 회귀 중 1회(case-04, 재실행 시 정상) |

둘 다 재실행에서 성공했다. **어댑터가 해당 콜만 1회 재시도**하도록 했다(`GENERATE_ATTEMPTS = 2`).
잡 단위 재시도(BullMQ)에 맡기면 3콜을 전부 다시 돌려 비용이 3배가 된다. 재시도 대상은
빈 응답·스키마 불일치·상류 일시 장애·레이트리밋이며, 그 외(인증 실패·SSRF 차단)는 즉시 throw 한다.

### 10.6 프롬프트 캐싱

시스템 메시지에 `cache_control: {type:'ephemeral'}` breakpoint 를 붙였다. OpenRouter 가 벤더별
형식으로 번역한다(Anthropic cache_control ↔ Gemini/OpenAI breakpoint). 다만 **실측에서 아직
`cached_tokens` 가 0 이다** — Gemini 의 최소 캐시 프리픽스에 못 미치는 것으로 보인다. 어댑터가
usage 에 `cached=` 를 로깅하므로 실환경에서 관측 가능하다.

### 10.7 배포 선행 조건 — `OPENROUTER_API_KEY_ADMISSIONS` (dev·prod 완료)

**진단은 이 키 없이 동작하지 않는다.** 공유 `OPENROUTER_API_KEY` 폴백을 타지 않기 때문이다
(ADR-093 동형 엄격 조회 — 폴백을 허용하면 다른 서비스 키로 진단이 조용히 돌아가 예산 분리가
무너진다). 키가 없으면 부팅은 되고 **진단 호출 시점에 `LLM_NOT_CONFIGURED` 로 fail-closed** 한다.

| 항목 | 값 |
|---|---|
| 넣는 곳 | AWS Secrets Manager `pullim/<env>/backend` (ap-northeast-2). 레포가 아니다 |
| 키 이름 | `OPENROUTER_API_KEY_ADMISSIONS` (대문자, 값은 문자열) |
| 코드 변경 | 불필요 — `OpenRouterLlmConfig` 가 `OPENROUTER_API_KEY_` 접두를 전수 스캔한다 |
| 확인 | 부팅 로그 `serviceKeys=[…]` 에 `admissions` 가 보이는지. **`configured=…` 는 공유 키 기준이라 판정 축이 아니다**(ADR-093 주석) |

**2026-09-19 dev·prod 등록 완료.**

| 환경 | 시크릿 | 키 수 | 새 버전 |
|---|---|---|---|
| dev | `pullim/dev/backend` | 68 → 69 | `2f8ef1e8-7003-4833-8663-f6ea1706b844` |
| prod | `pullim/prod/backend` | 56 → 57 | `f9ac0cca-ab42-4f2b-a3f4-80d589057b01` |

양쪽 모두 기존 키 손실 0 · 값 변경 0.

**키 분리 축은 서비스다 — 환경이 아니다.** `_ADMISSIONS` 는 dev·prod 가 같은 값을 공유한다.
`OPENROUTER_API_KEY_WRITING` 이 이미 그 모양이고(dev·prod 동일 값), 오너 결정으로 거기에 맞췄다.
대시보드 사용량과 지출 한도가 **서비스 단위**로 갈리는 게 목적이고, 환경 단위 분리는 목적이 아니다.

> blob 하나를 15개 서비스가 공유하므로 `put-secret-value` 는 전체 교체다. read → merge → 검증 → write
> 순서를 지켰고, 쓰기 직전에 백업 시점 이후 다른 변경이 없는지 재확인했다. 되돌릴 때는 `AWSPREVIOUS`.

**dev 실환경 확인** — 배포 후 부팅 로그:

```
OpenRouter generate provider 설정 로드 완료
(configured=false, serviceKeys=[writing,classbot,admissions])
```

`admissions` 가 올라왔다. `configured=false` 는 공유 키 기준이라 판정 축이 아니다(ADR-093).

⚠️ **한 가지 남는다.** 이 키는 `pnpm test:gold`(§10.8)와 haiku↔gemini 벤치마크가 쓰던 값과 같다.
즉 **로컬에서 골드 회귀를 돌리면 그 비용이 운영 키에 얹힌다.** 지출 한도를 걸 때 이걸 감안하거나,
하네스용 키를 따로 뽑아 `.secrets/openrouter.key` 만 교체한다(블롭은 건드리지 않아도 된다).

### 10.8 골드 회귀 — 리포지토리에 상주한다

```
pnpm test:gold        # pullim-api
```

- 하네스: `pullim-api/test/admissions-gold.gold-spec.ts`
- 설정: `test/jest-gold.json` (`maxWorkers: 1` — 실 LLM 호출이라 동시 실행 시 레이트리밋·비용이 튄다)
- **기본 실행에서 자동으로 빠진다.** 루트 jest 의 `testRegex` 가 `.spec.ts`·`.e2e-spec.ts` 만 잡고
  이 파일은 `.gold-spec.ts` 다. `pnpm test` 에 섞이지 않으니 CI 가 돈을 쓰지 않는다.
- 골드 데이터는 입시코치 레포(`docs/golden/`, EPO 소유)에 그대로 둔다 — 복제하면 드리프트가 생긴다.
  하네스가 형제 디렉터리 경로로 참조한다(`../pullim-admissions-coach`).
- 키는 `pullim-admissions-coach/.secrets/openrouter.key`(gitignore). 시크릿 스토어를 띄우지 않으려고
  파일에서 직접 읽는다(`process.env` 금지 린트 회피).
- 비용·시간: 5건 약 $0.4 · 5분.

판정은 구조(역량 3 · 키워드 5+ · 질문 8+ · 역량별 강점/보완/다음할일 1+ · record_based 근거 1+)와
**§6 하드 게이트(위반 0 · 처방 제거 0)** 다. 문체는 경고 게이트라 실패시키지 않고 출력만 한다.

**모델이나 프롬프트를 바꾸면 반드시 다시 돌린다.** 기존 기준선이 무효가 된다.


### 10.9 남은 것

1. **캐싱 실효 확인** — `cached_tokens` 가 계속 0 이면 breakpoint 를 빼거나 시스템 프롬프트 구성을 바꾼다.
2. **일시 실패 빈도 관측** — 재시도로 흡수되지만 빈도가 높으면 모델·프로바이더 고정을 검토한다.
3. **라이팅코치·공통 기본값은 haiku 유지** — 이번 벤치마크 대상이 아니었다.
