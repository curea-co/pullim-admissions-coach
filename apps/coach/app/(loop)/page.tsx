import { Suspense } from 'react'
import { LoopHomeClient } from './LoopHomeClient'

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden style={{ minHeight: '100vh' }} />}>
      <LoopHomeClient />
    </Suspense>
  )
}
