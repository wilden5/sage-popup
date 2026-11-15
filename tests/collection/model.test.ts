import { describe, it, expect } from "vitest";
import {
  PHRASES_SCHEMA_VERSION,
  emptyPhraseCollection,
  makePhraseId,
  normalizePhrase,
} from "../../src/collection/model";

describe("normalizePhrase", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizePhrase("  take it easy  ")).toBe("take it easy");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizePhrase("take   it    easy")).toBe("take it easy");
  });

  it("collapses tabs and newlines into single spaces", () => {
    expect(normalizePhrase("take\tit\neasy\r\nhome")).toBe("take it easy home");
  });

  it("lowercases the result", () => {
    expect(normalizePhrase("Take IT Easy")).toBe("take it easy");
  });

  it("maps the empty string to the empty string", () => {
    expect(normalizePhrase("")).toBe("");
    expect(normalizePhrase("   \t\n  ")).toBe("");
  });
});

describe("makePhraseId", () => {
  it("hashes the empty string to the FNV-1a offset basis", () => {
    expect(makePhraseId("")).toBe("811c9dc5");
  });

  it("is deterministic across repeated calls", () => {
    expect(makePhraseId("take it easy")).toBe(makePhraseId("take it easy"));
  });

  it("produces different ids for different texts", () => {
    const ids = new Set([makePhraseId("take it easy"), makePhraseId("take it slow"), makePhraseId("")]);
    expect(ids.size).toBe(3);
  });

  it("returns an 8-char lowercase hex string", () => {
    expect(makePhraseId("spill the beans")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("emptyPhraseCollection", () => {
  it("has the current schema version and no phrases", () => {
    const data = emptyPhraseCollection();
    expect(data.schemaVersion).toBe(PHRASES_SCHEMA_VERSION);
    expect(data.phrases).toEqual({});
  });
});
