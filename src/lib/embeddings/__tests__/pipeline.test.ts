import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'

// Mock the @huggingface/transformers module
vi.mock('@huggingface/transformers', () => {
  // Create a mock function that returns an embedding when called
  const mockPipelineFunction = vi.fn().mockImplementation(async () => {
    // Return a mock embedding array of 384 dimensions
    return {
      data: new Float32Array(384).fill(0.1),
    }
  })

  const mockPipeline = vi.fn().mockResolvedValue(mockPipelineFunction)

  return {
    pipeline: mockPipeline,
    env: {
      cacheDir: '',
      allowLocalModels: false,
      allowRemoteModels: true,
    },
  }
})

import { EmbeddingPipeline, generateEmbedding } from '../pipeline'
import { pipeline } from '@huggingface/transformers'

describe('EmbeddingPipeline', () => {
  beforeEach(() => {
    // Reset singleton instance between tests
    // @ts-expect-error - accessing private static property for testing
    EmbeddingPipeline.instance = null
    vi.clearAllMocks()
  })

  describe('getInstance', () => {
    it('returns a singleton instance', async () => {
      const instance1 = await EmbeddingPipeline.getInstance()
      const instance2 = await EmbeddingPipeline.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('initializes pipeline only once', async () => {
      await EmbeddingPipeline.getInstance()
      await EmbeddingPipeline.getInstance()
      await EmbeddingPipeline.getInstance()

      // Pipeline should only be called once for initialization
      expect(pipeline).toHaveBeenCalledTimes(1)
    })

    it('calls pipeline with correct model and task', async () => {
      await EmbeddingPipeline.getInstance()

      expect(pipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { dtype: 'fp32' }
      )
    })
  })

  describe('embed', () => {
    it('returns a Float32Array of 384 dimensions', async () => {
      const instance = await EmbeddingPipeline.getInstance()
      const embedding = await instance.embed('test text')

      expect(embedding).toBeInstanceOf(Float32Array)
      expect(embedding.length).toBe(384)
    })

    it('works with short text', async () => {
      const instance = await EmbeddingPipeline.getInstance()
      const embedding = await instance.embed('hi')

      expect(embedding).toBeInstanceOf(Float32Array)
      expect(embedding.length).toBe(384)
    })

    it('works with long text', async () => {
      const instance = await EmbeddingPipeline.getInstance()
      const longText = 'This is a very long text. '.repeat(100)
      const embedding = await instance.embed(longText)

      expect(embedding).toBeInstanceOf(Float32Array)
      expect(embedding.length).toBe(384)
    })

    it('handles empty string', async () => {
      const instance = await EmbeddingPipeline.getInstance()
      const embedding = await instance.embed('')

      expect(embedding).toBeInstanceOf(Float32Array)
      expect(embedding.length).toBe(384)
    })

    it('handles special characters', async () => {
      const instance = await EmbeddingPipeline.getInstance()
      const embedding = await instance.embed('Hello! @#$%^&*()')

      expect(embedding).toBeInstanceOf(Float32Array)
      expect(embedding.length).toBe(384)
    })

    it('does not re-initialize pipeline on multiple calls', async () => {
      const instance = await EmbeddingPipeline.getInstance()

      await instance.embed('text 1')
      await instance.embed('text 2')
      await instance.embed('text 3')

      // Pipeline should only be called once during getInstance
      expect(pipeline).toHaveBeenCalledTimes(1)
    })
  })
})

describe('generateEmbedding', () => {
  beforeEach(() => {
    // Reset singleton instance between tests
    // @ts-expect-error - accessing private static property for testing
    EmbeddingPipeline.instance = null
    vi.clearAllMocks()
  })

  it('returns a 384-dimension Float32Array', async () => {
    const embedding = await generateEmbedding('test text')

    expect(embedding).toBeInstanceOf(Float32Array)
    expect(embedding.length).toBe(384)
  })

  it('works with various text inputs', async () => {
    const embedding1 = await generateEmbedding('short')
    const embedding2 = await generateEmbedding('a much longer text with multiple words')
    const embedding3 = await generateEmbedding('')

    expect(embedding1).toBeInstanceOf(Float32Array)
    expect(embedding2).toBeInstanceOf(Float32Array)
    expect(embedding3).toBeInstanceOf(Float32Array)

    expect(embedding1.length).toBe(384)
    expect(embedding2.length).toBe(384)
    expect(embedding3.length).toBe(384)
  })

  it('reuses singleton instance across multiple calls', async () => {
    await generateEmbedding('text 1')
    await generateEmbedding('text 2')
    await generateEmbedding('text 3')

    // Pipeline should only be initialized once
    expect(pipeline).toHaveBeenCalledTimes(1)
  })

  it('throws error for invalid input types', async () => {
    // @ts-expect-error - testing runtime error handling
    await expect(generateEmbedding(null)).rejects.toThrow()

    // @ts-expect-error - testing runtime error handling
    await expect(generateEmbedding(undefined)).rejects.toThrow()

    // @ts-expect-error - testing runtime error handling
    await expect(generateEmbedding(123)).rejects.toThrow()
  })
})

describe('corruption recovery', () => {
  beforeEach(() => {
    // Reset singleton instance between tests
    // @ts-expect-error - accessing private static property for testing
    EmbeddingPipeline.instance = null
    vi.clearAllMocks()
  })

  it('recovers from corrupted model by retrying initialization', async () => {
    // Mock pipeline to throw Protobuf error on first call, succeed on second
    const mockPipelineFunction = vi.fn().mockImplementation(async () => ({
      data: new Float32Array(384).fill(0.1),
    }))

    let callCount = 0
    ;(pipeline as unknown as Mock).mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('Protobuf parsing failed'))
      }
      return Promise.resolve(mockPipelineFunction)
    })

    // Should recover and succeed
    const instance = await EmbeddingPipeline.getInstance()
    const embedding = await instance.embed('test text')

    // Verify pipeline was called twice (initial failure + retry after cache clear)
    expect(pipeline).toHaveBeenCalledTimes(2)

    // Verify embedding works after recovery
    expect(embedding).toBeInstanceOf(Float32Array)
    expect(embedding.length).toBe(384)
  })

  it('only retries once for corruption errors', async () => {
    // Mock pipeline to always throw Protobuf error
    vi.mocked(pipeline).mockRejectedValue(new Error('Protobuf parsing failed'))

    // Should throw after one retry
    await expect(EmbeddingPipeline.getInstance()).rejects.toThrow('Protobuf parsing failed')

    // Verify pipeline was called twice (initial + one retry)
    expect(pipeline).toHaveBeenCalledTimes(2)
  })

  it('does not retry for non-corruption errors', async () => {
    // Mock pipeline to throw a non-corruption error
    vi.mocked(pipeline).mockRejectedValue(new Error('Network timeout'))

    // Should throw without retrying
    await expect(EmbeddingPipeline.getInstance()).rejects.toThrow('Network timeout')

    // Verify pipeline was called once only (no retry)
    expect(pipeline).toHaveBeenCalledTimes(1)
  })

  it('detects corruption error patterns', async () => {
    // Test all three corruption patterns
    const corruptionErrors = [
      'Protobuf parsing failed',
      'failed to load model weights',
      'Invalid model file format'
    ]

    for (const errorMsg of corruptionErrors) {
      // Reset between iterations
      // @ts-expect-error - accessing private static property for testing
      EmbeddingPipeline.instance = null
      vi.clearAllMocks()

      let callCount = 0
      ;(pipeline as unknown as Mock).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error(errorMsg))
        }
        return Promise.resolve(vi.fn().mockImplementation(async () => ({
          data: new Float32Array(384).fill(0.1),
        })))
      })

      // Should detect corruption and retry
      await EmbeddingPipeline.getInstance()

      // Verify retry happened
      expect(pipeline).toHaveBeenCalledTimes(2)
    }
  })
})
