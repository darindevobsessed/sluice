/**
 * Temporal metadata extraction from chunk content
 * Uses regex patterns to detect version numbers and release dates
 */

import type { TemporalExtraction } from './types'

/**
 * Version extraction patterns
 * Matches semantic versions, version keywords, and technology versions
 */
const VERSION_PATTERNS = [
  // Semantic versions: v2.0, 2.0.1, 3.2
  /v?(\d+\.\d+(?:\.\d+)?)/gi,
  // Version keywords: version 3.2, ver. 4.1
  /(?:version|ver\.?)\s+(\d+(?:\.\d+)*)/gi,
  // Technology versions: React 18, Node 20.5
  /\b(React|Node|Python|Java|Ruby|Go|Rust|TypeScript|JavaScript|PHP|Swift|Kotlin|Vue|Angular|Next|Express|Django|Rails|Spring|Laravel)\s+(\d+(?:\.\d+)*)/gi,
]

/**
 * Date extraction patterns
 * Matches release years and month+year combinations
 */
const DATE_PATTERNS = [
  // Release/update year: released in 2024, updated in 2025
  /(?:released?|updated?)\s+(?:in\s+)?(\d{4})/gi,
  // Month + year: January 2024, February 2025
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi,
  // Year prefix: 2024 release, 2025 update, 2023 version
  /(\d{4})\s+(?:release|update|version)/gi,
]

/**
 * Extract version numbers from content
 */
function extractVersions(content: string): string[] {
  const versions = new Set<string>()

  for (const pattern of VERSION_PATTERNS) {
    pattern.lastIndex = 0 // Reset regex state
    let match: RegExpExecArray | null

    while ((match = pattern.exec(content)) !== null) {
      // For technology patterns, combine tech name + version
      if (match[2]) {
        const techVersion = `${match[1]} ${match[2]}`
        versions.add(techVersion)
      } else if (match[1]) {
        // For semantic versions, extract just the version number
        const version = match[1]
        // Skip if it looks like a false positive (contains slash)
        if (!version.includes('/')) {
          versions.add(version)
        }
      }
    }
  }

  return Array.from(versions)
}

/**
 * Extract date mentions from content
 */
function extractDates(content: string): string[] {
  const dates = new Set<string>()

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0 // Reset regex state
    let match: RegExpExecArray | null

    while ((match = pattern.exec(content)) !== null) {
      // For month+year patterns, combine both parts
      if (match[2]) {
        const dateStr = `${match[1]} ${match[2]}`
        dates.add(dateStr)
      } else if (match[1]) {
        // For year-only patterns, extract just the year
        dates.add(match[1])
      }
    }
  }

  return Array.from(dates)
}

/**
 * Calculate confidence score based on extracted temporal signals
 *
 * Scoring:
 * - 1.0: Multiple versions + dates with context (strong temporal signal)
 * - 0.7: Single clear version mention
 * - 0.4: Ambiguous mentions (single digit version or year only)
 * - 0.0: No temporal signals
 */
function calculateConfidence(versions: string[], dates: string[]): number {
  const versionCount = versions.length
  const dateCount = dates.length

  // No temporal signals
  if (versionCount === 0 && dateCount === 0) {
    return 0.0
  }

  // Multiple versions AND dates = high confidence
  if (versionCount >= 2 && dateCount >= 1) {
    return 1.0
  }

  // Multiple of either type = high confidence
  if (versionCount >= 3 || dateCount >= 2) {
    return 1.0
  }

  // Multiple versions only = medium-high confidence
  if (versionCount >= 2) {
    return 0.7
  }

  // Single clear version (with minor/patch) = medium confidence
  if (versionCount === 1 && versions[0]?.includes('.')) {
    return 0.7
  }

  // Single version + date = medium-high confidence
  if (versionCount >= 1 && dateCount >= 1) {
    return 0.8
  }

  // Date only = medium confidence
  if (dateCount >= 1) {
    return 0.6
  }

  // Ambiguous single version (no dot, just major version)
  if (versionCount === 1 && !versions[0]?.includes('.')) {
    return 0.4
  }

  // Fallback for edge cases
  return 0.5
}

/**
 * Extract temporal metadata from chunk content
 *
 * Identifies version numbers and release dates using regex patterns.
 * Returns extracted versions, dates, and a confidence score.
 *
 * @param content - The text content to analyze
 * @returns TemporalExtraction with versions, dates, and confidence score
 *
 * @example
 * ```typescript
 * const result = extractTemporalMetadata('React 18 was released in 2022')
 * // { versions: ['React 18'], dates: ['2022'], confidence: 0.8 }
 * ```
 */
export function extractTemporalMetadata(content: string): TemporalExtraction {
  if (!content || content.trim().length === 0) {
    return {
      versions: [],
      dates: [],
      confidence: 0.0,
    }
  }

  const versions = extractVersions(content)
  const dates = extractDates(content)
  const confidence = calculateConfidence(versions, dates)

  return {
    versions,
    dates,
    confidence,
  }
}
