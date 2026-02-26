import { rm } from 'fs/promises'
import { resolve } from 'path'

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

    const { pipeline, env } = await getTransformers()

    // Configure Transformers.js for Vercel compatibility
    env.cacheDir = '/tmp/.cache'
    env.allowLocalModels = false
    env.allowRemoteModels = true

    // No explicit device — both dev and production use webpack to alias
    // onnxruntime-node → onnxruntime-web. getTransformers() sets wasmPaths
    // so WASM files load from local filesystem instead of CDN.
    const pipelinePromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' })
    this.initPromise = pipelinePromise as unknown as Promise<EmbeddingPipelineType>

    try {
      this.pipeline = await this.initPromise
      return this.pipeline
    } catch (error) {
      // Check if this is a corruption error that can be recovered
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isCorruption =
        errorMessage.includes('Protobuf') ||
        errorMessage.includes('failed to load model') ||
        errorMessage.includes('Invalid model')

      if (isCorruption && !this.hasRetried) {
        // Mark that we've attempted recovery
        this.hasRetried = true

        // Try to clear the corrupted cache
        try {
          await rm('/tmp/.cache/Xenova/all-MiniLM-L6-v2', {
            recursive: true,
            force: true
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
