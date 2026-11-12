/** Trim whitespace and surrounding punctuation from the selection. */
export function normalize(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’(\[{<»„.,;:!?…—–]+/, "")
    .replace(/[\s"'“”‘’)\]}>«“.,;:!?…—–]+$/, "")
    .trim();
}
