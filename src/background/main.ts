/**
 * Oxford Popup — background script (entry point).
 *
 * Two jobs:
 *  1. Fetches the Oxford Learner's Dictionaries page for a word (or its
 *     likely base form when the word itself is not in the dictionary) and
 *     hands the raw HTML back to the content script (which parses it with
 *     DOMParser, unavailable inside Chrome's MV3 service worker).
 *  2. Streams "explain this word/phrase" answers from the Mistral API
 *     (https://api.mistral.ai) over a runtime port, used for multi-word
 *     selections and for words Oxford does not know. The API key lives in
 *     chrome.storage.local (set from the options page) — never in code.
 *
 * Works as a service worker (Chrome) and as an event page (Firefox).
 *
 * Layout note: the pure, dependency-free logic lives in the sibling modules
 * (inflect, lookup, ai-prompt, stream-mistral) that the unit tests import
 * directly. All chrome.* usage lives in this file.
 */

import { lookup } from "./lookup";
import { buildAiPrompt } from "./ai-prompt";
import { MISTRAL_MODELS_URL, streamMistral } from "./stream-mistral";
import type {
  AiPortMessage,
  AiPortRequest,
  OxfordLookupRequest,
  OxfordTestKeyRequest,
  OxfordTestKeyResult
} from "../shared/types";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;
  if (message.type === "oxford-lookup") {
    lookup((message as OxfordLookupRequest).word).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  if (message.type === "oxford-open-options") {
    chrome.runtime.openOptionsPage();
    return false;
  }
  if (message.type === "oxford-test-key") {
    testMistralKey((message as OxfordTestKeyRequest).key).then(sendResponse);
    return true;
  }
  return undefined;
});

/** Streaming port for AI explanations (the popup listens on the other end). */
chrome.runtime.onConnect.addListener((port) => {
  if (!port || port.name !== "oxford-ai") return;
  port.onMessage.addListener(async (message) => {
    if (!message || !message.word) return;
    const request = message as AiPortRequest;
    const apiKey = await getMistralKey();
    if (!apiKey) {
      try {
        port.postMessage({ type: "no-key" } as AiPortMessage);
      } catch (err) {
        // popup already closed — nothing to do
      }
      return;
    }
    const prompt = buildAiPrompt(request.word, request.sentence, request.isPhrase);
    try {
      await streamMistral(apiKey, prompt, (text) => {
        try {
          port.postMessage({ type: "chunk", text } as AiPortMessage);
        } catch (err) {
          // popup already closed — stop caring about further chunks
          throw err;
        }
      });
      port.postMessage({ type: "done" } as AiPortMessage);
    } catch (err: any) {
      try {
        port.postMessage({
          type: "error",
          message: String(err && err.message ? err.message : err)
        } as AiPortMessage);
      } catch (err2) {
        // popup already closed
      }
    }
  });
});

async function getMistralKey(): Promise<string> {
  try {
    const data = await chrome.storage.local.get("mistralApiKey");
    return (data && data.mistralApiKey) || "";
  } catch (err) {
    return "";
  }
}

/** Cheap key check for the options page: GET /v1/models with the key. */
async function testMistralKey(key: string): Promise<OxfordTestKeyResult> {
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
      if (data && (data.message || data.detail)) detail = data.message || data.detail;
    } catch (err) {
      // keep the HTTP status
    }
    return { ok: false, message: detail };
  } catch (err: any) {
    const raw = String(err && err.message ? err.message : err);
    return {
      ok: false,
      message:
        "could not reach api.mistral.ai (" + raw + "). " +
        "If this is Firefox: about:addons → Oxford Popup → «Разрешения и данные» → enable api.mistral.ai."
    };
  }
}
