/**
 * Manual test script for embeddings pipeline
 * Run with: npx tsx scripts/test-embeddings.ts
 *
 * Note: This will download the model on first run (~90MB)
 */

import { generateEmbedding } from '../src/lib/embeddings'

async function testEmbeddings() {
  console.log('Testing embeddings pipeline...\n')

  const testTexts = [
    'Hello, world!',
    'This is a test of the embedding system.',
    'Claude Code is awesome',
  ]

  for (const text of testTexts) {
    console.log(`Testing: "${text}"`)
    const start = Date.now()
    const embedding = await generateEmbedding(text)
    const duration = Date.now() - start

    console.log(`  - Generated ${embedding.length}-dimensional embedding in ${duration}ms`)
    console.log(`  - First 5 values: [${Array.from(embedding.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}]`)
    console.log()
  }

  console.log('Testing reuse (should be much faster)...')
  const start = Date.now()
  await generateEmbedding('Quick test')
  const duration = Date.now() - start
  console.log(`  - Completed in ${duration}ms (pipeline reused)\n`)

  console.log('All tests passed!')
}

testEmbeddings().catch(console.error)
