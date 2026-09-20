// 환경 배너 — 이 화면이 **실제로 무엇을 하는 환경인지**를 알린다.
//
// 2026-09-20 정정: 이전에는 `NEXT_PUBLIC_DEMO=true` 이면 무조건
// "mock 데이터 시연 전용. 실 사용자 데이터를 수집·저장하지 않습니다" 라고 단언했다.
// **dev 배포에서 그 문장이 거짓이었다.** dev 는 pullim-api 에 실제로 배선돼 있어
// (제출 → 동의 → 진단 → 결과, ADR-058) 입력한 생기부가 서버에 저장된다.
//
// 생기부는 미성년자 민감정보다(정의 §6.3). "저장하지 않습니다" 는 틀리면 안 되는 문장이라
// 문구를 선언값이 아니라 **설정에서 끌어온다**: 백엔드가 붙어 있으면 저장된다고 말한다.
//
// 판정 축은 `NEXT_PUBLIC_PULLIM_API` 다 — lib/admissions-api.ts 가 실제로 그 값으로
// /admissions/* 를 호출한다. 배너가 코드와 같은 값을 보게 해서 어긋날 여지를 없앤다.

const isDemo = process.env.NEXT_PUBLIC_DEMO === 'true';
const hasBackend = Boolean(process.env.NEXT_PUBLIC_PULLIM_API);

export function DemoBanner() {
  if (!isDemo) return null;

  // 백엔드가 붙은 환경 — 입력이 실제로 저장된다. 톤도 올린다(amber → rose).
  if (hasBackend) {
    return (
      <div
        role="note"
        className="sticky top-0 z-50 w-full border-b border-rose-200 bg-rose-100 px-4 py-2 text-center text-xs font-medium text-rose-900 sm:text-sm"
      >
        ⚠️ 개발 환경 — 실 백엔드에 연결돼 있습니다. 입력한 생기부는 서버에 저장되니 실제
        개인정보를 넣지 마세요.
      </div>
    );
  }

  return (
    <div
      role="note"
      className="sticky top-0 z-50 w-full border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm"
    >
      ⚠️ 데모 환경 — 백엔드 미연결. 화면 확인 전용이며 입력은 저장되지 않습니다.
    </div>
  );
}
