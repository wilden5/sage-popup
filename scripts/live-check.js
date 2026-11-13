/**
 * Live integration checks for Oxford Popup (run by GitHub Actions daily
 * and on every push to main; can also be run locally: node scripts/live-check.js).
 *
 * Purpose: catch external breakage early —
 *  1. Oxford Learner's Dictionaries markup changes (the extension's parser
 *     depends on specific classes: headword, def, phons_br, pron-uk,
 *     data-src-mp3, senses lists, CEFR symbols).
 *  2. reachability of all 8 AI provider endpoints (any HTTP answer proves
 *     DNS + reachability; in 2026 Mistral silently killed api.mistral.com
 *     in DNS — this check exists so that a repeat costs us an email,
 *     not a bug report).
 *
 * Dependency-free: plain Node.js >= 18 (global fetch). Exit 1 on any failure.
 */
"use strict";

const OXFORD_URL = "https://www.oxfordlearnersdictionaries.com/definition/english/";
// Keep in sync with src/shared/providers.ts (testKeyEndpoint).
const PROVIDER_ENDPOINTS = [
  { id: "mistral", url: "https://api.mistral.ai/v1/models" },
  { id: "openai", url: "https://api.openai.com/v1/models" },
  { id: "groq", url: "https://api.groq.com/openai/v1/models" },
  { id: "openrouter", url: "https://openrouter.ai/api/v1/models" },
  { id: "deepseek", url: "https://api.deepseek.com/models" },
  { id: "xai", url: "https://api.x.ai/v1/models" },
  { id: "anthropic", url: "https://api.anthropic.com/v1/models" },
  { id: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/models" },
];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Every entry checks the classes parseEntry() relies on. "cefr: true" also
// requires an Oxford 3000/5000 badge (only words from those lists have one).
const WORDS = [
  { word: "cocoa", cefr: false },
  { word: "house", cefr: true },
  { word: "walk", cefr: true },
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log("  FAIL: " + msg);
};
const pass = (msg) => console.log("  ok: " + msg);

async function fetchPage(url, headers) {
  const response = await fetch(url, {
    headers: Object.assign({ "User-Agent": UA }, headers || {}),
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  return response;
}

async function checkOxford(entry) {
  console.log("Oxford: " + entry.word);
  let html = "";
  try {
    const response = await fetchPage(OXFORD_URL + entry.word + "?q=" + entry.word);
    if (response.status !== 200) {
      fail("HTTP " + response.status + " (expected 200)");
      return;
    }
    html = await response.text();
    pass("HTTP 200, " + html.length + " bytes");
  } catch (err) {
    fail("request failed: " + String(err && err.message ? err.message : err));
    return;
  }

  const required = [
    '<h1 class="headword"', // headword
    'class="def"', // definition blocks
    "phons_br", // British transcription
    "pron-uk", // UK audio button
    "data-src-mp3", // audio source
  ];
  for (const needle of required) {
    if (html.includes(needle)) pass(needle);
    else fail("missing marker: " + needle);
  }

  if (html.includes("senses_multiple") || html.includes("sense_single")) {
    pass("senses list (senses_multiple|sense_single)");
  } else {
    fail("missing senses list (senses_multiple|sense_single)");
  }

  if (entry.cefr) {
    if (html.includes("ox3ksym_") || html.includes("ox5ksym_")) {
      pass("CEFR badge (ox3ksym_|ox5ksym_)");
    } else {
      fail("missing CEFR badge — expected for an Oxford 3000/5000 word");
    }
  }
}

async function checkProviders() {
  for (const provider of PROVIDER_ENDPOINTS) {
    console.log("Provider: " + provider.id + " " + provider.url);
    try {
      const response = await fetchPage(provider.url);
      // Any HTTP status (200/401/403/404) proves DNS + reachability.
      pass("endpoint alive (HTTP " + response.status + ")");
    } catch (err) {
      fail(
        provider.id + " endpoint unreachable: " +
          String(err && err.message ? err.message : err)
      );
    }
  }
}

async function main() {
  console.log("Live checks for Oxford Popup");
  for (const entry of WORDS) await checkOxford(entry);
  await checkProviders();
  if (failures) {
    console.log(failures + " CHECK(S) FAILED");
    process.exit(1);
  }
  console.log("ALL LIVE CHECKS PASSED");
}

main();
