"use strict";

/**
 * Oxford Popup — background script.
 *
 * Fetches the Oxford Learner's Dictionaries page for a word and hands the
 * raw HTML back to the content script (which parses it with DOMParser,
 * unavailable inside Chrome's MV3 service worker).
 *
 * Works as a service worker (Chrome) and as an event page (Firefox).
 */

const DEFINITION_URL = "https://www.oxfordlearnersdictionaries.com/definition/english/";
const FETCH_TIMEOUT_MS = 10000;
const CACHE_MAX = 128;

/** Simple in-memory cache; survives service-worker eviction is not required. */
const cache = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "oxford-lookup") return undefined;
  lookup(message.word).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function lookup(rawWord) {
  const word = String(rawWord || "").trim();
  if (!word) return { ok: false, error: false, url: "", word };

  // "cocoa butter" -> "cocoa-butter"
  const slug = word.toLowerCase().replace(/\s+/g, "-");
  const url = DEFINITION_URL + encodeURIComponent(slug) + "?q=" + encodeURIComponent(slug);

  if (cache.has(slug)) return cache.get(slug);

  const result = { ok: false, error: false, url, word };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "follow"
    });
    clearTimeout(timer);
    if (response.ok) {
      result.ok = true;
      result.html = await response.text();
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
