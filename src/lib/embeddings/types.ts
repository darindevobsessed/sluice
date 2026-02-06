export interface TranscriptSegment {
  text: string;
  offset: number; // milliseconds
}

export interface ChunkData {
  content: string;
  startTime: number; // milliseconds
  endTime: number; // milliseconds
  segmentIndices: number[]; // which segments this chunk came from
}

export interface ChunkWithEmbedding extends ChunkData {
  embedding: number[];
  error?: string; // Present if embedding failed for this chunk
}

export interface EmbedChunksResult {
  chunks: ChunkWithEmbedding[];
  totalChunks: number;
  successCount: number;
  errorCount: number;
  durationMs: number;
  relationshipsCreated?: number;
}
