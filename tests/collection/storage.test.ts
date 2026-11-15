import { describe, it, expect, beforeEach } from "vitest";
import {
  PHRASE_COLLECTION_KEY,
  deletePhrase,
  readPhraseCollection,
  savePhrase,
  writePhraseCollection,
} from "../../src/collection/storage";
import { PHRASES_SCHEMA_VERSION, emptyPhraseCollection, makePhraseId, normalizePhrase } from "../../src/collection/model";

/** Tiny in-memory chrome.storage.local installed on globalThis before each test. */
function installChromeMock(store: Map<string, unknown>) {
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: async (key: string | null) => {
          if (key === null) {
            const all: Record<string, unknown> = {};
            for (const [k, v] of store) all[k] = v;
            return all;
          }
          return store.has(key) ? { [key]: store.get(key) } : {};
        },
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        },
      },
    },
  };
}

describe("readPhraseCollection", () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    installChromeMock(store);
  });

  it("returns an empty collection when the key is missing", async () => {
    expect(await readPhraseCollection()).toEqual(emptyPhraseCollection());
  });

  it("returns an empty collection for a non-object value", async () => {
    store.set(PHRASE_COLLECTION_KEY, "nope");
    expect(await readPhraseCollection()).toEqual(emptyPhraseCollection());
  });

  it("returns an empty collection on a schema version mismatch", async () => {
    store.set(PHRASE_COLLECTION_KEY, { schemaVersion: 999, phrases: { x: {} } });
    expect(await readPhraseCollection()).toEqual(emptyPhraseCollection());
  });

  it("reads back a written collection", async () => {
    const data = emptyPhraseCollection();
    await writePhraseCollection(data);
    expect(await readPhraseCollection()).toEqual(data);
    expect(store.get(PHRASE_COLLECTION_KEY)).toEqual(data);
  });
});

describe("savePhrase / deletePhrase", () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    installChromeMock(store);
  });

  it("creates a normalized-keyed entry with all timestamps set", async () => {
    const before = Date.now();
    const entry = await savePhrase("  Take   It\nEasy ", "You can take it easy now.", "to relax");
    const after = Date.now();
    const key = normalizePhrase("  Take   It\nEasy ");
    expect(key).toBe("take it easy");
    expect(entry).toEqual({
      id: makePhraseId(key),
      text: key,
      context: "You can take it easy now.",
      definition: "to relax",
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      updatedAt: entry.updatedAt,
    });
    expect(entry.firstSeen).toBeGreaterThanOrEqual(before);
    expect(entry.firstSeen).toBeLessThanOrEqual(after);
    expect(entry.lastSeen).toBe(entry.firstSeen);
    expect(entry.updatedAt).toBe(entry.firstSeen);
    const data = await readPhraseCollection();
    expect(Object.keys(data.phrases)).toEqual([key]);
    expect(data.phrases[key]).toEqual(entry);
    expect(data.schemaVersion).toBe(PHRASES_SCHEMA_VERSION);
  });

  it("re-save keeps definition and firstSeen, refreshes context and lastSeen/updatedAt, and creates no duplicate", async () => {
    const first = await savePhrase("take it easy", "first context", "to relax");
    // make the second save observably later
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await savePhrase("Take  It Easy", "fresh context", "a DIFFERENT definition");
    expect(second.id).toBe(first.id);
    expect(second.text).toBe(first.text);
    expect(second.definition).toBe("to relax"); // never overwritten
    expect(second.firstSeen).toBe(first.firstSeen); // kept
    expect(second.context).toBe("fresh context"); // refreshed
    expect(second.lastSeen).toBeGreaterThanOrEqual(first.lastSeen);
    expect(second.updatedAt).toBe(second.lastSeen);
    const data = await readPhraseCollection();
    expect(Object.keys(data.phrases)).toEqual(["take it easy"]); // no duplicate
    expect(data.phrases["take it easy"]).toEqual(second);
  });

  it("deletePhrase removes only its target entry", async () => {
    await savePhrase("take it easy", "ctx a", "def a");
    await savePhrase("spill the beans", "ctx b", "def b");
    await deletePhrase(normalizePhrase("Take It Easy"));
    const data = await readPhraseCollection();
    expect(Object.keys(data.phrases)).toEqual(["spill the beans"]);
    expect(data.phrases["spill the beans"]!.definition).toBe("def b");
  });

  it("deletePhrase is a no-op for an unknown key", async () => {
    await savePhrase("take it easy", "ctx a", "def a");
    await deletePhrase("no such phrase");
    const data = await readPhraseCollection();
    expect(Object.keys(data.phrases)).toEqual(["take it easy"]);
  });
});
