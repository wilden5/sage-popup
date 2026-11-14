/**
 * Basic text cleanup utilities.
 * Part of the normalization pipeline.
 */

/**
 * Strip punctuation from a string.
 * Removes common punctuation marks but preserves apostrophes within words.
 */
export function stripPunctuation(text: string): string {
  // Remove punctuation at start and end, and replace internal punctuation with spaces
  // But keep apostrophes in contractions (can't, won't, etc.)
  return text
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
    .replace(/[\p{P}\p{S}]/gu, (char) => char === '\'' ? char : ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Basic cleanup: trim, lowercase, strip punctuation.
 */
export function cleanup(text: string): string {
  if (!text) return text;
  return stripPunctuation(text.trim()).toLowerCase();
}
