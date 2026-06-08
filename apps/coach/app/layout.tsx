import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Bai_Jamjuree, JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'

const baiJamjuree = Bai_Jamjuree({
  variable: '--font-bai-jamjuree',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

const pretendard = localFont({
  src: '../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
  weight: '45 920',
})

export const metadata: Metadata = {
  title: '풀림 입시코치 — 생기부 실행 루프',
  description:
    '지금 무엇을 해야 생기부가 채워지는가. 진단 → 합법 액션 처방 → 학기별 추적 → 증명까지 한 흐름으로 돕는 고1·2 학종 코치. 무학습·즉시삭제.',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${baiJamjuree.variable} ${jetbrainsMono.variable} ${pretendard.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
