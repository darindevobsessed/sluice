import { readFileSync, existsSync, writeFileSync } from 'fs'
import { rm, mkdir } from 'fs/promises'
import { resolve } from 'path'

/**
 * Read the installed onnxruntime-web version from its package.json.
 * Used to namespace the model cache directory so version upgrades
 * automatically bypass stale/corrupt cached models.
 */
function getOrtVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), 'node_modules/onnxruntime-web/package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version as string
  } catch {
    return 'unknown'
  }
}

/** Cached ORT version — read once per process lifetime */
const ORT_VERSION = getOrtVersion()

/** Base cache directory, namespaced by onnxruntime-web version */
const CACHE_BASE = `/tmp/.cache/ort-${ORT_VERSION}`

/** Path to the model within the versioned cache */
const MODEL_CACHE_PATH = `${CACHE_BASE}/Xenova/all-MiniLM-L6-v2`

/** Version marker file to detect same-version corruption */
const VERSION_MARKER_PATH = `${CACHE_BASE}/.ort-version`

/**
 * Check the version marker file in the cache directory.
 * If it exists with a different version, clear the entire cache.
 * If it doesn't exist, the cache is fresh — marker gets written after
 * successful pipeline initialization.
 */
async function validateCacheVersion(): Promise<void> {
  try {
    if (existsSync(VERSION_MARKER_PATH)) {
      const cached = readFileSync(VERSION_MARKER_PATH, 'utf-8').trim()
      if (cached !== ORT_VERSION) {
        console.log(`ORT version changed (${cached} -> ${ORT_VERSION}), clearing model cache`)
        await rm(CACHE_BASE, { recursive: true, force: true })
      }
    }
    // Ensure the cache directory exists
    await mkdir(CACHE_BASE, { recursive: true })
  } catch (error) {
    console.warn('Cache version validation failed:', error)
  }
}

/**
 * Write the version marker after successful pipeline initialization.
 */
function writeVersionMarker(): void {
  try {
    writeFileSync(VERSION_MARKER_PATH, ORT_VERSION, 'utf-8')
  } catch (error) {
    console.warn('Failed to write version marker:', error)
  }
}

/**
 * Type for the embedding pipeline function.
 * The actual type from @huggingface/transformers is too complex,
 * so we define a simplified interface that matches our usage.
 */
interface EmbeddingPipelineFunction {
  (
    text: string,
    options?: { pooling?: string; normalize?: boolean }
  ): Promise<{ data: Float32Array }>
}

type EmbeddingPipelineType = EmbeddingPipelineFunction

/** Lazily loaded transformers module */
let transformersModule: {
  pipeline: typeof import('@huggingface/transformers').pipeline
  env: typeof import('@huggingface/transformers').env
} | null = null

/**
 * Import transformers.js and configure ONNX WASM paths.
 *
 * Both dev and production use webpack to alias onnxruntime-node → onnxruntime-web.
 * Without explicit wasmPaths, onnxruntime-web tries to load WASM via
 * import('https://cdn...') which Node.js rejects (ERR_UNSUPPORTED_ESM_URL_SCHEME).
 *
 * We pin onnxruntime-web to the exact version @huggingface/transformers expects
 * and use npm overrides to force deduplication into a single top-level copy.
 * Configure through env.backends.onnx — the ort.env that transformers.js
 * actually uses internally (see backends/onnx.js line 236).
 */
async function getTransformers() {
  if (!transformersModule) {
    const mod = await import('@huggingface/transformers')

    // env.backends.onnx is ort.env from onnxruntime-web that
    // transformers.js uses internally. Configure WASM paths here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ortEnv = (mod.env as any).backends?.onnx
    if (ortEnv?.wasm) {
      ortEnv.wasm.numThreads = 1
      ortEnv.wasm.proxy = false
      // Point to local WASM files so Node.js doesn't try to fetch from CDN.
      const ortDir = 'node_modules/onnxruntime-web/dist'
      ortEnv.wasm.wasmPaths = process.env.VERCEL
        ? `/var/task/${ortDir}/`
        : resolve(process.cwd(), ortDir) + '/'
    }

    transformersModule = { pipeline: mod.pipeline, env: mod.env }
  }
  return transformersModule
}

/**
 * Singleton class for managing the embedding pipeline.
 * Preserves the pipeline instance across requests to avoid re-downloading the model.
 */
export class EmbeddingPipeline {
  private static instance: EmbeddingPipeline | null = null
  private pipeline: EmbeddingPipelineType | null = null
  private initPromise: Promise<EmbeddingPipelineType> | null = null
  private hasRetried = false

  private constructor() {}

  /**
   * Get the singleton instance of the embedding pipeline.
   * Initializes the pipeline on first call and reuses it for subsequent calls.
   */
  static async getInstance(): Promise<EmbeddingPipeline> {
    if (!EmbeddingPipeline.instance) {
      EmbeddingPipeline.instance = new EmbeddingPipeline()
      await EmbeddingPipeline.instance.initialize()
    }
    return EmbeddingPipeline.instance
  }

  /**
   * Initialize the embedding pipeline.
   * Uses Xenova/all-MiniLM-L6-v2 model which produces 384-dimensional embeddings.
   */
  private async initialize(): Promise<EmbeddingPipelineType> {
    // If already initialized, return the existing pipeline
    if (this.pipeline) {
      return this.pipeline
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise
    }

    // Validate cache version before loading model
    await validateCacheVersion()

    const { pipeline, env } = await getTransformers()

    // Configure Transformers.js for Vercel compatibility
    env.cacheDir = CACHE_BASE
    env.allowLocalModels = false
    env.allowRemoteModels = true

    // No explicit device — both dev and production use webpack to alias
    // onnxruntime-node → onnxruntime-web. getTransformers() sets wasmPaths
    // so WASM files load from local filesystem instead of CDN.
    const pipelinePromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' })
    this.initPromise = pipelinePromise as unknown as Promise<EmbeddingPipelineType>

    try {
      this.pipeline = await this.initPromise
      writeVersionMarker()
      return this.pipeline
    } catch (error) {
      // Check if this is a corruption error that can be recovered
      const errorMessage = error instanceof Error ? error.message : String(error)
      const lowerError = errorMessage.toLowerCase()
      const isCorruption =
        lowerError.includes('protobuf') ||
        lowerError.includes('failed to load model') ||
        lowerError.includes('invalid model')

      if (isCorruption && !this.hasRetried) {
        // Mark that we've attempted recovery
        this.hasRetried = true

        // Try to clear the corrupted cache
        try {
          await rm(MODEL_CACHE_PATH, {
            recursive: true,
            force: true,
          })
        } catch (cleanupError) {
          // Log but don't fail on cleanup error
          console.warn('Failed to clear cache:', cleanupError)
        }

        // Reset state and retry initialization
        this.initPromise = null
        this.pipeline = null
        return this.initialize()
      }

      // Reset state on failure so it can be retried
      this.initPromise = null
      throw error
    }
  }

  /**
   * Generate an embedding for the given text.
   * @param text - The text to embed
   * @returns A Float32Array of 384 dimensions
   */
  async embed(text: string): Promise<Float32Array> {
    if (!this.pipeline) {
      await this.initialize()
    }

    if (!this.pipeline) {
      throw new Error('Failed to initialize embedding pipeline')
    }

    const result = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    })

    return result.data
  }
}

/**
 * Convenience function to generate embeddings without managing the pipeline directly.
 * @param text - The text to embed
 * @returns A Float32Array of 384 dimensions
 * @throws Error if text is not a string
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  // Validate input
  if (typeof text !== 'string') {
    throw new TypeError(
      `Expected text to be a string, got ${typeof text}`
    )
  }

  const instance = await EmbeddingPipeline.getInstance()
  return instance.embed(text)
}

/** @internal — exported for testing only */
export const _testing = {
  getOrtVersion,
  ORT_VERSION,
  CACHE_BASE,
  MODEL_CACHE_PATH,
  VERSION_MARKER_PATH,
  validateCacheVersion,
  writeVersionMarker,
}
