'use client'

import { useEffect, useState } from 'react'

/**
 * Registers the service worker and surfaces a subtle, dismissible install
 * affordance.
 *
 *  - Android/Chrome: captures `beforeinstallprompt` and shows a "홈 화면에 추가"
 *    button that triggers the native prompt.
 *  - iOS Safari: no beforeinstallprompt — shows a one-line hint
 *    ("공유 → 홈 화면에 추가") instead.
 *  - Dismissal persists in localStorage so it never nags.
 *  - Hidden entirely when already running standalone (installed).
 */

const DISMISS_KEY = 'pullim-coach:pwa-install-dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari legacy flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOSDevice = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ reports as Mac; detect via touch + Safari.
  const iPadOS = /Macintosh/i.test(ua) && 'ontouchend' in window
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua)
  return (iOSDevice || iPadOS) && isSafari
}

export function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(true) // default hidden until we decide

  // Register the service worker. Harmless in dev; required in prod.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failures are non-fatal */
      })
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => window.removeEventListener('load', onLoad)
  }, [])

  // Decide whether to show any affordance.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return // already installed → nothing to show
    let persisted = false
    try {
      persisted = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      /* private mode / blocked storage */
    }
    if (persisted) return
    setDismissed(false)

    // iOS has no beforeinstallprompt — show the manual hint.
    if (isIos()) setShowIosHint(true)

    const onBip = (e: Event) => {
      e.preventDefault() // stash it; show our own button
      setDeferred(e as BeforeInstallPromptEvent)
      setShowIosHint(false)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    const onInstalled = () => dismiss()
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setDismissed(true)
    setDeferred(null)
    setShowIosHint(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    try {
      await deferred.userChoice
    } catch {
      /* ignore */
    }
    dismiss()
  }

  const visible = !dismissed && (deferred !== null || showIosHint)
  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="앱 설치 안내"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 'calc(100vw - 24px)',
        padding: '8px 10px 8px 14px',
        background: 'var(--bg-raised, #fff)',
        color: 'var(--fg, #0D1A1F)',
        border: '1px solid var(--hairline, #D6E2EE)',
        borderRadius: 'var(--r-md, 10px)',
        boxShadow: '0 8px 24px rgba(13,26,31,.14)',
        fontFamily: 'var(--f-kr)',
        fontSize: 13.5,
        lineHeight: 1.35,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0, borderRadius: 6 }}>
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

      {deferred ? (
        <>
          <span style={{ color: 'var(--fg-muted)' }}>입시코치를 홈 화면에서 바로 열어요</span>
          <button
            type="button"
            onClick={install}
            aria-label="홈 화면에 추가"
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 'var(--r-sm, 6px)',
              border: 'none',
              background: 'var(--pullim-blue, #0362DA)',
              color: '#fff',
              fontFamily: 'var(--f-brand)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            홈 화면에 추가
          </button>
        </>
      ) : (
        <span style={{ color: 'var(--fg-muted)' }}>
          공유 <span aria-hidden="true">→</span> 홈 화면에 추가
        </span>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="설치 안내 닫기"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--r-sm, 6px)',
          border: 'none',
          background: 'transparent',
          color: 'var(--fg-subtle, #5E6B72)',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
