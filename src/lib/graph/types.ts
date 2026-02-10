export interface ChunkRelationship {
  sourceChunkId: number
  targetChunkId: number
  similarity: number
}

export interface RelatedChunk {
  chunkId: number
  content: string
  startTime: number
  endTime: number
  similarity: number
  video: {
    id: number
    title: string
    channel: string | null
    youtubeId: string | null
  }
}
