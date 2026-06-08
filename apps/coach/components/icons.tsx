/**
 * 풀림 입시코치 아이콘 — pullim.ai exam-coach 레퍼런스의 2-tone FLAT FILLED 글리프 패밀리.
 *
 * 헤드라인 글리프(진단·처방·추적·증명·신뢰·코호트·루프)는 thin stroke가 아니라
 * 채워진 면(filled) 형태로, 보통 `.sg`/`.sg.soft`/`.sg.brand` 라운드 사각 컨테이너 안에서 쓰인다:
 *   - 컨테이너(light blue, .sg.soft = --pb-1) + 진한 브랜드 블루 글리프(currentColor)
 *   - 일부 글리프에 lemon(#E6FF4C) 악센트 디테일
 * 작은 크기에서도 또렷하게 읽히도록 면 위주로 단순화.
 *
 * 큰 제품 글리프(ExamCoachGlyph): 레퍼런스 대형 아이콘 = 상승하는 막대/계단 +
 * lemon 최상단 계단. 랜딩 히어로/브랜드 모먼트용으로 자체 라운드 사각 컨테이너를 그린다.
 *
 * 작은 inline affordance(화살표·체크·업로드)는 가독성을 위해 단색 stroke 유지.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** lemon 악센트 강조 (활성 카드 등) */
  accent?: boolean
}

const LEMON = '#E6FF4C'

/** filled 글리프 공통 props — currentColor로 면을 채운다(컨테이너 색과 대비). */
function filled({ size = 24, accent: _accent, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true,
    focusable: false,
    ...rest,
  }
}

/** stroke 글리프 공통 props — inline affordance(화살표·체크·업로드)용. */
function stroked({ size = 24, accent: _accent, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  }
}

/* ───────────────────────── 헤드라인 글리프 (2-tone filled) ───────────────────────── */

/** 진단 ① — 돋보기로 기록을 읽음 (filled lens + lemon 하이라이트 라인) */
export function IconDiagnose({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25a1.2 1.2 0 0 0 1.7-1.7l-4.25-4.24A7.5 7.5 0 0 0 10.5 3Zm0 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
      />
      <rect x="7.6" y="9.2" width="5.8" height="1.5" rx=".75" fill={accent ? LEMON : '#fff'} opacity={accent ? 1 : 0.9} />
      <rect x="7.6" y="11.6" width="3.6" height="1.5" rx=".75" fill="#fff" opacity={0.7} />
    </svg>
  )
}

/** 처방 ② — 체크리스트/액션 플랜 (filled clipboard + lemon 첫 체크) */
export function IconPrescribe({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <path d="M9 2.5h6a1.5 1.5 0 0 1 1.5 1.5h1A2.5 2.5 0 0 1 20 6.5v13A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-13A2.5 2.5 0 0 1 6.5 4h1A1.5 1.5 0 0 1 9 2.5Zm0 1.5v1.5h6V4H9Z" />
      <path d="M7.6 9.4 8.9 10.7 11.1 8.4" stroke={accent ? LEMON : '#fff'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M7.6 14.4 8.9 15.7 11.1 13.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="12.6" y="9" width="4" height="1.5" rx=".75" fill="#fff" opacity={0.85} />
      <rect x="12.6" y="14" width="4" height="1.5" rx=".75" fill="#fff" opacity={0.85} />
    </svg>
  )
}

/** 추적 ③ — 학기별 상승 추세 (filled 축 + 상승 막대 + lemon 최상단) */
export function IconTrack({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <path d="M4 3a1 1 0 0 1 1 1v15h15a1 1 0 1 1 0 2H4.5A1.5 1.5 0 0 1 3 19.5V4a1 1 0 0 1 1-1Z" />
      <rect x="6.5" y="13" width="2.6" height="4.5" rx=".8" />
      <rect x="10.8" y="10" width="2.6" height="7.5" rx=".8" />
      <rect x="15.1" y="6.5" width="2.6" height="11" rx=".8" fill={accent ? LEMON : 'currentColor'} />
      {accent ? null : <rect x="15.1" y="6.5" width="2.6" height="2.4" rx=".8" fill={LEMON} />}
    </svg>
  )
}

/** 증명 ④ — 봉인된 리포트/증서 (filled 문서 + lemon 인장) */
export function IconProve({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <path d="M6.5 2.5h7.2a1.5 1.5 0 0 1 1.06.44l3.8 3.8A1.5 1.5 0 0 1 19 7.8V19.5A2.5 2.5 0 0 1 16.5 22h-10A2.5 2.5 0 0 1 4 19.5v-14.5A2.5 2.5 0 0 1 6.5 2.5Z" />
      <path d="M13.8 3v3.2a1 1 0 0 0 1 1H18" fill="#fff" opacity={0.85} />
      <rect x="7" y="9.6" width="6.5" height="1.5" rx=".75" fill="#fff" opacity={0.8} />
      <circle cx="14.6" cy="16.4" r="3.1" fill={LEMON} />
      <path d="M13.2 16.4 14.2 17.4 16 15.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** 무학습 · 신뢰 — 방패 + 체크 (filled shield + lemon 체크) */
export function IconShield({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <path d="M12 2.2 19 4.7a1 1 0 0 1 .66.94v5.36c0 4.9-3.2 8.6-7.32 10.26a1 1 0 0 1-.68 0C7.54 19.6 4.34 15.9 4.34 11V5.64A1 1 0 0 1 5 4.7L12 2.2Z" />
      <path d="M8.6 11.6 11 14l4.4-4.7" stroke={accent ? LEMON : '#fff'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** 코호트 — 그룹 (filled 인물 + lemon 리드) */
export function IconCohort({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <circle cx="8.5" cy="8" r="3.3" fill={accent ? LEMON : 'currentColor'} />
      <path d="M2.8 19.2c0-3.1 2.55-5.2 5.7-5.2s5.7 2.1 5.7 5.2a.8.8 0 0 1-.8.8H3.6a.8.8 0 0 1-.8-.8Z" fill={accent ? LEMON : 'currentColor'} />
      <circle cx="16.8" cy="9" r="2.5" opacity={0.78} />
      <path d="M15 14.2c2.9 0 5.2 1.9 5.2 4.9a.7.7 0 0 1-.7.7h-3.2c0-2.1-.5-3.9-1.9-5.4l.6-.2Z" opacity={0.78} />
    </svg>
  )
}

/** 닫힌 루프 — 순환 화살표 ring (filled ring + lemon 시작점) */
export function IconLoop({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3.2a8.8 8.8 0 1 0 8.34 6 1.1 1.1 0 1 0-2.08.7A6.6 6.6 0 1 1 12 5.4c1.5 0 2.88.5 3.98 1.34l-1.66.02a1.1 1.1 0 0 0 .02 2.2l4.06-.04a1.1 1.1 0 0 0 1.09-1.1l.02-4.06a1.1 1.1 0 0 0-2.2-.02l-.01 1.2A8.77 8.77 0 0 0 12 3.2Z"
      />
      {accent && <circle cx="12" cy="4.3" r="1.7" fill={LEMON} />}
    </svg>
  )
}

/* ───────────────────────── 대형 제품 글리프 ───────────────────────── */

/**
 * 입시코치 제품 글리프 — 레퍼런스 대형 아이콘.
 * 라운드 사각 컨테이너(light blue) + 상승 막대/계단(brand blue) + lemon 최상단 계단.
 * 자체 컨테이너를 그리므로 `.sg` 밖, 히어로/브랜드 모먼트에서 사용.
 */
export function ExamCoachGlyph({ size = 96, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden focusable={false} {...rest}>
      <rect x="2" y="2" width="92" height="92" rx="22" fill="var(--pb-3, #9FC8FF)" />
      <rect x="2" y="2" width="92" height="92" rx="22" fill="#fff" opacity="0.12" />
      {/* 상승 계단/막대 */}
      <rect x="22" y="58" width="14" height="16" rx="3" fill="var(--pullim-blue, #0362DA)" />
      <rect x="41" y="46" width="14" height="28" rx="3" fill="var(--pullim-blue, #0362DA)" />
      <rect x="60" y="30" width="14" height="44" rx="3" fill="var(--pullim-blue, #0362DA)" />
      {/* lemon 최상단 계단 */}
      <rect x="60" y="22" width="14" height="13" rx="3" fill={LEMON} />
    </svg>
  )
}

/* ───────────────────────── inline affordance (단색 stroke) ───────────────────────── */

/** 체크 */
export function IconCheck(p: IconProps) {
  return (
    <svg {...stroked(p)}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  )
}

/** 화살표 (CTA / connector) */
export function IconArrow(p: IconProps) {
  return (
    <svg {...stroked(p)}>
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  )
}

/** 업로드 (드롭존 affordance) */
export function IconUpload(p: IconProps) {
  return (
    <svg {...stroked(p)}>
      <path d="M12 16V4" />
      <path d="M7.5 8.5L12 4l4.5 4.5" />
      <path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  )
}

/** §23 — 법적/동의 게이트 (filled 저울 + lemon 받침) */
export function IconLegal({ accent, ...p }: IconProps) {
  return (
    <svg {...filled(p)}>
      <rect x="11.1" y="3" width="1.8" height="17" rx=".9" />
      <path d="M4 6.4 12 4l8 2.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <path d="M5 6.2 2.4 11.6h5.2L5 6.2Z" fill={accent ? LEMON : 'currentColor'} />
      <path d="M19 6.2 16.4 11.6h5.2L19 6.2Z" fill={accent ? LEMON : 'currentColor'} />
      <rect x="7.5" y="19.2" width="9" height="1.8" rx=".9" fill={LEMON} />
    </svg>
  )
}
