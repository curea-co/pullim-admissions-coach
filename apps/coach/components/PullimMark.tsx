import Image from 'next/image'

type Props = {
  size?: number
  showWordmark?: boolean
  /** secondary label after wordmark, e.g. "입시코치" */
  sub?: string
  variant?: 'blue' | 'black' | 'white'
  className?: string
}

/**
 * Pullim brand lockup — adapted from pullim-web/src/components/ui/PullimMark.tsx.
 * Uses the canonical master-*.png wordmark glyph + Pretendard wordmark, with an
 * optional mono sub-label (입시코치) divided by a hairline.
 */
export function PullimMark({
  size = 28,
  showWordmark = true,
  sub,
  variant = 'blue',
  className,
}: Props) {
  const src =
    variant === 'white'
      ? '/brand/master-white.png'
      : variant === 'black'
      ? '/brand/master-black.png'
      : '/brand/master-blue.png'
  const wmColor =
    variant === 'white' ? '#FFFFFF' : variant === 'black' ? 'var(--pullim-ink)' : 'var(--pullim-blue)'
  const subColor = variant === 'white' ? 'rgba(255,255,255,.7)' : 'var(--fg-muted)'
  const subLine = variant === 'white' ? 'rgba(255,255,255,.28)' : 'var(--hairline)'
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.max(8, size * 0.42),
        fontFamily: 'var(--f-brand)',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: wmColor,
      }}
      aria-label={`풀림 PULLIM${sub ? ' ' + sub : ''}`}
    >
      <Image src={src} alt="" width={size} height={size} priority style={{ width: size, height: size }} />
      {showWordmark && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: 'var(--f-kr)', fontWeight: 800, fontSize: size * 0.7, color: wmColor }}>
            풀림
          </span>
          {sub && (
            <span
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: Math.max(11, size * 0.42),
                fontWeight: 500,
                letterSpacing: '0.04em',
                color: subColor,
                paddingLeft: 9,
                borderLeft: `1px solid ${subLine}`,
              }}
            >
              {sub}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
