import { Suspense } from 'react'
import { KnowledgeBankContent } from '@/components/knowledge-bank/KnowledgeBankContent'

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <KnowledgeBankContent />
    </Suspense>
  )
}
