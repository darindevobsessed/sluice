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
