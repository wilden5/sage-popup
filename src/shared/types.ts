/**
 * Shared runtime message protocol for Oxford Popup.
 *
 * Shapes are derived from the actual wiring: the chrome.runtime.onMessage /
 * onConnect listeners in src/background/main.ts and the sendMessage / port
 * listeners in src/content.js (plus the oxford-test-key call in options.js).
 * Exports only — no logic.
 */

/** chrome.runtime.sendMessage({ type: "oxford-lookup", word }) — content -> background. */
export interface OxfordLookupRequest {
  type: "oxford-lookup";
  word: string;
}

/** Async sendResponse to an oxford-lookup request. */
export interface OxfordLookupResponse {
  ok: boolean; // an Oxford definition page was fetched (html is present)
  error: boolean; // network failure / timeout on every candidate
  url: string; // definition URL that matched ("" when the word was empty)
  word: string; // the normalized word that was looked up
  html?: string; // raw Oxford HTML, parsed by the content script via DOMParser
}

/** chrome.runtime.sendMessage({ type: "oxford-open-options" }) — open the settings page. */
export interface OxfordOpenOptionsMessage {
  type: "oxford-open-options";
}

/** chrome.runtime.sendMessage({ type: "oxford-test-key", key, provider }) — options page -> background. */
export interface OxfordTestKeyRequest {
  type: "oxford-test-key";
  key: string;
  provider: string;
}

/** Async sendResponse to an oxford-test-key request. */
export interface OxfordTestKeyResult {
  ok: boolean;
  message: string;
}

/** Any one-shot runtime message the background script handles. */
export type RuntimeMessage =
  | OxfordLookupRequest
  | OxfordOpenOptionsMessage
  | OxfordTestKeyRequest;

/** First message on the "oxford-ai" port — content -> background. */
export interface AiPortRequest {
  word: string;
  sentence: string;
  isPhrase: boolean;
}

/** Streamed answer chunk — background -> content. */
export interface AiChunkMessage {
  type: "chunk";
  text: string;
}

/** Stream finished (the API sent data: [DONE]). */
export interface AiDoneMessage {
  type: "done";
}

/** No API key stored — the popup shows the "Open settings" UI. */
export interface AiNoKeyMessage {
  type: "no-key";
}

/** The Mistral request failed; message is the readable error string. */
export interface AiErrorMessage {
  type: "error";
  message: string;
}

/** Any message the background posts on the "oxford-ai" port — background -> content. */
export type AiPortMessage =
  | AiChunkMessage
  | AiDoneMessage
  | AiNoKeyMessage
  | AiErrorMessage;

/**
 * A plain snapshot of chrome.storage.local ({ [key]: unknown }) as seen by
 * the pure storage helpers in src/shared/providers.ts — no chrome.* types.
 */
export interface StorageSnapshot {
  [key: string]: unknown;
}

/** chrome.storage.local `aiKeys`: per-provider API keys. */
export interface AiKeysMap {
  [providerId: string]: string;
}

/** chrome.storage.local `aiModels`: per-provider model overrides. */
export interface AiModelsMap {
  [providerId: string]: string;
}
