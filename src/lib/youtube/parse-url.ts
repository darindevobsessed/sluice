import type { ParsedUrl } from './types';

/**
 * Parses a YouTube URL and extracts the video ID
 * Supports multiple YouTube URL formats:
 * - youtube.com/watch?v=VIDEO_ID
 * - youtu.be/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 * - youtube.com/v/VIDEO_ID
 * - With timestamps, playlists, etc. (extracts just video ID)
 *
 * @param url - The YouTube URL to parse
 * @returns ParsedUrl object with videoId and isValid flag, or null if invalid
 */
export function parseYouTubeUrl(url: string): ParsedUrl | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Normalize the URL to ensure it has a protocol
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();

    // Validate that this is a YouTube domain
    const validHostnames = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
    ];

    if (!validHostnames.some(h => hostname === h)) {
      return null;
    }

    let videoId: string | null = null;

    // Handle youtu.be format
    if (hostname === 'youtu.be') {
      // Video ID is in the pathname (e.g., /VIDEO_ID)
      const pathParts = urlObj.pathname.slice(1).split('/');
      const queryParts = pathParts[0]?.split('?') ?? [];
      videoId = queryParts[0] ?? null;
    }
    // Handle youtube.com/watch format
    else if (urlObj.pathname.includes('/watch')) {
      videoId = urlObj.searchParams.get('v');
    }
    // Handle youtube.com/embed/VIDEO_ID format
    else if (urlObj.pathname.includes('/embed/')) {
      const embedParts = urlObj.pathname.split('/embed/');
      const pathParts = embedParts[1]?.split('/') ?? [];
      const queryParts = pathParts[0]?.split('?') ?? [];
      videoId = queryParts[0] ?? null;
    }
    // Handle youtube.com/v/VIDEO_ID format
    else if (urlObj.pathname.includes('/v/')) {
      const vParts = urlObj.pathname.split('/v/');
      const pathParts = vParts[1]?.split('/') ?? [];
      const queryParts = pathParts[0]?.split('?') ?? [];
      videoId = queryParts[0] ?? null;
    }

    // Validate video ID format (YouTube IDs are 11 characters, alphanumeric plus - and _)
    if (!videoId || !isValidVideoId(videoId)) {
      return null;
    }

    return {
      videoId,
      isValid: true,
    };
  } catch {
    // Invalid URL format
    return null;
  }
}

/**
 * Validates that a video ID matches YouTube's format
 * YouTube video IDs are 11 characters long and contain alphanumeric characters, hyphens, and underscores
 */
function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}
