import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { rm, mkdir } from 'fs/promises'

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

import { EmbeddingPipeline, generateEmbedding, _testing } from '../pipeline'
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
    const mockPipelineFunction = vi.fn().mockImplementation(async () => ({
      data: new Float32Array(384).fill(0.1),
    }))

    let callCount = 0
    ;(pipeline as unknown as Mock).mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Use lowercase — this is what production actually emits
        return Promise.reject(new Error('protobuf parsing failed'))
      }
      return Promise.resolve(mockPipelineFunction)
    })

    const instance = await EmbeddingPipeline.getInstance()
    const embedding = await instance.embed('test text')

    expect(pipeline).toHaveBeenCalledTimes(2)
    expect(embedding).toBeInstanceOf(Float32Array)
    expect(embedding.length).toBe(384)
  })

  it('only retries once for corruption errors', async () => {
    vi.mocked(pipeline).mockRejectedValue(new Error('protobuf parsing failed'))

    await expect(EmbeddingPipeline.getInstance()).rejects.toThrow('protobuf parsing failed')
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

  it('detects corruption error patterns case-insensitively', async () => {
    // Test lowercase variants that production actually emits
    const corruptionErrors = [
      'protobuf parsing failed',         // lowercase — the actual Vercel error
      'Failed to load model weights',    // uppercase F — the actual Vercel error
      'invalid model file format',       // lowercase
      'Protobuf parsing failed',         // uppercase — original test case (still works)
      'PROTOBUF PARSING FAILED',         // all caps — edge case
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

      // Should detect corruption and retry regardless of case
      await EmbeddingPipeline.getInstance()

      // Verify retry happened
      expect(pipeline).toHaveBeenCalledTimes(2)
    }
  })
})

describe('version-aware caching', () => {
  it('reads ORT version and constructs versioned cache path', () => {
    expect(_testing.ORT_VERSION).toBeTruthy()
    expect(typeof _testing.ORT_VERSION).toBe('string')
    expect(_testing.CACHE_BASE).toBe(`/tmp/.cache/ort-${_testing.ORT_VERSION}`)
    expect(_testing.MODEL_CACHE_PATH).toBe(`${_testing.CACHE_BASE}/Xenova/all-MiniLM-L6-v2`)
    expect(_testing.VERSION_MARKER_PATH).toBe(`${_testing.CACHE_BASE}/.ort-version`)
  })

  it('getOrtVersion returns a valid semver-like string', () => {
    const version = _testing.getOrtVersion()
    expect(version).toBeTruthy()
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('validateCacheVersion', () => {
  // Tests use the real filesystem against CACHE_BASE (in /tmp — always writable).
  // Each test sets up the desired precondition, calls validateCacheVersion(),
  // and verifies the resulting filesystem state.

  beforeEach(async () => {
    // Start each test with a clean slate — remove the cache base if it exists
    await rm(_testing.CACHE_BASE, { recursive: true, force: true })
  })

  afterEach(async () => {
    // Clean up after each test
    await rm(_testing.CACHE_BASE, { recursive: true, force: true })
  })

  it('clears cache when marker has different version', async () => {
    // Arrange: create CACHE_BASE with a stale version marker and a dummy file
    await mkdir(_testing.CACHE_BASE, { recursive: true })
    writeFileSync(_testing.VERSION_MARKER_PATH, 'stale-version-0.0.0', 'utf-8')
    writeFileSync(`${_testing.CACHE_BASE}/dummy-weight.bin`, 'data', 'utf-8')

    // Verify preconditions
    expect(existsSync(`${_testing.CACHE_BASE}/dummy-weight.bin`)).toBe(true)

    // Act: validateCacheVersion should detect mismatch and clear CACHE_BASE
    await _testing.validateCacheVersion()

    // Assert: CACHE_BASE was re-created fresh (dummy file gone)
    expect(existsSync(_testing.CACHE_BASE)).toBe(true)
    expect(existsSync(`${_testing.CACHE_BASE}/dummy-weight.bin`)).toBe(false)
  })

  it('does not clear cache when marker matches current version', async () => {
    // Arrange: create CACHE_BASE with the current version marker and a dummy file
    await mkdir(_testing.CACHE_BASE, { recursive: true })
    writeFileSync(_testing.VERSION_MARKER_PATH, _testing.ORT_VERSION, 'utf-8')
    writeFileSync(`${_testing.CACHE_BASE}/model-weights.bin`, 'data', 'utf-8')

    // Act
    await _testing.validateCacheVersion()

    // Assert: CACHE_BASE preserved — dummy file still exists
    expect(existsSync(`${_testing.CACHE_BASE}/model-weights.bin`)).toBe(true)
  })

  it('creates cache directory when marker does not exist', async () => {
    // Arrange: CACHE_BASE does not exist (cleaned in beforeEach)
    expect(existsSync(_testing.CACHE_BASE)).toBe(false)

    // Act
    await _testing.validateCacheVersion()

    // Assert: CACHE_BASE was created
    expect(existsSync(_testing.CACHE_BASE)).toBe(true)
  })

  it('handles validation errors gracefully', async () => {
    // validateCacheVersion wraps everything in try/catch — errors just log a warning
    // Arrange: CACHE_BASE does not exist (beforeEach removed it)
    // The function should resolve (not reject) even if unexpected errors occur
    await expect(_testing.validateCacheVersion()).resolves.toBeUndefined()
  })
})

describe('writeVersionMarker', () => {
  beforeEach(async () => {
    // Ensure CACHE_BASE exists so writeVersionMarker can write to it
    await mkdir(_testing.CACHE_BASE, { recursive: true })
  })

  afterEach(async () => {
    await rm(_testing.CACHE_BASE, { recursive: true, force: true })
  })

  it('writes current ORT version to marker file', () => {
    _testing.writeVersionMarker()

    expect(existsSync(_testing.VERSION_MARKER_PATH)).toBe(true)
    const written = readFileSync(_testing.VERSION_MARKER_PATH, 'utf-8')
    expect(written).toBe(_testing.ORT_VERSION)
  })

  it('handles write errors gracefully', () => {
    // Remove CACHE_BASE so the write will fail (path doesn't exist)
    // writeVersionMarker catches the error and logs a warning — should not throw
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Remove the dir so writing fails
    rmSync(_testing.CACHE_BASE, { recursive: true, force: true })

    // Should not throw — errors are caught internally
    expect(() => _testing.writeVersionMarker()).not.toThrow()

    // Should have warned about the failure
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
