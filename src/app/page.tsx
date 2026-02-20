import { Suspense } from 'react'
import { KnowledgeBankContent } from '@/components/knowledge-bank/KnowledgeBankContent'
import { KnowledgeBankPageSkeleton } from '@/components/knowledge-bank/KnowledgeBankPageSkeleton'

export default function Home() {
  return (
    <Suspense fallback={<KnowledgeBankPageSkeleton />}>
      <KnowledgeBankContent />
    </Suspense>
  )
}
