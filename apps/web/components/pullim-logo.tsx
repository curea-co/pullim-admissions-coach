// 풀림 입시코치 공식 심볼 — 풀림 브랜드 가이드라인(2026-05-15) / asset-registry id="exam".
// 파랑(#0362DA) 컨테이너 + 흰 오름 계단(입시 단계) + 레몬(#E6FF4C) 정상 깃발.
// 브랜드 doNot: recolor · add-shadow · rotate · remove-container — 원본 그대로, 효과 없음.
export function PullimLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="풀림 입시코치"
      className="shrink-0"
    >
      <title>풀림 입시코치</title>
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#0362DA" />
      <rect x="30" y="62" width="8" height="8" fill="#FFFFFF" />
      <rect x="38" y="54" width="8" height="16" fill="#FFFFFF" />
      <rect x="46" y="46" width="8" height="24" fill="#FFFFFF" />
      <rect x="54" y="38" width="8" height="32" fill="#FFFFFF" />
      <rect x="62" y="30" width="8" height="40" fill="#FFFFFF" />
      <rect x="62" y="22" width="8" height="8" fill="#E6FF4C" />
    </svg>
  );
}
