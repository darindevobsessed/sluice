import { pipeline, env } from '@huggingface/transformers'

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

/**
 * Singleton class for managing the embedding pipeline.
 * Preserves the pipeline instance across requests to avoid re-downloading the model.
 */
export class EmbeddingPipeline {
  private static instance: EmbeddingPipeline | null = null
  private pipeline: EmbeddingPipelineType | null = null
  private initPromise: Promise<EmbeddingPipelineType> | null = null

  private constructor() {
    // Configure Transformers.js for Vercel compatibility
    env.cacheDir = '/tmp/.cache'
    env.allowLocalModels = false
    env.allowRemoteModels = true
  }

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

    // Start initialization - cast to our simplified type
    const pipelinePromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' })
    this.initPromise = pipelinePromise as unknown as Promise<EmbeddingPipelineType>

    try {
      this.pipeline = await this.initPromise
      return this.pipeline
    } catch (error) {
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
