/**
 * Prompt for AI explanations. The answer is streamed and rendered as an
 * Oxford-like numbered list, so the format is strictly "N. meaning — example",
 * one item per line, no markdown.
 */
export function buildAiPrompt(word: string, sentence: string, isPhrase: boolean): string {
  const what = isPhrase ? "phrase" : "word";
  const lines = [
    "You are a dictionary for English learners. The user selected the " +
      what +
      ' "' +
      word +
      '" while reading an English page.'
  ];
  if (sentence) {
    lines.push('Context from the page: "' + sentence + '"');
  }
  lines.push(
    "Explain the " +
      what +
      " in simple English (CEFR A2-B2 level).",
    "Give 2 to 3 numbered items, one per line. Each item: one short meaning of the " +
      what +
      ", then a space, an em dash, a space, and one short example sentence that uses the " +
      what +
      ".",
    "Format every item exactly as: 1. meaning — example sentence",
    "No markdown, no bullet points, no headings, no text before or after the items."
  );
  return lines.join("\n");
}
