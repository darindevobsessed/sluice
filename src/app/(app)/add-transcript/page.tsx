import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AddTranscriptPage } from '@/components/add-transcript/AddTranscriptPage'

export const metadata: Metadata = {
  title: 'Add Transcript | Gold Miner',
}

export default function AddTranscript() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <AddTranscriptPage />
    </Suspense>
  )
}
