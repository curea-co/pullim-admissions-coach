# 설계 — 결과 화면이 실제 입력 반영 + 데모 정직성 (#25)

- 일자: 2026-06-24
- 작성: 브레인스토밍 세션 (Claude Code)
- 연관 이슈: [#25](https://github.com/curea-co/pullim-admissions-coach/issues/25) (P1), 부분 해소 [#28](https://github.com/curea-co/pullim-admissions-coach/issues/28)(공학계열/이공 라벨 불일치). `feat/20` 위 스택.
- 상태: 설계 확정 대기

---

## 1. 배경 / 문제

- 제출 흐름이 입력값을 버린다: `submit/page.tsx`의 `handleSubmit`이 `buildPayload()`를 검증한 뒤 `router.push('/consent')`만 하고 데이터를 저장하지 않는다. consent→processing→result도 각자 독립.
- `/result`는 입력과 무관하게 항상 `parkJunho` mock을 렌더하고, 헤더가 `고3 2학기 · 공학계열`로 **하드코딩**(`result/page.tsx` line 33-35). → 인문 생기부를 넣어도 공학 본문·헤더가 뜬다.
- 면접 준비 팩: 랜딩은 "예상 질문 **10종**" 약속, mock은 **3건**.
- "공학계열" 하드코딩은 `science_engineering` 라벨("이공")과도 불일치(#28).

## 2. 목표 / 비목표

**목표 (Phase A/B 데모 정직성)**
- 제출한 *표시용* 입력(학년·학기·학교유형·계열·목표대학)을 `/result` 헤더에 정확히 반영.
- 본문(면접·진단·보완)은 mock이되 **"예시 결과(데모)"로 명확히 라벨** — 개인화된 척하지 않는다.
- 면접 팩에 "데모 3건 · 실서비스 10종" 라벨.
- 헤더 계열을 `targetTrackLabel`로 통일(하드코딩 "공학계열" 제거).

**비목표 (YAGNI)**
- 실제 본문 개인화(계열별 결과 생성) — Phase D(AI) 책임.
- 백엔드 세션/저장 — Phase C. 본 작업은 클라이언트 sessionStorage 데모.
- 생기부 text·식별정보 저장 — **저장하지 않는다**(비-PII 헤더 필드만).
- 면접 10건 합성 — 라벨로 정직 처리(Phase D에서 실제 10종).

## 3. 결정 사항 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|---|---|
| 개인화 깊이 | 정직한 헤더(실입력) + 샘플 본문 라벨 | 확정 |
| 면접 건수 | 3건 유지 + "데모 3건 · 실서비스 10종" 라벨 | 확정 |
| 브랜치 | `feat/20` 위 스택(`feat/25-...`) | 확정 |

## 4. 데이터 threading (sessionStorage, 비-PII)

제출 성공 시 *표시용 헤더 필드만* sessionStorage에 저장. **생기부 text·마스킹 필드는 저장하지 않는다**(PII, 데모에 불필요).

### 4.1 shared 스키마 + 라벨 (`packages/shared/src/submitted-profile.ts`, 테스트 가능)
```
SubmittedProfile = {
  grade: 1|2|3,
  semester: 1|2,
  schoolType: SchoolType,        // 기존 enum
  targetTrack: TargetTrack,      // 기존 enum
  targetUniversities: { name: string; department?: string }[],  // 최대 3
}
submittedProfileSchema: z.object(...)   // 기존 enum·라벨 재사용
formatStandingLabel(p: SubmittedProfile): string
  // 예: "고3 2학기 · 일반고 · 이공"
```
- `formatStandingLabel`은 순수 함수: `고${grade} ${semester}학기 · ${schoolTypeLabel[schoolType]} · ${targetTrackLabel[targetTrack]}`.

### 4.2 web 래퍼 (`apps/web/lib/submitted-profile.ts`, 브라우저 I/O)
```
STORAGE_KEY = 'pullim:submitted-profile'
saveSubmittedProfile(p): void   // typeof window 가드, JSON.stringify
loadSubmittedProfile(): SubmittedProfile | null
  // window 가드 + JSON.parse try/catch + submittedProfileSchema.safeParse → 실패 시 null
```

## 5. 결과 헤더 (실입력 반영)

- `/result`(클라이언트)에서 마운트 시 `loadSubmittedProfile()` → `useEffect`로 상태에 적재(SSR 안전).
- 헤더 라벨: 프로필 있으면 `formatStandingLabel(profile)` + 목표대학(1~3순위, 있으면), 없으면(직접 진입) `예시 학생 (데모) · 고3 2학기 · 이공` fallback.
- 기존 하드코딩 `... 공학계열 ...` 줄 제거 → 라벨 단일 소스(`targetTrackLabel`).

## 6. 본문 정직성

- 결과 본문(탭 위) 상단에 **샘플 배너**(예: `<aside role="note">`): "아래 면접·진단·보완 **본문은 예시 결과(데모)**입니다. 실제 개인화 결과는 출시 버전에서 제공됩니다." 항상 노출(본문이 mock이므로).
- InterviewPanel 상단에 라벨: "**데모 미리보기 3건 · 실서비스는 예상 질문 10종**".
- 진단·보완 본문은 #19/#20에서 정비된 mock 그대로(본 이슈는 본문 내용 변경 X).

## 7. 영향 파일
- 신규: `packages/shared/src/submitted-profile.ts`, `packages/shared/src/submitted-profile.test.ts`, `packages/shared/src/index.ts`(barrel), `apps/web/lib/submitted-profile.ts`
- 수정: `apps/web/app/submit/page.tsx`(제출 성공 시 `saveSubmittedProfile`), `apps/web/app/result/page.tsx`(load·헤더·샘플 배너·면접 라벨)

## 8. 테스트
- **shared 단위테스트:** `submittedProfileSchema` parse(정상/누락·잘못된 enum → 실패), `formatStandingLabel`(계열·학교유형 라벨 매핑 정확). 예: `{grade:3,semester:2,schoolType:'general',targetTrack:'humanities',targetUniversities:[]}` → `'고3 2학기 · 일반고 · 인문'`.
- **web:** typecheck + `next build` + 수동(제출→결과 헤더가 입력 반영, 직접 /result 진입 시 fallback, 샘플 배너·면접 라벨 노출).

## 9. 리스크 / 하위호환
- sessionStorage 비가용(프라이빗 모드 등)·parse 실패 → `loadSubmittedProfile()`이 null → fallback 라벨. 깨지지 않음.
- 비-PII만 저장(생기부 text 제외) → 민감정보 노출 위험 없음. #17 PII 정책과 정합.
- 입력 스키마(studentProfileSchema)·기존 흐름 불변. `feat/20` 스택 → #19·#20 머지 후 #25 머지.
