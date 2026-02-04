export interface TranscriptSegment {
  timestamp: string; // "0:00", "1:30", "10:45"
  seconds: number; // 0, 90, 645
  text: string; // The content for this segment
}
