// 데모 환경 시각 가드.
// process.env.NEXT_PUBLIC_DEMO === 'true' 일 때만 노출.
// Vercel 프로젝트 환경 변수에 NEXT_PUBLIC_DEMO=true 설정 권고.
// AWS staging이 가동되면 본 컴포넌트와 env는 즉시 제거 대상 (정의 §6.3·보안 정책 §4 정합).

export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO !== 'true') return null;
  return (
    <div
      role="note"
      className="sticky top-0 z-50 w-full border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm"
    >
      ⚠️ 데모 환경 — mock 데이터 시연 전용. 실 사용자 데이터를 수집·저장하지 않습니다.
    </div>
  );
}
