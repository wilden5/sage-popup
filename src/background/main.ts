/**
 * Oxford Popup — background script (entry point).
 *
 * Two jobs:
 *  1. Fetches the Oxford Learner's Dictionaries page for a word (or its
 *     likely base form when the word itself is not in the dictionary) and
 *     hands the raw HTML back to the content script (which parses it with
 *     DOMParser, unavailable inside Chrome's MV3 service worker).
 *  2. Streams "explain this word/phrase" answers from the user's selected
 *     BYOK provider (registry in src/shared/providers.ts, MULTI_PROVIDER.md
 *     §2/§4) over a runtime port, used for multi-word selections and for
 *     words Oxford does not know. API keys live in chrome.storage.local
 *     (set from the options page) — never in code. The default provider is
 *     Mistral, so existing users see zero behavior change.
 *
 * Works as a service worker (Chrome) and as an event page (Firefox).
 *
 * Layout note: the pure, dependency-free logic lives in the sibling modules
 * (inflect, lookup, ai-prompt, stream-openai, stream-anthropic,
 * stream-gemini) that the unit tests import
 * directly. All chrome.* usage lives in this file.
 */

import { lookup } from "./lookup";
import { buildAiPrompt } from "./ai-prompt";
import { streamOpenAi } from "./stream-openai";
import { streamAnthropic } from "./stream-anthropic";
import { streamGemini } from "./stream-gemini";
import {
  DEFAULT_PROVIDER_ID,
  apiKeyFor,
  modelFor,
  providerById,
  selectedProvider
} from "../shared/providers";
import type {
  AiPortMessage,
  AiPortRequest,
  OxfordLookupRequest,
  OxfordTestKeyRequest,
  OxfordTestKeyResult,
  StorageSnapshot
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
    const req = message as OxfordTestKeyRequest;
    testProviderKey(req.provider, req.key).then(sendResponse);
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
    const snapshot = await getStorageSnapshot();
    const id = selectedProvider(snapshot);
    const provider = providerById(id) ?? providerById(DEFAULT_PROVIDER_ID)!;
    const apiKey = apiKeyFor(snapshot, id);
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
      const onChunk = (text: string) => {
        try {
          port.postMessage({ type: "chunk", text } as AiPortMessage);
        } catch (err) {
          // popup already closed — stop caring about further chunks
          throw err;
        }
      };
      if (provider.adapterKind === "openai") {
        await streamOpenAi(provider.chatEndpoint, apiKey, modelFor(snapshot, id), prompt, onChunk);
      } else if (provider.adapterKind === "anthropic") {
        await streamAnthropic(provider.chatEndpoint, apiKey, modelFor(snapshot, id), prompt, onChunk);
      } else {
        await streamGemini(provider.chatEndpoint, apiKey, modelFor(snapshot, id), prompt, onChunk);
      }
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

/** The whole of chrome.storage.local as a plain snapshot for the shared helpers. */
async function getStorageSnapshot(): Promise<StorageSnapshot> {
  try {
    return (await chrome.storage.local.get(null)) as StorageSnapshot;
  } catch (err) {
    return {};
  }
}

/** Cheap key check for the options page: GET the registry's test-key endpoint. */
async function testProviderKey(providerId: string, key: string): Promise<OxfordTestKeyResult> {
  const row = providerById(String(providerId || "")) ?? providerById(DEFAULT_PROVIDER_ID)!;
  const trimmed = String(key || "").trim();
  if (!trimmed) return { ok: false, message: "empty key" };
  const headers: Record<string, string> =
    row.adapterKind === "anthropic"
      ? { "x-api-key": trimmed, "anthropic-version": "2023-06-01" }
      : row.adapterKind === "gemini"
        ? { "x-goog-api-key": trimmed }
        : { Authorization: "Bearer " + trimmed };
  const hostname = new URL(row.testKeyEndpoint).hostname;
  try {
    const response = await fetch(row.testKeyEndpoint, { headers });
    if (response.ok) return { ok: true, message: "" };
    let detail = "HTTP " + response.status;
    try {
      const data = await response.json();
      if (data && data.message) detail = data.message;
      else if (data && data.detail) detail = data.detail;
      else if (data && data.error && data.error.message) detail = data.error.message;
    } catch (err) {
      // keep the HTTP status
    }
    return { ok: false, message: detail };
  } catch (err: any) {
    const raw = String(err && err.message ? err.message : err);
    return {
      ok: false,
      message:
        "could not reach " + hostname + " (" + raw + "). " +
        "If this is Firefox: about:addons → Oxford Popup → «Разрешения и данные» → enable " + hostname + "."
    };
  }
}
