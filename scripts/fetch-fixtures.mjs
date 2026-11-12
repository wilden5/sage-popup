/**
 * fetch-fixtures.mjs — refresh the committed Oxford parser fixtures.
 *
 * What it does: downloads the live Oxford Learner's Dictionaries definition
 * pages for "cocoa", "house" and "walk" (same request approach as
 * scripts/live-check.js: browser User-Agent, ?q=<word> query), strips
 * <script>...</script> blocks and <!-- comments -->, trims each page to the
 * first BALANCED <div ... class="entry"> subtree, and writes the three files
 * into tests/fixtures/.
 *
 * How to run (manually, by a human — never run by agents or CI):
 *   node scripts/fetch-fixtures.mjs        # requires Node.js >= 22 (native fetch)
 *
 * After a refresh, COMMIT the changed fixtures and make sure the parser
 * fixture tests stay green (npm test). Entry facts (headword, CEFR level,
 * exact definitions) may legitimately change when Oxford updates its pages —
 * update tests/parser.test.ts expectations to match the new fixtures then.
 *
 * Dependency-free: plain Node.js >= 22, global fetch only.
 */
"use strict";

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OXFORD_URL = "https://www.oxfordlearnersdictionaries.com/definition/english/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const WORDS = ["cocoa", "house", "walk"];

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "..", "tests", "fixtures");

/** Remove <script> blocks and HTML comments so they cannot confuse the div scan. */
function stripNoise(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

/** Return the first balanced <div ... class="entry"> ... </div> subtree, or null. */
function firstEntrySubtree(html) {
  const open = /<div\b[^>]*\bclass="entry"[^>]*>/i.exec(html);
  if (!open) return null;
  const start = open.index;
  const tokens = /<div\b[^>]*>|<\/div\s*>/gi;
  tokens.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tokens.exec(html)) !== null) {
    if (match[0].startsWith("</")) {
      depth--;
      if (depth === 0) return html.slice(start, tokens.lastIndex);
    } else {
      depth++;
    }
  }
  return null;
}

async function fetchFixture(word) {
  const response = await fetch(OXFORD_URL + word + "?q=" + word, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 200) {
    throw new Error(word + ": HTTP " + response.status + " (expected 200)");
  }
  const html = await response.text();
  const subtree = firstEntrySubtree(stripNoise(html));
  if (!subtree) {
    throw new Error(word + ": no <div class=\"entry\"> subtree found on the page");
  }
  return subtree.trim() + "\n";
}

async function main() {
  console.log("Fetching Oxford fixtures into tests/fixtures/ ...");
  for (const word of WORDS) {
    const content = await fetchFixture(word);
    const file = join(FIXTURES_DIR, word + ".html");
    await writeFile(file, content, "utf8");
    console.log("  wrote " + word + ".html (" + content.length + " bytes)");
  }
  console.log("DONE — commit the refreshed fixtures and keep npm test green.");
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
