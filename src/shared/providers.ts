/**
 * Shared multi-provider registry + pure storage helpers (MULTI_PROVIDER.md
 * §2/§3). PURE module: no chrome.*, no network, no DOM — imported by the
 * background script, the options page and vitest alike.
 *
 * The registry rows are byte-exact from MULTI_PROVIDER.md §2 (verified live
 * 2026-11-11). DeepSeek's base path has NO /v1; Gemini's chatEndpoint is a
 * <model> pattern string. Model ids here are only *suggestions* — the model
 * field in the UI is free text and never hardcoded in logic.
 */

import type { StorageSnapshot } from "./types";

/** Which wire protocol/adapter a provider speaks. */
export type AdapterKind = "openai" | "anthropic" | "gemini";

/** One row of the §2 provider table. */
export interface ProviderInfo {
  id: string;
  label: string;
  /** Chat endpoint; for gemini the <model> pattern string. */
  chatEndpoint: string;
  /** Auth scheme description from §2 (Bearer / x-api-key / x-goog-api-key). */
  auth: string;
  adapterKind: AdapterKind;
  /** Suggested default model only — never enforced. */
  suggestedModel: string;
  /** optional_host_permissions origin (https, trailing /*). */
  origin: string;
  /** Cheap authenticated GET used by "Test key" (200 = key works). */
  testKeyEndpoint: string;
}

/** The fixed MVP set of 8 providers, in §2 table order. */
export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "mistral",
    label: "Mistral",
    chatEndpoint: "https://api.mistral.ai/v1/chat/completions",
    auth: "Bearer",
    adapterKind: "openai",
    suggestedModel: "mistral-small-latest",
    origin: "https://api.mistral.ai/*",
    testKeyEndpoint: "https://api.mistral.ai/v1/models",
  },
  {
    id: "openai",
    label: "OpenAI",
    chatEndpoint: "https://api.openai.com/v1/chat/completions",
    auth: "Bearer",
    adapterKind: "openai",
    suggestedModel: "gpt-5-mini",
    origin: "https://api.openai.com/*",
    testKeyEndpoint: "https://api.openai.com/v1/models",
  },
  {
    id: "groq",
    label: "Groq",
    chatEndpoint: "https://api.groq.com/openai/v1/chat/completions",
    auth: "Bearer",
    adapterKind: "openai",
    suggestedModel: "llama-3.3-70b-versatile",
    origin: "https://api.groq.com/*",
    testKeyEndpoint: "https://api.groq.com/openai/v1/models",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    chatEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    auth: "Bearer",
    adapterKind: "openai",
    suggestedModel: "meta-llama/llama-3.3-70b-instruct:free",
    origin: "https://openrouter.ai/*",
    testKeyEndpoint: "https://openrouter.ai/api/v1/models",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    chatEndpoint: "https://api.deepseek.com/chat/completions",
    auth: "Bearer",
    adapterKind: "openai",
    suggestedModel: "deepseek-v4-flash",
    origin: "https://api.deepseek.com/*",
    testKeyEndpoint: "https://api.deepseek.com/models",
  },
  {
    id: "xai",
    label: "xAI",
    chatEndpoint: "https://api.x.ai/v1/chat/completions",
    auth: "Bearer",
    adapterKind: "openai",
    suggestedModel: "grok-4.7",
    origin: "https://api.x.ai/*",
    testKeyEndpoint: "https://api.x.ai/v1/models",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    chatEndpoint: "https://api.anthropic.com/v1/messages",
    auth: "x-api-key + anthropic-version: 2023-06-01",
    adapterKind: "anthropic",
    suggestedModel: "claude-haiku-5-5",
    origin: "https://api.anthropic.com/*",
    testKeyEndpoint: "https://api.anthropic.com/v1/models",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    chatEndpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse",
    auth: "x-goog-api-key header",
    adapterKind: "gemini",
    suggestedModel: "gemini-3.8-flash",
    origin: "https://generativelanguage.googleapis.com/*",
    testKeyEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
];

/** Default provider — zero behavior change for existing Mistral users. */
export const DEFAULT_PROVIDER_ID = "mistral";

/** Look up a provider row by id (undefined for unknown ids). */
export function providerById(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * The selected provider id from a storage snapshot: the stored
 * `aiProvider`, defaulting to "mistral"; an unknown id falls back to the
 * default.
 */
export function selectedProvider(snapshot: StorageSnapshot): string {
  const stored = snapshot["aiProvider"];
  if (typeof stored === "string" && providerById(stored) !== undefined) {
    return stored;
  }
  return DEFAULT_PROVIDER_ID;
}

/**
 * The API key for a provider from a storage snapshot: `aiKeys[id]`.
 * One-time migration (§3): when `aiKeys` is unset AND the legacy
 * `mistralApiKey` exists, it is treated as `aiKeys.mistral` — the legacy
 * key is only read, never deleted; when `aiKeys` exists, no migration.
 */
export function apiKeyFor(snapshot: StorageSnapshot, id: string): string {
  const keys = snapshot["aiKeys"];
  if (keys !== null && typeof keys === "object") {
    const key = (keys as Record<string, unknown>)[id];
    return typeof key === "string" ? key : "";
  }
  if (id === DEFAULT_PROVIDER_ID) {
    const legacy = snapshot["mistralApiKey"];
    if (typeof legacy === "string") return legacy;
  }
  return "";
}

/**
 * The model for a provider from a storage snapshot: `aiModels[id]`,
 * falling back to the registry suggestion for that provider.
 */
export function modelFor(snapshot: StorageSnapshot, id: string): string {
  const models = snapshot["aiModels"];
  if (models !== null && typeof models === "object") {
    const model = (models as Record<string, unknown>)[id];
    if (typeof model === "string" && model.length > 0) return model;
  }
  return providerById(id)?.suggestedModel ?? "";
}
