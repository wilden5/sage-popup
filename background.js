"use strict";

/**
 * Oxford Popup — background script.
 *
 * Two jobs:
 *  1. Fetches the Oxford Learner's Dictionaries page for a word (or its
 *     likely base form when the word itself is not in the dictionary) and
 *     hands the raw HTML back to the content script (which parses it with
 *     DOMParser, unavailable inside Chrome's MV3 service worker).
 *  2. Streams "explain this word/phrase" answers from the Mistral API
 *     (https://api.mistral.com) over a runtime port, used for multi-word
 *     selections and for words Oxford does not know. The API key lives in
 *     chrome.storage.local (set from the options page) — never in code.
 *
 * Works as a service worker (Chrome) and as an event page (Firefox).
 *
 * Layout note: everything above the "extension wiring" marker is pure,
 * dependency-free logic that the unit tests eval directly (node, no browser
 * APIs). All chrome.* usage lives below the marker.
 */

const DEFINITION_URL = "https://www.oxfordlearnersdictionaries.com/definition/english/";
const FETCH_TIMEOUT_MS = 10000;
const CACHE_MAX = 128;
const MAX_CANDIDATES = 8;

const MISTRAL_CHAT_URL = "https://api.mistral.com/v1/chat/completions";
const MISTRAL_MODELS_URL = "https://api.mistral.com/v1/models";
const AI_MODEL = "mistral-small-latest";

/** Inflected forms Oxford has no entry for -> their base form. */
const IRREGULAR = {
  children: "child",
  women: "woman",
  men: "man",
  hid: "hide"
};

const cache = new Map();

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

// ---------------------------------------------------------------- Mistral AI

/**
 * Prompt for AI explanations. The answer is streamed and rendered as an
 * Oxford-like numbered list, so the format is strictly "N. meaning — example",
 * one item per line, no markdown.
 */
function buildAiPrompt(word, sentence, isPhrase) {
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

/**
 * POST /v1/chat/completions with stream:true and feed content deltas to
 * onChunk(text). Resolves when the stream ends with data: [DONE].
 * Throws Error with a readable message on HTTP/API/stream failures.
 */
async function streamMistral(apiKey, prompt, onChunk) {
  let response;
  try {
    response = await fetch(MISTRAL_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: AI_MODEL,
        stream: true,
        temperature: 0.2,
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      })
    });
  } catch (err) {
    throw new Error("could not reach api.mistral.com");
  }

  if (!response.ok) {
    let detail = "HTTP " + response.status;
    try {
      const data = await response.json();
      if (data && data.message) detail = data.message;
    } catch (err) {
      // keep the HTTP status as the detail
    }
    throw new Error(detail);
  }
  if (!response.body) {
    throw new Error("empty response stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    buffer += decoder.decode(step.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep the incomplete tail for the next chunk
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      let json = null;
      try {
        json = JSON.parse(payload);
      } catch (err) {
        continue; // partial JSON split across network chunks — skip
      }
      const delta = json.choices && json.choices[0] && json.choices[0].delta;
      if (delta && delta.content) onChunk(delta.content);
    }
  }
}

// ---- extension wiring (not unit-tested: everything below uses chrome.*) ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;
  if (message.type === "oxford-lookup") {
    lookup(message.word).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  if (message.type === "oxford-open-options") {
    chrome.runtime.openOptionsPage();
    return false;
  }
  if (message.type === "oxford-test-key") {
    testMistralKey(message.key).then(sendResponse);
    return true;
  }
  return undefined;
});

/** Streaming port for AI explanations (the popup listens on the other end). */
chrome.runtime.onConnect.addListener((port) => {
  if (!port || port.name !== "oxford-ai") return;
  port.onMessage.addListener(async (message) => {
    if (!message || !message.word) return;
    const apiKey = await getMistralKey();
    if (!apiKey) {
      try {
        port.postMessage({ type: "no-key" });
      } catch (err) {
        // popup already closed — nothing to do
      }
      return;
    }
    const prompt = buildAiPrompt(message.word, message.sentence, message.isPhrase);
    try {
      await streamMistral(apiKey, prompt, (text) => {
        try {
          port.postMessage({ type: "chunk", text });
        } catch (err) {
          // popup already closed — stop caring about further chunks
          throw err;
        }
      });
      port.postMessage({ type: "done" });
    } catch (err) {
      try {
        port.postMessage({
          type: "error",
          message: String(err && err.message ? err.message : err)
        });
      } catch (err2) {
        // popup already closed
      }
    }
  });
});

async function getMistralKey() {
  try {
    const data = await chrome.storage.local.get("mistralApiKey");
    return (data && data.mistralApiKey) || "";
  } catch (err) {
    return "";
  }
}

/** Cheap key check for the options page: GET /v1/models with the key. */
async function testMistralKey(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) return { ok: false, message: "empty key" };
  try {
    const response = await fetch(MISTRAL_MODELS_URL, {
      headers: { Authorization: "Bearer " + trimmed }
    });
    if (response.ok) return { ok: true, message: "" };
    let detail = "HTTP " + response.status;
    try {
      const data = await response.json();
      if (data && data.message) detail = data.message;
    } catch (err) {
      // keep the HTTP status
    }
    return { ok: false, message: detail };
  } catch (err) {
    return { ok: false, message: "could not reach api.mistral.com" };
  }
}
