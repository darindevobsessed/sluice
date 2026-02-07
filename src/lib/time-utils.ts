/**
 * Format a date as relative time (e.g., "2h ago", "3 days ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000))

  const MINUTE = 60
  const HOUR = MINUTE * 60
  const DAY = HOUR * 24
  const WEEK = DAY * 7
  const MONTH = DAY * 30
  const YEAR = DAY * 365

  if (diffSeconds < MINUTE) {
    return `${diffSeconds}s ago`
  } else if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE)
    return `${minutes}m ago`
  } else if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR)
    return `${hours}h ago`
  } else if (diffSeconds < WEEK) {
    const days = Math.floor(diffSeconds / DAY)
    return `${days}d ago`
  } else if (diffSeconds < MONTH) {
    const weeks = Math.floor(diffSeconds / WEEK)
    return `${weeks}w ago`
  } else if (diffSeconds < YEAR) {
    const months = Math.floor(diffSeconds / MONTH)
    return `${months}mo ago`
  } else {
    const years = Math.floor(diffSeconds / YEAR)
    return `${years}y ago`
  }
}
