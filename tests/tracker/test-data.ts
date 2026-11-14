/**
 * Test data for normalization tests.
 * Curated list of ~100 words with their inflected forms and expected lemmas.
 */

/**
 * Curated list of normalization test cases.
 * Covers:
 * - Regular verbs with common suffixes
 * - Irregular verbs
 * - Regular nouns (plurals)
 * - Irregular nouns
 * - Adjectives and adverbs
 * - Multi-word phrases
 * - Edge cases (punctuation, case, etc.)
 */
export interface NormalizationTestCase {
  input: string;
  expectedLemma: string;
  description?: string;
}

export const NORMALIZATION_TEST_CASES: NormalizationTestCase[] = [
  // === Regular verbs with -s, -es, -ed, -ing ===
  { input: 'walk', expectedLemma: 'walk' },
  { input: 'walks', expectedLemma: 'walk' },
  { input: 'walked', expectedLemma: 'walk' },
  { input: 'walking', expectedLemma: 'walk' },
  { input: 'play', expectedLemma: 'play' },
  { input: 'plays', expectedLemma: 'play' },
  { input: 'played', expectedLemma: 'play' },
  { input: 'playing', expectedLemma: 'play' },
  
  // Doubling: stop -> stopped
  { input: 'stop', expectedLemma: 'stop' },
  { input: 'stops', expectedLemma: 'stop' },
  { input: 'stopped', expectedLemma: 'stop' },
  { input: 'stopping', expectedLemma: 'stop' },
  
  // E-drop: love -> loved
  { input: 'love', expectedLemma: 'love' },
  { input: 'loves', expectedLemma: 'love' },
  { input: 'loved', expectedLemma: 'love' },
  { input: 'loving', expectedLemma: 'love' },
  { input: 'hoping', expectedLemma: 'hope' },
  { input: 'hopping', expectedLemma: 'hop' },
  { input: 'dancing', expectedLemma: 'dance' },
  { input: 'writing', expectedLemma: 'write' },
  { input: 'using', expectedLemma: 'use' },
  
  // y -> ied: study -> studied
  { input: 'study', expectedLemma: 'study' },
  { input: 'studies', expectedLemma: 'study' },
  { input: 'studied', expectedLemma: 'study' },
  { input: 'studying', expectedLemma: 'study' },
  
  // y -> ies: city -> cities
  { input: 'city', expectedLemma: 'city' },
  { input: 'cities', expectedLemma: 'city' },
  { input: 'baby', expectedLemma: 'baby' },
  { input: 'babies', expectedLemma: 'baby' },
  
  // o -> oes: potato -> potatoes
  { input: 'potato', expectedLemma: 'potato' },
  { input: 'potatoes', expectedLemma: 'potato' },
  { input: 'tomato', expectedLemma: 'tomato' },
  { input: 'tomatoes', expectedLemma: 'tomato' },
  
  // === Irregular verbs ===
  { input: 'go', expectedLemma: 'go' },
  { input: 'goes', expectedLemma: 'go' },
  { input: 'went', expectedLemma: 'go' },
  { input: 'gone', expectedLemma: 'go' },
  { input: 'going', expectedLemma: 'go' },
  
  { input: 'take', expectedLemma: 'take' },
  { input: 'takes', expectedLemma: 'take' },
  { input: 'took', expectedLemma: 'take' },
  { input: 'taken', expectedLemma: 'take' },
  
  { input: 'see', expectedLemma: 'see' },
  { input: 'sees', expectedLemma: 'see' },
  { input: 'saw', expectedLemma: 'see' },
  { input: 'seen', expectedLemma: 'see' },
  
  { input: 'come', expectedLemma: 'come' },
  { input: 'comes', expectedLemma: 'come' },
  { input: 'came', expectedLemma: 'come' },
  
  { input: 'give', expectedLemma: 'give' },
  { input: 'gives', expectedLemma: 'give' },
  { input: 'gave', expectedLemma: 'give' },
  { input: 'given', expectedLemma: 'give' },
  
  { input: 'be', expectedLemma: 'be' },
  { input: 'is', expectedLemma: 'be' },
  { input: 'am', expectedLemma: 'be' },
  { input: 'are', expectedLemma: 'be' },
  { input: 'was', expectedLemma: 'be' },
  { input: 'were', expectedLemma: 'be' },
  { input: 'been', expectedLemma: 'be' },
  { input: 'being', expectedLemma: 'be' },
  
  { input: 'have', expectedLemma: 'have' },
  { input: 'has', expectedLemma: 'have' },
  { input: 'had', expectedLemma: 'have' },
  { input: 'having', expectedLemma: 'have' },
  
  { input: 'do', expectedLemma: 'do' },
  { input: 'does', expectedLemma: 'do' },
  { input: 'did', expectedLemma: 'do' },
  { input: 'done', expectedLemma: 'do' },
  { input: 'doing', expectedLemma: 'do' },
  
  { input: 'say', expectedLemma: 'say' },
  { input: 'says', expectedLemma: 'say' },
  { input: 'said', expectedLemma: 'say' },
  
  { input: 'get', expectedLemma: 'get' },
  { input: 'gets', expectedLemma: 'get' },
  { input: 'got', expectedLemma: 'get' },
  { input: 'gotten', expectedLemma: 'get' },
  
  { input: 'make', expectedLemma: 'make' },
  { input: 'makes', expectedLemma: 'make' },
  { input: 'made', expectedLemma: 'make' },
  
  { input: 'know', expectedLemma: 'know' },
  { input: 'knows', expectedLemma: 'know' },
  { input: 'knew', expectedLemma: 'know' },
  { input: 'known', expectedLemma: 'know' },
  
  { input: 'think', expectedLemma: 'think' },
  { input: 'thinks', expectedLemma: 'think' },
  { input: 'thought', expectedLemma: 'think' },
  
  { input: 'see', expectedLemma: 'see' },
  { input: 'sees', expectedLemma: 'see' },
  { input: 'saw', expectedLemma: 'see' },
  { input: 'seen', expectedLemma: 'see' },
  
  // === Irregular nouns ===
  { input: 'child', expectedLemma: 'child' },
  { input: 'children', expectedLemma: 'child' },
  
  { input: 'man', expectedLemma: 'man' },
  { input: 'men', expectedLemma: 'man' },
  
  { input: 'woman', expectedLemma: 'woman' },
  { input: 'women', expectedLemma: 'woman' },
  
  { input: 'person', expectedLemma: 'person' },
  { input: 'people', expectedLemma: 'person' },
  
  { input: 'tooth', expectedLemma: 'tooth' },
  { input: 'teeth', expectedLemma: 'tooth' },
  
  { input: 'foot', expectedLemma: 'foot' },
  { input: 'feet', expectedLemma: 'foot' },
  
  { input: 'goose', expectedLemma: 'goose' },
  { input: 'geese', expectedLemma: 'goose' },
  
  { input: 'mouse', expectedLemma: 'mouse' },
  { input: 'mice', expectedLemma: 'mouse' },
  
  { input: 'ox', expectedLemma: 'ox' },
  { input: 'oxen', expectedLemma: 'ox' },
  
  // Regular plurals
  { input: 'cat', expectedLemma: 'cat' },
  { input: 'cats', expectedLemma: 'cat' },
  { input: 'dog', expectedLemma: 'dog' },
  { input: 'dogs', expectedLemma: 'dog' },
  
  // Plurals with -es
  { input: 'bus', expectedLemma: 'bus' },
  { input: 'buses', expectedLemma: 'bus' },
  { input: 'box', expectedLemma: 'box' },
  { input: 'boxes', expectedLemma: 'box' },
  { input: 'church', expectedLemma: 'church' },
  { input: 'churches', expectedLemma: 'church' },
  
  // Adjectives and adverbs
  { input: 'quick', expectedLemma: 'quick' },
  { input: 'quickly', expectedLemma: 'quick' },
  { input: 'happy', expectedLemma: 'happy' },
  { input: 'happily', expectedLemma: 'happy' },
  
  // Multi-word phrases (should pass through)
  { input: 'give up', expectedLemma: 'give up' },
  { input: 'Give Up', expectedLemma: 'give up' },
  { input: 'GIVE UP', expectedLemma: 'give up' },
  { input: 'take off', expectedLemma: 'take off' },
  { input: 'turn on', expectedLemma: 'turn on' },
  
  // Punctuation handling
  { input: 'hello!', expectedLemma: 'hello' },
  { input: 'hello.', expectedLemma: 'hello' },
  { input: 'hello,', expectedLemma: 'hello' },
  { input: 'hello?', expectedLemma: 'hello' },
  { input: '"hello"', expectedLemma: 'hello' },
  { input: "'hello'", expectedLemma: 'hello' },
  
  // Case handling
  { input: 'Hello', expectedLemma: 'hello' },
  { input: 'HELLO', expectedLemma: 'hello' },
  { input: 'HeLLo', expectedLemma: 'hello' },
  
  // Edge cases
  { input: '', expectedLemma: '' },
  { input: '   ', expectedLemma: '' },
  { input: 'a', expectedLemma: 'a' },
  { input: 'I', expectedLemma: 'i' },
];
