/**
 * Suffix rules for lemmatization.
 * Handles common English inflectional suffixes.
 * 
 * Rules applied in order of specificity (most specific first).
 */

import { cleanup } from './cleanup';

// Static list of common e-final verbs for e-restoration
// Used when suffix stripping removes the final 'e' (e-drop verbs)
const E_RESTORE_BASES: ReadonlySet<string> = new Set([
  'love', 'live', 'hope', 'move', 'like', 'make', 'take', 'give', 'write',
  'drive', 'dance', 'smile', 'save', 'serve', 'close', 'use', 'come',
  'decide', 'believe', 'change', 'arrive', 'breathe', 'describe', 'prepare',
  'share', 'care', 'face', 'notice', 'practice', 'manage', 'imagine', 'create',
  'taste', 'raise', 'choose', 'lose', 'compare', 'continue', 'surprise', 'wave',
  'bake', 'blame', 'cause', 'celebrate', 'complete', 'divide', 'escape',
  'examine', 'explore', 'gaze', 'quote', 'type',
]);

// Static list of real English words ending in a single 's'.
// The -s rule must never strip their final letter (bus -> bu would be wrong).
const S_FINAL_BASES: ReadonlySet<string> = new Set([
  'bus', 'gas', 'yes', 'us', 'his', 'its', 'this', 'virus', 'focus', 'bonus',
  'status', 'tennis', 'canvas', 'chaos', 'alias', 'atlas', 'bias', 'lens',
]);

// Helper to check if a word ends with a suffix (case-insensitive after cleanup)
function endsWithSuffix(word: string, suffix: string): boolean {
  return word.length > suffix.length && 
    word.slice(-suffix.length).toLowerCase() === suffix.toLowerCase();
}

// Suffix removal rules with precedence (most specific, longest suffixes first)
const suffixRules: Array<{ suffix: string; replacement: string; minLength?: number }> = [
  // Superlatives and comparatives (most specific, longest suffixes first)
  { suffix: 'iest', replacement: '' },  // happiest -> happy (handled specially)
  { suffix: 'est', replacement: '', minLength: 3 },     // fastest -> fast, tallest -> tall
  
  // Past participle / past tense
  { suffix: 'ied', replacement: 'y' },     // studied -> study, carried -> carry
  { suffix: 'ed', replacement: '' },      // walked -> walk, played -> play
  
  // Present participle / gerund
  { suffix: 'ing', replacement: '' },     // running -> run, playing -> play
  
  // Plurals (handle -es before -s)
  { suffix: 'xes', replacement: 'x' },    // boxes -> box
  { suffix: 'zes', replacement: 'z' },    // buzzes -> buzz
  { suffix: 'ches', replacement: 'ch' },  // watches -> watch
  { suffix: 'shes', replacement: 'sh' },  // dishes -> dish
  { suffix: 'ses', replacement: 's' },   // buses -> bus (special case, removes 'es' not just 's')
  { suffix: 'es', replacement: '' },      // goes -> go, watches -> watch
  { suffix: 's', replacement: '' },       // cats -> cat, dogs -> dog
  
  // Adverbs
  { suffix: 'ly', replacement: '' },      // quickly -> quick, happily -> happy
  
  // Other derivational suffixes
  { suffix: 'er', replacement: '', minLength: 3 },      // faster -> fast, taller -> tall
];

/**
 * Apply suffix rules to reduce a word to its lemma.
 * Rules are applied in order.
 */
export function applySuffixRules(word: string): string {
  if (!word) return word;
  
  let result = word;
  
  // Special case: 'ies' -> 'y' (cities -> city, babies -> baby)
  if (result.endsWith('ies')) {
    return result.slice(0, -3) + 'y';
  }
  
  // Special case: 'iest' -> 'y' (happiest -> happy)
  if (result.endsWith('iest')) {
    return result.slice(0, -4) + 'y';
  }
  
  // Special case: y -> ied (study -> studied)
  if (result.endsWith('ied') && result.length > 3) {
    const before = result.slice(0, -3);
    // Check if adding 'y' makes sense (not all words ending in ied become y)
    if (before.endsWith('studi') || before.endsWith('carri') || before.endsWith('worri')) {
      return before.slice(0, -1) + 'y';
    }
  }
  
  // Apply rules in order
  for (const rule of suffixRules) {
    if (endsWithSuffix(result, rule.suffix)) {
      const stem = result.slice(0, -rule.suffix.length);
      
      // For 'ed', 'ing', 'est', and 'er' suffixes, check for doubled consonant and undo doubling
      const isDoubledConsonant = (rule.suffix === 'ed' || rule.suffix === 'ing' || rule.suffix === 'est' || rule.suffix === 'er') &&
          stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2];
      
      if (isDoubledConsonant) {
        return stem.slice(0, -1) + rule.replacement;
      }
      
      // For 'ed', 'ing', 'est', and 'er' suffixes, check for e-restoration
      // Only when no doubling was found
      const isERestorationCandidate = (rule.suffix === 'ed' || rule.suffix === 'ing' || rule.suffix === 'est' || rule.suffix === 'er') &&
          !isDoubledConsonant &&
          stem.length >= 1;
      
      if (isERestorationCandidate && E_RESTORE_BASES.has(stem + 'e')) {
        return stem + 'e';
      }
      
      // Check minimum stem length if specified
      if (rule.minLength && stem.length < rule.minLength) {
        continue;
      }
      
      // For 'es' suffix: only strip if stem ends with s, x, z, ch, sh, or o
      // Otherwise, continue to next rule (will hit 's' rule)
      if (rule.suffix === 'es') {
        if (stem.endsWith('ch') || stem.endsWith('sh') || stem.endsWith('x') || 
            stem.endsWith('s') || stem.endsWith('z') || stem.endsWith('o')) {
          return stem + rule.replacement;
        }
        // Not a special case, fall through to 's' rule
        continue;
      }
      
      // For 'ly' suffix: if stem ends with 'i', restore to 'y' (happily -> happy)
      if (rule.suffix === 'ly') {
        if (stem.endsWith('i')) {
          return stem.slice(0, -1) + 'y';
        }
      }
      
      // For 's' suffix, check for y -> ies pattern
      if (rule.suffix === 's') {
        if (stem.endsWith('ie')) {
          return stem.slice(0, -2) + 'y';
        }
        // Guard: never strip final 's' from words ending in 'ss'
        if (result.endsWith('ss')) {
          continue;
        }
        // Guard: never strip final 's' from real words ending in a single 's'
        if (S_FINAL_BASES.has(result)) {
          continue;
        }
      }
      
      // Default: just remove the suffix
      return stem + rule.replacement;
    }
  }
  
  return result;
}

/**
 * Normalize a single word using suffix rules.
 * Returns the lemma (base form).
 */
export function normalizeWord(word: string): string {
  const cleaned = cleanup(word);
  
  // Multi-word phrases: return as-is (they will be handled at a higher level)
  if (cleaned.includes(' ')) {
    return cleaned;
  }
  
  if (!cleaned) return cleaned;
  
  // Apply suffix rules
  const normalized = applySuffixRules(cleaned);
  
  return normalized;
}
