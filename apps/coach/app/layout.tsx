import './globals.css'
import type { ReactNode } from 'react'

export const metadata = { title: '풀림 입시코치', description: '생기부 실행 루프' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko"><body><main className="mx-auto max-w-3xl p-6">{children}</main></body></html>
  )
}
