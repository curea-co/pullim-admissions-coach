/**
 * Pullim-style inline SVG icons.
 * Geometric, stroke-based (1.75), rounded caps/joins, blue currentColor stroke
 * with optional electric-lemon accent fill. 24px default canvas.
 * Used in loop stage headers, the 4-stage explainer, trust strip, and intake.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** lemon accent fill on the highlight shape */
  accent?: boolean
}

function base({ size = 24, accent, ...rest }: IconProps) {
  return {
    accent: accent ?? false,
    props: {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.75,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      'aria-hidden': true,
      ...rest,
    },
  }
}

const LEMON = '#E6FF4C'

/** 진단 ① — magnifier reading a record */
export function IconDiagnose(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" fill={accent ? LEMON : 'none'} stroke="currentColor" />
      <path d="M15.5 15.5L21 21" />
      <path d="M8 10.5h5M8 13h3" />
    </svg>
  )
}

/** 처방 ② — checklist / action plan */
export function IconPrescribe(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" fill={accent ? LEMON : 'none'} stroke="currentColor" />
      <path d="M8 8.5l1.4 1.4L12 7.3" />
      <path d="M8 14.5l1.4 1.4L12 13.3" />
      <path d="M14.5 9h2.5M14.5 15h2.5" />
    </svg>
  )
}

/** 추적 ③ — trend over semesters */
export function IconTrack(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <path d="M7 15l3.5-3.5 2.5 2.5L20 7" />
      {accent ? <circle cx="20" cy="7" r="2" fill={LEMON} stroke="currentColor" /> : <path d="M20 7v0" />}
      <path d="M17 7h3v3" />
    </svg>
  )
}

/** 증명 ④ — sealed report / certificate */
export function IconProve(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <path d="M6 3h9l4 4v9.5" />
      <path d="M15 3v4h4" />
      <circle cx="9.5" cy="15.5" r="3.5" fill={accent ? LEMON : 'none'} stroke="currentColor" />
      <path d="M7.6 18.4L6.5 22l3-1.6L12.5 22l-1.1-3.6" />
    </svg>
  )
}

/** 무학습 · 신뢰 — shield with check */
export function IconShield(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <path d="M12 3l7 2.5v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V5.5L12 3z" fill={accent ? LEMON : 'none'} stroke="currentColor" />
      <path d="M8.7 12l2.2 2.2L15.4 9.5" />
    </svg>
  )
}

/** 코호트 — group / cohort */
export function IconCohort(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <circle cx="9" cy="8" r="3.2" fill={accent ? LEMON : 'none'} stroke="currentColor" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15 14.2c2.6.1 5 1.9 5 4.8" />
    </svg>
  )
}

/** 닫힌 루프 — closed-loop ring with cycle arrows */
export function IconLoop(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" />
      <path d="M18 3v4h-4" />
      {accent && <circle cx="12" cy="4" r="1.8" fill={LEMON} stroke="currentColor" />}
    </svg>
  )
}

/** 체크 */
export function IconCheck(p: IconProps) {
  const { props } = base(p)
  return (
    <svg {...props}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  )
}

/** 화살표 (CTA / connector) */
export function IconArrow(p: IconProps) {
  const { props } = base(p)
  return (
    <svg {...props}>
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  )
}

/** §23 — legal / consent gate */
export function IconLegal(p: IconProps) {
  const { accent, props } = base(p)
  return (
    <svg {...props}>
      <path d="M12 3v18" />
      <path d="M5 6l3.5-1.2M19 6l-3.5-1.2" />
      <path d="M5 6l-2.2 5h4.4L5 6zM19 6l-2.2 5h4.4L19 6z" fill={accent ? LEMON : 'none'} stroke="currentColor" />
      <path d="M8 21h8" />
    </svg>
  )
}
