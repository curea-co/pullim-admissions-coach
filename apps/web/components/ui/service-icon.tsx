import * as React from 'react';

// 풀림 서비스 브랜드 마크 — 인라인 SVG 픽셀 글리프.
//   정본: pullim-writing-coach `components/ui/service-icon.tsx`. 파일·next/image 가 필요 없어
//   dangerouslyAllowSVG 설정이나 public 자산 없이 스위처에서 바로 쓸 수 있다.
//
// 정본은 12개 글리프를 다 갖고 있지만 여기엔 **이 앱의 카탈로그가 실제로 쓰는 것만** 담는다
// (lib/pullim-services.ts). 안 쓰는 마크를 들고 있으면 브랜드 갱신 때 조용히 낡는다.
// 숨김 서비스(classbot·store)를 노출하게 되면 정본에서 해당 글리프를 가져온다.
//
// ⚠️ 색은 PUDS 시맨틱 토큰이 아니라 **브랜드 토큰**(`--color-brand-600`·`--color-lemon`, globals.css
//    @theme)을 쓴다. 브랜드 가이드라인 doNot: **recolor** — 서비스 마크는 테마를 따라가면 안 된다
//    (`--color-action-primary` 로 묶으면 data-theme 교체 시 마크가 다시 칠해진다).
//    두 브랜드 토큰은 테마 파일에서 재정의되지 않아 항상 같은 값이고, 토큰이 안 실린 컨텍스트
//    (jsdom 테스트·이메일 등)를 위해 가이드 hex 를 폴백으로 둔다. components/pullim-logo.tsx 와 동일 규칙.
const BLUE = 'var(--color-brand-600, #0362DA)';
const LEMON = 'var(--color-lemon, #E6FF4C)';
const WHITE = '#FFFFFF'; // 마크의 흰 획도 브랜드 고정값 — 표면 토큰(--surface-*)으로 묶지 않는다.

export type ServiceIconName =
  | 'planner'
  | 'q'
  | 'writing'
  | 'studio'
  | 'junior'
  | 'games'
  | 'exam'
  | 'pullim';

const LABELS: Record<ServiceIconName, string> = {
  planner: '풀림 플래너',
  q: '풀림 Q',
  writing: '풀림 라이팅',
  studio: '풀림 스튜디오',
  junior: '풀림 주니어',
  games: '풀림 게임',
  exam: '풀림 입시',
  pullim: '풀림 OS',
};

const GLYPHS: Record<ServiceIconName, React.ReactNode> = {
  planner: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <rect x="22" y="30" width="56" height="8" fill={WHITE} />
      <rect x="22" y="70" width="56" height="8" fill={WHITE} />
      <rect x="22" y="38" width="8" height="32" fill={WHITE} />
      <rect x="70" y="38" width="8" height="32" fill={WHITE} />
      <rect x="30" y="46" width="8" height="8" fill={WHITE} />
      <rect x="46" y="46" width="8" height="8" fill={WHITE} />
      <rect x="62" y="46" width="8" height="8" fill={WHITE} />
      <rect x="30" y="54" width="8" height="8" fill={WHITE} />
      <rect x="46" y="54" width="8" height="8" fill={LEMON} />
      <rect x="62" y="54" width="8" height="8" fill={WHITE} />
      <rect x="30" y="62" width="8" height="8" fill={WHITE} />
      <rect x="46" y="62" width="8" height="8" fill={WHITE} />
      <rect x="62" y="62" width="8" height="8" fill={WHITE} />
    </>
  ),
  q: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <rect x="30" y="22" width="40" height="8" fill={WHITE} />
      <rect x="30" y="30" width="8" height="8" fill={WHITE} />
      <rect x="62" y="30" width="8" height="8" fill={WHITE} />
      <rect x="54" y="38" width="8" height="8" fill={WHITE} />
      <rect x="46" y="46" width="8" height="8" fill={WHITE} />
      <rect x="46" y="54" width="8" height="8" fill={WHITE} />
      <rect x="46" y="70" width="8" height="8" fill={LEMON} />
    </>
  ),
  writing: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <rect x="30" y="22" width="40" height="8" fill={WHITE} />
      <rect x="30" y="70" width="40" height="8" fill={WHITE} />
      <rect x="30" y="30" width="8" height="40" fill={WHITE} />
      <rect x="62" y="30" width="8" height="40" fill={WHITE} />
      <rect x="38" y="38" width="24" height="8" fill={WHITE} />
      <rect x="38" y="46" width="24" height="8" fill={WHITE} />
      <rect x="38" y="54" width="16" height="8" fill={WHITE} />
      <rect x="38" y="62" width="24" height="8" fill={WHITE} />
      <rect x="46" y="46" width="8" height="8" fill={LEMON} />
    </>
  ),
  studio: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <rect x="22" y="30" width="56" height="8" fill={WHITE} />
      <rect x="22" y="62" width="56" height="8" fill={WHITE} />
      <rect x="22" y="38" width="8" height="24" fill={WHITE} />
      <rect x="70" y="38" width="8" height="24" fill={WHITE} />
      <rect x="38" y="38" width="8" height="24" fill={WHITE} />
      <rect x="46" y="46" width="8" height="8" fill={WHITE} />
      <rect x="30" y="70" width="40" height="8" fill={WHITE} />
      <rect x="54" y="38" width="8" height="8" fill={LEMON} />
    </>
  ),
  // 풀림 주니어(jr) — 파랑 타일 위 레몬 원 하나. 초등 앱이라 도형을 쪼개지 않고 단일 원으로 크게(정본 동일).
  junior: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <circle cx="50" cy="50" r="22" fill={LEMON} />
    </>
  ),
  games: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <rect x="38" y="46" width="24" height="8" fill={WHITE} />
      <rect x="46" y="38" width="8" height="24" fill={WHITE} />
      <rect x="30" y="30" width="8" height="8" fill={WHITE} />
      <rect x="62" y="30" width="8" height="8" fill={WHITE} />
      <rect x="30" y="62" width="8" height="8" fill={WHITE} />
      <rect x="62" y="62" width="8" height="8" fill={WHITE} />
      <rect x="46" y="46" width="8" height="8" fill={LEMON} />
    </>
  ),
  // 입시코치(현재 서비스) — 흰 오름 계단(입시 단계) + 레몬 정상 깃발. components/pullim-logo.tsx·app/icon.svg 동일 마크.
  exam: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <rect x="30" y="62" width="8" height="8" fill={WHITE} />
      <rect x="38" y="54" width="8" height="16" fill={WHITE} />
      <rect x="46" y="46" width="8" height="24" fill={WHITE} />
      <rect x="54" y="38" width="8" height="32" fill={WHITE} />
      <rect x="62" y="30" width="8" height="40" fill={WHITE} />
      <rect x="62" y="22" width="8" height="8" fill={LEMON} />
    </>
  ),
  pullim: (
    <>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={BLUE} />
      <g transform="translate(26,27)" fill={WHITE}>
        <path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" />
      </g>
      <rect x="74" y="14" width="9" height="9" fill={LEMON} />
    </>
  ),
};

export interface ServiceIconProps extends React.SVGProps<SVGSVGElement> {
  name: ServiceIconName;
  /** 한 변 px(정사각 viewBox 0 0 100 100). 기본 100 — 정본 동일. */
  size?: number;
}

export function ServiceIcon({ name, size = 100, ...rest }: ServiceIconProps) {
  // 기본은 의미 있는 그래픽(`role="img"` + 서비스명 aria-label).
  // 다만 스위처 목록처럼 **서비스 이름이 바로 옆에 보이는** 자리에서는 중복 낭독이 되므로
  // 호출부가 `aria-hidden` 을 주면 role/aria-label 을 떼고 완전한 장식 요소로 만든다
  // (aria-hidden 만 얹으면 role="img" 가 남아 스크린리더 구현에 따라 어정쩡해진다).
  const decorative = rest['aria-hidden'] === true || rest['aria-hidden'] === 'true';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : LABELS[name]}
      {...rest}
    >
      {GLYPHS[name]}
    </svg>
  );
}
