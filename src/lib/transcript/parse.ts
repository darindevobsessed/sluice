import type { TranscriptSegment } from './types';

/**
 * Convert timestamp string to seconds.
 * Supports both MM:SS and H:MM:SS formats.
 *
 * @example
 * timestampToSeconds('1:30') // 90
 * timestampToSeconds('1:00:00') // 3600
 */
export function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);

  if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    // H:MM:SS format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

/**
 * Convert seconds to timestamp string.
 * Uses MM:SS for < 1 hour, H:MM:SS for >= 1 hour.
 *
 * @example
 * secondsToTimestamp(90) // '1:30'
 * secondsToTimestamp(3600) // '1:00:00'
 */
export function secondsToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format duration in seconds to human-readable timestamp.
 * Alias for secondsToTimestamp for semantic clarity.
 *
 * @example
 * formatDuration(185) // '3:05'
 * formatDuration(3665) // '1:01:05'
 */
export function formatDuration(seconds: number): string {
  return secondsToTimestamp(seconds);
}

/**
 * Check if a line is a timestamp.
 * Matches formats: MM:SS or H:MM:SS
 */
function isTimestamp(line: string): boolean {
  return /^\d+:\d{2}(:\d{2})?$/.test(line.trim());
}

/**
 * Parse YouTube transcript format into structured segments.
 *
 * Format:
 * ```
 * 0:00
 * Text content
 * More content
 * 1:30
 * Next segment
 * ```
 *
 * Handles:
 * - Multi-line text between timestamps
 * - Both MM:SS and H:MM:SS formats
 * - Malformed input (returns single segment at 0:00)
 * - Empty input (returns empty array)
 *
 * @example
 * parseTranscript('0:00\nIntro\n1:30\nMain content')
 * // [
 * //   { timestamp: '0:00', seconds: 0, text: 'Intro' },
 * //   { timestamp: '1:30', seconds: 90, text: 'Main content' }
 * // ]
 */
export function parseTranscript(raw: string): TranscriptSegment[] {
  if (!raw || raw.trim() === '') {
    return [];
  }

  const lines = raw.split('\n');
  const segments: TranscriptSegment[] = [];
  let currentTimestamp: string | null = null;
  let currentTextLines: string[] = [];

  const finishSegment = () => {
    if (currentTimestamp !== null && currentTextLines.length > 0) {
      const text = currentTextLines
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .join('\n');

      if (text) {
        segments.push({
          timestamp: currentTimestamp,
          seconds: timestampToSeconds(currentTimestamp),
          text,
        });
      }
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (isTimestamp(trimmedLine)) {
      // Finish the previous segment
      finishSegment();

      // Start a new segment
      currentTimestamp = trimmedLine;
      currentTextLines = [];
    } else if (trimmedLine !== '') {
      // Accumulate text lines
      currentTextLines.push(trimmedLine);
    }
  }

  // Finish the last segment
  finishSegment();

  // If no timestamps were found, treat entire input as one segment
  if (segments.length === 0 && currentTextLines.length > 0) {
    const text = currentTextLines
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .join('\n');

    if (text) {
      segments.push({
        timestamp: '0:00',
        seconds: 0,
        text,
      });
    }
  }

  // If no segments at all but we have non-empty input, return the raw text
  if (segments.length === 0 && raw.trim() !== '') {
    segments.push({
      timestamp: '0:00',
      seconds: 0,
      text: raw.trim(),
    });
  }

  return segments;
}
