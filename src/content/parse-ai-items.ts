/** One parsed line of the streamed AI answer: a meaning plus an example. */
export interface ParsedAiItem {
  meaning: string;
  example: string;
}

/**
 * Parse the streamed AI answer into Oxford-like list items.
 * Expected format (see the prompt in the background script): one item per line,
 * "N. meaning — example". Tolerates missing numbers, stray preambles and
 * wrapped-in-quotes examples; caps the list at 4 items.
 */
export function parseAiItems(buffer: string): ParsedAiItem[] {
  const items: ParsedAiItem[] = [];
  const lines = String(buffer || "").replace(/\r/g, "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const numbered = line.match(/^\d+[.)]\s*(.+)$/);
    const body = numbered ? numbered[1]! : line;
    if (!numbered && !/[a-zA-Z]/.test(body)) continue;
    if (!numbered && /^(sure|here|certainly|of course|hope|note|glad)/i.test(body)) {
      continue; // stray preamble ("Sure! Here are...") or closing ("Hope this helps!")
    }
    const split = body.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    let meaning = split ? split[1]!.trim() : body.trim();
    let example = split ? split[2]!.trim().replace(/^["“']+|["”']+$/g, "") : "";
    if (meaning) {
      items.push({ meaning, example });
    }
  }
  return items.slice(0, 4);
}
