"use strict";

/**
 * Oxford Popup — background script.
 *
 * Fetches the Oxford Learner's Dictionaries page for a word (or its likely
 * base form when the word itself is not in the dictionary) and hands the
 * raw HTML back to the content script (which parses it with DOMParser,
 * unavailable inside Chrome's MV3 service worker).
 *
 * Works as a service worker (Chrome) and as an event page (Firefox).
 */

const DEFINITION_URL = "https://www.oxfordlearnersdictionaries.com/definition/english/";
const FETCH_TIMEOUT_MS = 10000;
const CACHE_MAX = 128;
const MAX_CANDIDATES = 8;

/** Inflected forms Oxford has no entry for -> their base form. */
const IRREGULAR = {
  children: "child",
  women: "woman",
  men: "man",
  hid: "hide"
};

const cache = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "oxford-lookup") return undefined;
  lookup(message.word).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function lookup(rawWord) {
  const word = String(rawWord || "").trim();
  if (!word) return { ok: false, error: false, url: "", word };

  const slug = word.toLowerCase().replace(/\s+/g, "-");
  if (cache.has(slug)) return cache.get(slug);

  const result = { ok: false, error: false, url: definitionUrl(slug), word };
  try {
    for (const candidate of candidatesFor(word).slice(0, MAX_CANDIDATES)) {
      const candSlug = candidate.toLowerCase().replace(/\s+/g, "-");
      const url = definitionUrl(candSlug);
      const response = await fetchWithTimeout(url);
      if (response && response.ok) {
        result.ok = true;
        result.html = await response.text();
        result.url = url;
        break;
      }
    }
  } catch (err) {
    result.error = true; // network failure / timeout
  }

  cache.set(slug, result);
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  return result;
}

function definitionUrl(slug) {
  return DEFINITION_URL + encodeURIComponent(slug) + "?q=" + encodeURIComponent(slug);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "follow"
    });
  } catch (err) {
    return null; // counted as a failed candidate, not a global error
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ordered lookup candidates for a word or phrase: the original form first
 * (many inflections like "went" or "knives" have their own Oxford entries),
 * then likely base forms derived with simple English inflection rules.
 */
function candidatesFor(word) {
  const lower = word.toLowerCase();
  const parts = lower.split(" ");
  if (parts.length === 1) return inflectCandidates(lower);

  // Phrase: vary only the last word ("cocoa beans" -> "cocoa bean").
  const prefix = parts.slice(0, -1).join(" ") + " ";
  const last = parts[parts.length - 1];
  const variants = inflectCandidates(last).slice(1);
  return [lower, ...variants.map((v) => prefix + v)];
}

function inflectCandidates(word) {
  const cands = [];
  const push = (w) => {
    if (w && w.length >= 2 && !cands.includes(w)) cands.push(w);
  };

  // Strip possessive 's / s'
  let w = word.replace(/[’']s$/, "").replace(/s[’']$/, "");
  push(w);

  if (IRREGULAR[w]) push(IRREGULAR[w]);

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
