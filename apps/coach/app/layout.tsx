import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Fraunces, DM_Mono } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-dm-mono',
})

export const metadata: Metadata = {
  title: '풀림 입시코치 — 생기부 실행 루프',
  description:
    '지금 무엇을 해야 생기부가 채워지는가. 진단 → 합법 액션 처방 → 학기별 추적 → 증명까지 한 흐름으로 돕는 고1·2 학종 코치. 무학습·즉시삭제.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${fraunces.variable} ${dmMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
