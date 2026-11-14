/**
 * Normalization module for the Sage Pop-Up tracker.
 * 
 * Two-step process:
 * 1. Suffix rules: map common inflection suffixes to base form
 * 2. Static irregular forms list: lookup irregular verbs and nouns
 * 
 * Multi-word phrases pass through untouched.
 * Basic cleanup: trim, lowercase, strip punctuation.
 */

import { cleanup } from './cleanup';
import { normalizeWord } from './suffix-rules';
import { getIrregularLemma } from './irregular-forms';

export { cleanup, stripPunctuation } from './cleanup';
export { applySuffixRules, normalizeWord } from './suffix-rules';
export {
  IRREGULAR_VERB_MAP,
  IRREGULAR_PLURAL_MAP,
  IRREGULAR_FORMS_MAP,
  BE_CONJUGATION,
  DO_CONJUGATION,
  HAVE_CONJUGATION,
  getIrregularLemma,
} from './irregular-forms';

/**
 * Normalize a word or phrase to its lemma (canonical form).
 * 
 * @param input - The word or phrase to normalize
 * @returns The normalized lemma (lowercase, cleaned)
 * 
 * Process:
 * 1. Basic cleanup
 * 2. If multi-word phrase: return cleaned version
 * 3. Check irregular forms map
 * 4. Apply suffix rules
 * 5. Final cleanup
 */
export function normalize(input: string): string {
  if (!input) return input;
  
  // Step 1: Basic cleanup
  let result = cleanup(input);
  
  if (!result) return result;
  
  // Step 2: Multi-word phrases pass through untouched
  if (result.includes(' ')) {
    return result;
  }
  
  // Step 3: Check irregular forms map
  const irregularLemma = getIrregularLemma(result);
  if (irregularLemma) {
    return irregularLemma;
  }
  
  // Step 4: Apply suffix rules
  result = normalizeWord(result);
  
  // Step 5: Final cleanup (in case suffix rules introduced issues)
  result = cleanup(result);
  
  return result;
}

/**
 * Batch normalize an array of words.
 */
export function normalizeBatch(words: string[]): string[] {
  return words.map(normalize);
}
