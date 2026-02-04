import { describe, it, expect } from 'vitest';
import {
  parseTranscript,
  timestampToSeconds,
  secondsToTimestamp,
  formatDuration,
} from '../parse';

describe('parseTranscript', () => {
  it('parses simple transcript with timestamps', () => {
    const raw = `0:00
Introduction to the topic
0:45
Main content begins here
1:30
Next section`;

    const result = parseTranscript(raw);

    expect(result).toEqual([
      {
        timestamp: '0:00',
        seconds: 0,
        text: 'Introduction to the topic',
      },
      {
        timestamp: '0:45',
        seconds: 45,
        text: 'Main content begins here',
      },
      {
        timestamp: '1:30',
        seconds: 90,
        text: 'Next section',
      },
    ]);
  });

  it('handles multi-line text between timestamps', () => {
    const raw = `0:00
First line
Second line
Third line
1:00
Next segment`;

    const result = parseTranscript(raw);

    expect(result).toEqual([
      {
        timestamp: '0:00',
        seconds: 0,
        text: 'First line\nSecond line\nThird line',
      },
      {
        timestamp: '1:00',
        seconds: 60,
        text: 'Next segment',
      },
    ]);
  });

  it('handles timestamps with hours', () => {
    const raw = `0:00
Introduction
1:00:00
One hour in
1:30:45
Hour and a half`;

    const result = parseTranscript(raw);

    expect(result).toEqual([
      {
        timestamp: '0:00',
        seconds: 0,
        text: 'Introduction',
      },
      {
        timestamp: '1:00:00',
        seconds: 3600,
        text: 'One hour in',
      },
      {
        timestamp: '1:30:45',
        seconds: 5445,
        text: 'Hour and a half',
      },
    ]);
  });

  it('handles malformed input gracefully', () => {
    const raw = 'Just some random text without timestamps';

    const result = parseTranscript(raw);

    expect(result).toEqual([
      {
        timestamp: '0:00',
        seconds: 0,
        text: 'Just some random text without timestamps',
      },
    ]);
  });

  it('handles empty input', () => {
    const result = parseTranscript('');

    expect(result).toEqual([]);
  });

  it('handles input with only text (no timestamps)', () => {
    const raw = `Line one
Line two
Line three`;

    const result = parseTranscript(raw);

    expect(result).toEqual([
      {
        timestamp: '0:00',
        seconds: 0,
        text: 'Line one\nLine two\nLine three',
      },
    ]);
  });

  it('handles trailing whitespace and empty lines', () => {
    const raw = `0:00

Introduction

0:45
Content
`;

    const result = parseTranscript(raw);

    expect(result).toEqual([
      {
        timestamp: '0:00',
        seconds: 0,
        text: 'Introduction',
      },
      {
        timestamp: '0:45',
        seconds: 45,
        text: 'Content',
      },
    ]);
  });
});

describe('timestampToSeconds', () => {
  it('converts MM:SS format', () => {
    expect(timestampToSeconds('0:00')).toBe(0);
    expect(timestampToSeconds('1:30')).toBe(90);
    expect(timestampToSeconds('5:45')).toBe(345);
  });

  it('converts H:MM:SS format', () => {
    expect(timestampToSeconds('1:00:00')).toBe(3600);
    expect(timestampToSeconds('1:30:45')).toBe(5445);
    expect(timestampToSeconds('2:15:30')).toBe(8130);
  });

  it('handles single digit minutes', () => {
    expect(timestampToSeconds('0:05')).toBe(5);
    expect(timestampToSeconds('0:59')).toBe(59);
    expect(timestampToSeconds('9:00')).toBe(540);
  });

  it('handles double digit hours', () => {
    expect(timestampToSeconds('10:00:00')).toBe(36000);
    expect(timestampToSeconds('12:34:56')).toBe(45296);
  });
});

describe('secondsToTimestamp', () => {
  it('formats seconds to MM:SS', () => {
    expect(secondsToTimestamp(0)).toBe('0:00');
    expect(secondsToTimestamp(90)).toBe('1:30');
    expect(secondsToTimestamp(345)).toBe('5:45');
  });

  it('formats to H:MM:SS when >= 1 hour', () => {
    expect(secondsToTimestamp(3600)).toBe('1:00:00');
    expect(secondsToTimestamp(5445)).toBe('1:30:45');
    expect(secondsToTimestamp(36000)).toBe('10:00:00');
  });

  it('pads minutes and seconds', () => {
    expect(secondsToTimestamp(5)).toBe('0:05');
    expect(secondsToTimestamp(65)).toBe('1:05');
    expect(secondsToTimestamp(3605)).toBe('1:00:05');
  });

  it('handles edge cases', () => {
    expect(secondsToTimestamp(59)).toBe('0:59');
    expect(secondsToTimestamp(3599)).toBe('59:59');
    expect(secondsToTimestamp(3661)).toBe('1:01:01');
  });
});

describe('formatDuration', () => {
  it('formats short durations', () => {
    expect(formatDuration(185)).toBe('3:05');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(5)).toBe('0:05');
  });

  it('formats hour+ durations', () => {
    expect(formatDuration(3665)).toBe('1:01:05');
    expect(formatDuration(7384)).toBe('2:03:04');
    expect(formatDuration(36000)).toBe('10:00:00');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00');
  });
});
