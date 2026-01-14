/**
 * Format a date for display in blog posts
 *
 * Options to consider customizing:
 * - Locale: 'en-US' vs 'de-DE' for German formatting
 * - Style: 'long' ("January") vs 'short' ("Jan") for month
 * - Include time? Currently date-only
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
