<!-- PR 본문 가이드. 빈 섹션은 지워도 됩니다. -->

## 변경 요약
<!-- 1~2줄. 무엇을 왜 바꿨는지. -->

## SSOT 근거
<!-- 어떤 문서·결정·Issue 기반인지. 예시:
- 정의 v0.3 §6.3
- 코딩 계획 v0.1 Phase B
- 검수자 결정 4.2
- Issue #1
-->

## 영향 범위 (해당란 체크)
- [ ] FE (`apps/web`)
- [ ] BE (`apps/api`) — Phase C 이후
- [ ] Admin (`apps/admin`) — Phase C 이후
- [ ] Infra (`infra/`, `.github/workflows/`)
- [ ] Docs (`docs/`)
- [ ] Shared (`packages/shared`)
- [ ] DB schema / migration — Phase C 이후
- [ ] 외부 시스템 변경 (Vercel·GitHub Settings·AWS) → 본문에 명시

## §6 가드레일 영향 (정의 v0.3)
<!-- 해당 없으면 "해당 없음" -->
- §6.1 생기부 진단·개입 분리: 
- §6.2 면접 준비·대본 분리: 
- §6.3 미성년자 데이터: 

## 검증
- [ ] `pnpm -r typecheck` 통과
- [ ] `pnpm --filter @pullim/web build` 통과
- [ ] 영향 라우트 로컬 HTTP 200 확인
- [ ] Phase E 이연 항목 미침범 (KMS·결제·알림톡 채널·CloudWatch 대시보드)
- [ ] 실 미성년 데이터 처리 코드 추가 없음 (정책 §4 단계적 시행 정합)

## 스크린샷 (UX 변경 시)
<!-- desktop·mobile 1장씩 권고. 일과 마무리 시 일괄 캡처 가능. -->

## 미해결·이월
<!-- 본 PR에서 닫지 않고 다음 PR/Phase로 미루는 항목. -->

## 머지 결정
<!-- 사용자(EPO)가 본 PR을 머지함. Claude는 머지하지 않음. -->
