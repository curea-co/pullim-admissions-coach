'use client'

/**
 * Offline fallback — precached by the service worker and served for navigation
 * requests when the network is unavailable. Pullim-styled, minimal.
 */
export default function OfflinePage() {
  return (
    <main
      id="main"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--s-5)',
        padding: 'var(--s-6)',
        textAlign: 'center',
        background: 'var(--bg)',
        color: 'var(--fg)',
      }}
    >
      <svg
        width="72"
        height="72"
        viewBox="0 0 64 64"
        role="img"
        aria-label="풀림 입시코치"
        style={{ borderRadius: 16 }}
      >
        <rect width="64" height="64" rx="16" fill="#0362DA" />
        <path
          d="M23 17v30M23 17h11a9.5 9.5 0 0 1 0 19H23"
          fill="none"
          stroke="#fff"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="46" cy="46" r="7" fill="#E6FF4C" />
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        <h1
          style={{
            fontFamily: 'var(--f-brand)',
            fontWeight: 700,
            fontSize: 'clamp(20px, 5vw, 26px)',
            margin: 0,
          }}
        >
          오프라인입니다
        </h1>
        <p style={{ color: 'var(--fg-muted)', margin: 0, fontSize: 15 }}>
          연결되면 다시 시도해 주세요.
        </p>
      </div>

      <button
        type="button"
        className="btn-primary"
        aria-label="다시 시도"
        onClick={() => {
          // Re-request the page the user was trying to reach.
          window.location.reload()
        }}
      >
        다시 시도
      </button>
    </main>
  )
}
