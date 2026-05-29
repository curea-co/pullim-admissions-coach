# @pullim/web

Pullim Admissions Coach — 학생·학부모 웹 (Phase A 시각 셸).

## 기술 스택
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + Pretendard 한글 폰트
- shadcn/ui (Phase A 후반 도입 예정)
- 모바일 우선 반응형

## 실행

루트에서 한 번 의존성 설치:

```bash
pnpm install
```

개발 서버:

```bash
pnpm dev:web
# → http://localhost:3030
```

다른 포트로 띄우려면:

```bash
pnpm --filter @pullim/web exec next dev -p 4000
```

빌드·실행:

```bash
pnpm build:web
pnpm start:web
```

타입체크:

```bash
pnpm --filter @pullim/web typecheck
```

## 디렉토리

```
app/
  layout.tsx       — 루트 레이아웃 + Pretendard 로드
  page.tsx         — Phase A 랜딩 페이지 (mock)
  globals.css      — Tailwind base
lib/
  utils.ts         — cn() helper
```

## §6 가드레일 (UI)
- 표시 명칭 고정: "**생기부 진단 가이드**", "**학생부 종합 전형 면접 준비 팩**"
- 카피 금지: "설계 가이드", "면접 답변 대본", "합격 답변 제공", "이렇게 말하세요/써넣으세요"
- 결과 화면 상단에 "AI는 방향·근거만 제공, 대본·정답 아님" 라벨 노출
- 학부모 리포트는 자녀 생기부·결과물 원문 미노출(요약만)

상세: `docs/002_Admissions_Coach_definition_v.3.md` §6.
