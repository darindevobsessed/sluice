import type { VideoMetadata } from './types';

/**
 * Fetches video metadata from YouTube using the oEmbed API
 *
 * @param videoId - The YouTube video ID
 * @returns VideoMetadata object with title, author, and thumbnail, or null on failure
 */
export async function fetchVideoMetadata(
  videoId: string
): Promise<VideoMetadata | null> {
  if (!videoId || typeof videoId !== 'string') {
    return null;
  }

  try {
    const url = `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      // Video not found, private, or API error
      return null;
    }

    const data = await response.json();

    // Validate that we got the expected fields
    if (!data.title || !data.author_name || !data.thumbnail_url) {
      return null;
    }

    return {
      title: data.title,
      author_name: data.author_name,
      thumbnail_url: data.thumbnail_url,
    };
  } catch {
    // Network error, JSON parse error, or other failure
    return null;
  }
}
