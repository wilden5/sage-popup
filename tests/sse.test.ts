/**
 * MULTI_PROVIDER.md §7, OpenAI-style SSE parser block: parseOpenAiSseLine
 * from src/background/stream-openai against the hand-written fixture
 * tests/fixtures/sse/openai.txt (minimal strings, NOT real traffic).
 * Fully offline.
 */

import { describe, it, expect } from "vitest";

import { parseOpenAiSseLine } from "../src/background/stream-openai";
import { parseAnthropicSseLine } from "../src/background/stream-anthropic";
import { parseGeminiSseLine } from "../src/background/stream-gemini";

import openaiFixture from "./fixtures/sse/openai.txt?raw";
import anthropicFixture from "./fixtures/sse/anthropic.txt?raw";
import geminiFixture from "./fixtures/sse/gemini.txt?raw";

describe("parseOpenAiSseLine — OpenAI-compatible SSE", () => {
  it("fixture lines classify as ignore/chunk/chunk/ignore/done/ignore", () => {
    const lines = openaiFixture.replace(/\n$/, "").split("\n");
    expect(lines.map((l) => parseOpenAiSseLine(l).kind)).toEqual([
      "ignore", // ": keep-alive comment — a non-data line"
      "chunk", // plain content delta
      "chunk", // reasoning_content + content in one delta
      "ignore", // reasoning-only delta
      "done", // data: [DONE]
      "ignore", // partial JSON fragment
    ]);
  });

  it("content delta -> { kind: \"chunk\", text }", () => {
    expect(
      parseOpenAiSseLine('data: {"choices":[{"delta":{"content":"Hello"}}]}')
    ).toEqual({ kind: "chunk", text: "Hello" });
  });

  it("reasoning_content + content in one delta -> chunk with the content only", () => {
    const parsed = parseOpenAiSseLine(
      'data: {"choices":[{"delta":{"reasoning_content":"let me think","content":" world"}}]}'
    );
    expect(parsed).toEqual({ kind: "chunk", text: " world" });
  });

  it("reasoning-only delta -> ignore (reasoning_content or reasoning)", () => {
    expect(
      parseOpenAiSseLine('data: {"choices":[{"delta":{"reasoning_content":"hmm"}}]}')
    ).toEqual({ kind: "ignore", text: "" });
    expect(
      parseOpenAiSseLine('data: {"choices":[{"delta":{"reasoning":"hmm"}}]}')
    ).toEqual({ kind: "ignore", text: "" });
    expect(
      parseOpenAiSseLine('data: {"choices":[{"delta":{"role":"assistant"}}]}')
    ).toEqual({ kind: "ignore", text: "" });
  });

  it("\"data: [DONE]\" -> done", () => {
    expect(parseOpenAiSseLine("data: [DONE]")).toEqual({ kind: "done", text: "" });
  });

  it("non-data line, empty payload, invalid JSON -> ignore", () => {
    expect(parseOpenAiSseLine(": keep-alive")).toEqual({ kind: "ignore", text: "" });
    expect(parseOpenAiSseLine("event: ping")).toEqual({ kind: "ignore", text: "" });
    expect(parseOpenAiSseLine("data:")).toEqual({ kind: "ignore", text: "" });
    expect(parseOpenAiSseLine("data: {not json")).toEqual({ kind: "ignore", text: "" });
  });

  it("whitespace and partial-JSON tolerance", () => {
    expect(
      parseOpenAiSseLine('  data:  {"choices":[{"delta":{"content":"Hi"}}]}  ')
    ).toEqual({ kind: "chunk", text: "Hi" });
    expect(parseOpenAiSseLine("data:   [DONE]  ")).toEqual({ kind: "done", text: "" });
    expect(
      parseOpenAiSseLine('data: {"choices":[{"delta":{"con')
    ).toEqual({ kind: "ignore", text: "" });
  });
});

describe("parseAnthropicSseLine — Anthropic SSE", () => {
  it("fixture lines classify as ignore/chunk/ignore/done/ignore", () => {
    const lines = anthropicFixture.replace(/\n$/, "").split("\n");
    expect(lines.map((l) => parseAnthropicSseLine(l).kind)).toEqual([
      "ignore", // "event: content_block_delta" — event line
      "chunk", // text_delta
      "ignore", // thinking_delta
      "done", // message_stop
      "ignore", // invalid/partial JSON
    ]);
  });

  it("text_delta -> chunk with delta.text", () => {
    expect(
      parseAnthropicSseLine(
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}'
      )
    ).toEqual({ kind: "chunk", text: "Hello" });
  });

  it("thinking_delta (or any other delta.type) -> ignore", () => {
    expect(
      parseAnthropicSseLine(
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}'
      )
    ).toEqual({ kind: "ignore", text: "" });
  });

  it("message_stop -> done", () => {
    expect(parseAnthropicSseLine('data: {"type":"message_stop"}')).toEqual({
      kind: "done",
      text: "",
    });
  });

  it("event lines, empty payloads, invalid JSON -> ignore", () => {
    expect(parseAnthropicSseLine("event: message_start")).toEqual({ kind: "ignore", text: "" });
    expect(parseAnthropicSseLine("data:")).toEqual({ kind: "ignore", text: "" });
    expect(parseAnthropicSseLine('data: {"type":"content_block_delta","delta":{"type":"text_')).toEqual({
      kind: "ignore",
      text: "",
    });
  });
});

describe("parseGeminiSseLine — Gemini SSE", () => {
  it("fixture lines classify as chunk/chunk/done/ignore", () => {
    const lines = geminiFixture.replace(/\n$/, "").split("\n");
    expect(lines.map((l) => parseGeminiSseLine(l).kind)).toEqual([
      "chunk", // one part
      "chunk", // two parts (joined)
      "done", // finishReason chunk with text
      "ignore", // no candidates
    ]);
  });

  it("one part -> chunk with its text", () => {
    expect(
      parseGeminiSseLine('data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hello"}]}}]}')
    ).toEqual({ kind: "chunk", text: "Hello" });
  });

  it("two parts -> chunk with the JOINED text", () => {
    expect(
      parseGeminiSseLine(
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"brave "},{"text":"new world"}]}}]}'
      )
    ).toEqual({ kind: "chunk", text: "brave new world" });
  });

  it("finishReason -> done with the text preserved", () => {
    expect(
      parseGeminiSseLine(
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"!"}]},"finishReason":"STOP"}]}'
      )
    ).toEqual({ kind: "done", text: "!" });
  });

  it("no candidates / invalid JSON / non-data lines -> ignore", () => {
    expect(parseGeminiSseLine('data: {"promptFeedback":{"blockReason":"SAFETY"}}')).toEqual({
      kind: "ignore",
      text: "",
    });
    expect(parseGeminiSseLine('data: {"candidates":[{"content":{"parts":[{"text":"x"}}]}')).toEqual({
      kind: "ignore",
      text: "",
    });
    expect(parseGeminiSseLine("event: ping")).toEqual({ kind: "ignore", text: "" });
  });
});
