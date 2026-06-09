import type { MetadataRoute } from 'next'

/**
 * Web App Manifest for the 풀림 입시코치 PWA.
 * Served at /manifest.webmanifest by Next's metadata route.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '풀림 입시코치',
    short_name: '입시코치',
    description: '진단 → 합법 액션 처방 → 학기별 추적 → 증명까지, 생기부 실행 루프를 한 흐름으로.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0F6FB',
    theme_color: '#0362DA',
    lang: 'ko',
    categories: ['education'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
