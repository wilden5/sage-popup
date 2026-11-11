/**
 * Vitest port of the legacy test_inflect.js — all 33 checks verbatim:
 * same check names, same inputs, same expected values (27 inflection
 * candidates + 6 AI prompt checks), now importing the pure functions from
 * the split TypeScript modules.
 */

import { describe, it, expect } from "vitest";

import { candidatesFor } from "../src/background/inflect";
import { buildAiPrompt } from "../src/background/ai-prompt";

describe("candidatesFor — inflection candidates (27 cases)", () => {
  // 1-3: plain forms pass through untouched, no phantom candidates
  it("plain word", () => {
    expect(candidatesFor("cocoa")).toEqual(["cocoa"]);
  });
  it("irregular with own entry (went)", () => {
    expect(candidatesFor("went")).toEqual(["went"]);
  });
  it("singular ending in -s is not stripped (status)", () => {
    expect(candidatesFor("status")).toEqual(["status"]);
  });

  // 4-6: irregular table
  it("children -> child", () => {
    expect(candidatesFor("children")).toContain("child");
  });
  it("women -> woman", () => {
    expect(candidatesFor("women")).toContain("woman");
  });
  it("hid -> hide", () => {
    expect(candidatesFor("hid")).toContain("hide");
  });

  // 7-10: plural rules
  it("cities -> city", () => {
    expect(candidatesFor("cities")).toContain("city");
  });
  it("knives -> knife", () => {
    expect(candidatesFor("knives")).toContain("knife");
  });
  it("wolves -> wolf", () => {
    expect(candidatesFor("wolves")).toContain("wolf");
  });
  it("analyses -> analysis", () => {
    expect(candidatesFor("analyses")).toContain("analysis");
  });

  // 11-16: -es / generic -s
  it("boxes -> box", () => {
    expect(candidatesFor("boxes")).toContain("box");
  });
  it("watches -> watch", () => {
    expect(candidatesFor("watches")).toContain("watch");
  });
  it("goes -> go", () => {
    expect(candidatesFor("goes")).toContain("go");
  });
  it("seeds -> seed", () => {
    expect(candidatesFor("seeds")).toContain("seed");
  });
  it("houses -> house", () => {
    expect(candidatesFor("houses")).toContain("house");
  });
  it("genies -> genie", () => {
    expect(candidatesFor("genies")).toContain("genie");
  });

  // 17-21: verb -ing
  it("walking -> walk", () => {
    expect(candidatesFor("walking")).toContain("walk");
  });
  it("running -> run (doubling)", () => {
    expect(candidatesFor("running")).toContain("run");
  });
  it("making -> make", () => {
    expect(candidatesFor("making")).toContain("make");
  });
  it("typing -> type", () => {
    expect(candidatesFor("typing")).toContain("type");
  });
  it("short -ing word untouched (sing)", () => {
    expect(candidatesFor("sing").includes("si")).toBe(false);
  });

  // 22-24: verb -ed
  it("walked -> walk", () => {
    expect(candidatesFor("walked")).toContain("walk");
  });
  it("stopped -> stop (doubling)", () => {
    expect(candidatesFor("stopped")).toContain("stop");
  });
  it("loved -> love", () => {
    expect(candidatesFor("loved")).toContain("love");
  });

  // 25-27: possessives, phrases
  it("john's -> john", () => {
    expect(candidatesFor("john's")).toContain("john");
  });
  it("students' -> student", () => {
    expect(candidatesFor("students'")).toContain("student");
  });
  it("phrase varies last word (running shoes -> running shoe)", () => {
    expect(candidatesFor("running shoes")).toContain("running shoe");
  });
});

describe("buildAiPrompt (6 cases)", () => {
  const p1 = buildAiPrompt("cocoa", "I drink cocoa every morning.", false);
  it("prompt quotes the word", () => {
    expect(p1.includes('"cocoa"')).toBe(true);
  });
  it("prompt says it is a word", () => {
    expect(p1.includes("the word")).toBe(true);
  });
  it("prompt includes context", () => {
    expect(p1.includes('Context from the page: "I drink cocoa every morning."')).toBe(true);
  });
  const p2 = buildAiPrompt("cocoa", "", false);
  it("no context line when sentence empty", () => {
    expect(p2.includes("Context from the page")).toBe(false);
  });
  const p3 = buildAiPrompt("piece of cake", "That exam was a piece of cake.", true);
  it("phrase prompt says phrase", () => {
    expect(p3.includes("the phrase") && p3.includes('"piece of cake"')).toBe(true);
  });
  it("prompt bans markdown", () => {
    expect(p1.includes("No markdown") && p1.includes("1. meaning")).toBe(true);
  });
});
