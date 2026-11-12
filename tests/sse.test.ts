/**
 * MULTI_PROVIDER.md §7, OpenAI-style SSE parser block: parseOpenAiSseLine
 * from src/background/stream-openai against the hand-written fixture
 * tests/fixtures/sse/openai.txt (minimal strings, NOT real traffic).
 * Fully offline.
 */

import { describe, it, expect } from "vitest";

import { parseOpenAiSseLine } from "../src/background/stream-openai";

import fixture from "./fixtures/sse/openai.txt?raw";

describe("parseOpenAiSseLine — OpenAI-compatible SSE", () => {
  it("fixture lines classify as ignore/chunk/chunk/ignore/done/ignore", () => {
    const lines = fixture.replace(/\n$/, "").split("\n");
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
