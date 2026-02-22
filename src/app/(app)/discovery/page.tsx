import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DiscoveryContent } from '@/components/discovery/DiscoveryContent'

export const metadata: Metadata = {
  title: 'Discovery | Gold Miner',
}

export default function Discovery() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <DiscoveryContent />
    </Suspense>
  )
}
