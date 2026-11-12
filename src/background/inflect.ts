/** Inflected forms Oxford has no entry for -> their base form. */
export const IRREGULAR: Record<string, string> = {
  children: "child",
  women: "woman",
  men: "man",
  hid: "hide"
};

/**
 * Ordered lookup candidates for a word or phrase: the original form first
 * (many inflections like "went" or "knives" have their own Oxford entries),
 * then likely base forms derived with simple English inflection rules.
 */
export function candidatesFor(word: string): string[] {
  const lower = word.toLowerCase();
  const parts = lower.split(" ");
  if (parts.length === 1) return inflectCandidates(lower);

  // Phrase: vary only the last word ("cocoa beans" -> "cocoa bean").
  const prefix = parts.slice(0, -1).join(" ") + " ";
  const last = parts[parts.length - 1] as string;
  const variants = inflectCandidates(last).slice(1);
  return [lower, ...variants.map((v) => prefix + v)];
}

export function inflectCandidates(word: string): string[] {
  const cands: string[] = [];
  const push = (w: string) => {
    if (w && w.length >= 2 && !cands.includes(w)) cands.push(w);
  };

  // Strip possessive 's / s'
  let w = word.replace(/[’']s$/, "").replace(/s[’']$/, "");
  push(w);

  if (IRREGULAR[w]) push(IRREGULAR[w] as string);

  // Plural -ies -> -y (cities -> city)
  if (/ies$/.test(w) && w.length >= 5) push(w.slice(0, -3) + "y");
  // Plural -ves -> -fe / -f (knives -> knife, wolves -> wolf)
  if (/ves$/.test(w) && w.length >= 5) {
    push(w.slice(0, -3) + "fe");
    push(w.slice(0, -3) + "f");
  }
  // -es after s/x/z/ch/sh/o (boxes -> box, watches -> watch, goes -> go)
  if (/(?:s|x|z|ch|sh|o)es$/.test(w)) push(w.slice(0, -2));
  // -ses -> -sis after a vowel or y (analyses -> analysis, crises -> crisis)
  if (/[aeiouy]ses$/.test(w)) push(w.slice(0, -3) + "sis");
  // Generic plural -s (seeds -> seed, houses -> house, genies -> genie)
  if (/s$/.test(w) && !/(?:ss|us|is)$/.test(w) && w.length >= 3) {
    push(w.slice(0, -1));
  }

  // Verb -ing (walking -> walk, running -> run, making -> make)
  if (/ing$/.test(w) && w.length >= 5) {
    const stem = w.slice(0, -3);
    push(stem);
    if (/(.)\1$/.test(stem) && stem.length >= 4) push(stem.slice(0, -1));
    push(stem + "e");
  }
  // Verb -ed (walked -> walk, stopped -> stop, loved -> love)
  if (/ed$/.test(w) && w.length >= 4) {
    const stem = w.slice(0, -2);
    if (stem.length >= 3) push(stem);
    if (/(.)\1$/.test(stem) && stem.length >= 4) push(stem.slice(0, -1));
    if (w.length - 1 >= 3) push(w.slice(0, -1));
  }

  return cands;
}
