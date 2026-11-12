/**
 * Vitest port of the legacy test_ai_parse.js — all 10 checks verbatim:
 * same check names, same inputs, same expected values, now importing
 * parseAiItems from the split TypeScript module.
 */

import { describe, it, expect } from "vitest";

import { parseAiItems } from "../src/content/parse-ai-items";

describe("parseAiItems — streamed AI answer parsing (10 cases)", () => {
  // 1: numbered items with em dash split into meaning + example
  it("numbered items", () => {
    expect(
      parseAiItems("1. a hot drink — I drink cocoa at breakfast.\n2. powder — Add cocoa to the batter.")
    ).toEqual([
      { meaning: "a hot drink", example: "I drink cocoa at breakfast." },
      { meaning: "powder", example: "Add cocoa to the batter." }
    ]);
  });

  // 2: quotes around examples are stripped
  it("quotes stripped", () => {
    expect(parseAiItems('1. easy — "The exam was easy."')).toEqual([
      { meaning: "easy", example: "The exam was easy." }
    ]);
  });

  // 3: empty lines skipped
  it("empty lines skipped", () => {
    expect(parseAiItems("\n\n1. a — b\n\n")).toEqual([{ meaning: "a", example: "b" }]);
  });

  // 4: stray preamble skipped
  it("preamble skipped", () => {
    expect(parseAiItems("Sure! Here are the meanings:\n1. a — b")).toEqual([
      { meaning: "a", example: "b" }
    ]);
  });

  // 5: closing line skipped
  it("closing skipped", () => {
    expect(parseAiItems("1. a — b\nHope this helps!")).toEqual([{ meaning: "a", example: "b" }]);
  });

  // 6: en dash and plain hyphen also split
  it("en dash splits", () => {
    expect(parseAiItems("1. a – b")).toEqual([{ meaning: "a", example: "b" }]);
  });
  it("plain hyphen splits", () => {
    expect(parseAiItems("2) a - b")).toEqual([{ meaning: "a", example: "b" }]);
  });

  // 7: unnumbered line without dash -> meaning only
  it("no dash -> meaning only", () => {
    expect(parseAiItems("a short meaning")).toEqual([{ meaning: "a short meaning", example: "" }]);
  });

  // 8: caps at 4 items
  it("caps at 4 items", () => {
    expect(parseAiItems("1. a — b\n2. c — d\n3. e — f\n4. g — h\n5. i — j").length).toEqual(4);
  });

  // 9: whitespace trimmed
  it("whitespace trimmed", () => {
    expect(parseAiItems("  1.  a  —  b  ")).toEqual([{ meaning: "a", example: "b" }]);
  });
});
