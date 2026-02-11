export interface ParsedUrl {
  videoId: string;
  isValid: boolean;
}

export interface VideoMetadata {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

export interface VideoPageMetadata {
  publishedAt: string | null;
  description: string | null;
  duration: number | null; // duration in seconds
}
