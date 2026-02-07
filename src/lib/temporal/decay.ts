/**
 * Calculates temporal decay factor for content based on its age.
 * Uses exponential decay: score * e^(-lambda * age_in_days)
 *
 * @param publishedAt - Publication date of the content (null/undefined = no decay)
 * @param halfLifeDays - Number of days for content to reach 50% relevance (default: 365)
 * @returns Decay multiplier between 0 and 1 (1 = no decay, <1 = decayed)
 */
export function calculateTemporalDecay(
  publishedAt: Date | null | undefined,
  halfLifeDays: number = 365
): number {
  // No decay if publication date is unknown
  if (!publishedAt) {
    return 1.0
  }

  // Calculate age in days
  const ageInDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)

  // Calculate lambda from half-life: lambda = ln(2) / half-life
  const lambda = Math.LN2 / halfLifeDays

  // Apply exponential decay: e^(-lambda * age)
  const decay = Math.exp(-lambda * ageInDays)

  return decay
}
