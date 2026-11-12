/**
 * MULTI_PROVIDER.md §7, first two blocks: the §2 provider registry and the
 * §3 pure storage helpers from src/shared/providers.ts. Offline, no chrome.*.
 */

import { describe, it, expect } from "vitest";

import {
  PROVIDERS,
  DEFAULT_PROVIDER_ID,
  providerById,
  selectedProvider,
  apiKeyFor,
  modelFor,
} from "../src/shared/providers";

describe("PROVIDERS registry — §2 table", () => {
  it("has exactly 8 rows in table order", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual([
      "mistral",
      "openai",
      "groq",
      "openrouter",
      "deepseek",
      "xai",
      "anthropic",
      "gemini",
    ]);
  });

  it("ids, origins and chat endpoints are unique", () => {
    const ids = PROVIDERS.map((p) => p.id);
    const origins = PROVIDERS.map((p) => p.origin);
    const endpoints = PROVIDERS.map((p) => p.chatEndpoint);
    expect(new Set(ids).size).toBe(PROVIDERS.length);
    expect(new Set(origins).size).toBe(PROVIDERS.length);
    expect(new Set(endpoints).size).toBe(PROVIDERS.length);
  });

  it("chat endpoints byte-match §2, incl. deepseek without /v1 and gemini's <model> pattern", () => {
    const expected: Record<string, string> = {
      mistral: "https://api.mistral.ai/v1/chat/completions",
      openai: "https://api.openai.com/v1/chat/completions",
      groq: "https://api.groq.com/openai/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
      deepseek: "https://api.deepseek.com/chat/completions",
      xai: "https://api.x.ai/v1/chat/completions",
      anthropic: "https://api.anthropic.com/v1/messages",
      gemini:
        "https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse",
    };
    for (const p of PROVIDERS) {
      expect(p.chatEndpoint).toBe(expected[p.id]);
    }
  });

  it("origins are https URLs with a trailing /*", () => {
    for (const p of PROVIDERS) {
      expect(p.origin.startsWith("https://")).toBe(true);
      expect(p.origin.endsWith("/*")).toBe(true);
    }
  });

  it("labels and suggested models are all non-empty", () => {
    for (const p of PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.suggestedModel.length).toBeGreaterThan(0);
    }
  });

  it("test-key endpoints byte-match §2", () => {
    const expected: Record<string, string> = {
      mistral: "https://api.mistral.ai/v1/models",
      openai: "https://api.openai.com/v1/models",
      groq: "https://api.groq.com/openai/v1/models",
      openrouter: "https://openrouter.ai/api/v1/models",
      deepseek: "https://api.deepseek.com/models",
      xai: "https://api.x.ai/v1/models",
      anthropic: "https://api.anthropic.com/v1/models",
      gemini: "https://generativelanguage.googleapis.com/v1beta/models",
    };
    for (const p of PROVIDERS) {
      expect(p.testKeyEndpoint).toBe(expected[p.id]);
    }
  });

  it("mistral is the default provider", () => {
    expect(DEFAULT_PROVIDER_ID).toBe("mistral");
    expect(providerById(DEFAULT_PROVIDER_ID)?.id).toBe("mistral");
  });
});

describe("storage helpers — §3 snapshot helpers", () => {
  it("empty snapshot: mistral selected, key empty, model = suggestion", () => {
    const snapshot = {};
    expect(selectedProvider(snapshot)).toBe("mistral");
    expect(apiKeyFor(snapshot, "mistral")).toBe("");
    expect(modelFor(snapshot, "mistral")).toBe("mistral-small-latest");
    expect(modelFor(snapshot, "gemini")).toBe("gemini-3.8-flash");
  });

  it("legacy migration: mistralApiKey without aiKeys is read as aiKeys.mistral", () => {
    const snapshot = { mistralApiKey: "legacy-key" };
    expect(apiKeyFor(snapshot, "mistral")).toBe("legacy-key");
    expect(apiKeyFor(snapshot, "openai")).toBe("");
  });

  it("migration ignored when aiKeys exists (legacy key not merged)", () => {
    const snapshot = {
      mistralApiKey: "legacy-key",
      aiKeys: { openai: "openai-key" },
    };
    expect(apiKeyFor(snapshot, "mistral")).toBe("");
    expect(apiKeyFor(snapshot, "openai")).toBe("openai-key");
  });

  it("apiKeyFor reads aiKeys[id] and tolerates non-string entries", () => {
    const snapshot = { aiKeys: { groq: "groq-key", xai: 42 } };
    expect(apiKeyFor(snapshot, "groq")).toBe("groq-key");
    expect(apiKeyFor(snapshot, "xai")).toBe("");
    expect(apiKeyFor(snapshot, "anthropic")).toBe("");
  });

  it("modelFor falls back to the registry suggestion and honors aiModels overrides", () => {
    expect(modelFor({}, "openai")).toBe("gpt-5-mini");
    const snapshot = { aiModels: { openai: "gpt-5" } };
    expect(modelFor(snapshot, "openai")).toBe("gpt-5");
    expect(modelFor(snapshot, "groq")).toBe("llama-3.3-70b-versatile");
  });

  it("unknown provider id falls back to the default selection", () => {
    expect(selectedProvider({ aiProvider: "not-a-provider" })).toBe("mistral");
    expect(selectedProvider({ aiProvider: 42 })).toBe("mistral");
    expect(selectedProvider({ aiProvider: "groq" })).toBe("groq");
  });

  it("unrelated snapshot keys are tolerated", () => {
    const snapshot = {
      theme: "dark",
      aiProvider: "anthropic",
      aiKeys: { anthropic: "sk-ant" },
      somethingElse: { nested: true },
    };
    expect(selectedProvider(snapshot)).toBe("anthropic");
    expect(apiKeyFor(snapshot, "anthropic")).toBe("sk-ant");
    expect(modelFor(snapshot, "anthropic")).toBe("claude-haiku-5-5");
  });
});
