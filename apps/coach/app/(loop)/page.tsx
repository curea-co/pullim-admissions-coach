import { Suspense } from 'react'
import { LoopHomeClient } from './LoopHomeClient'
import { Landing } from '@/components/Landing'

export default function Page() {
  return (
    <Suspense fallback={<Landing />}>
      <LoopHomeClient />
    </Suspense>
  )
}
