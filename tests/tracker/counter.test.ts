import { describe, it, expect, beforeEach } from "vitest";
import { recordMeeting } from "../../src/tracker/counter";
import { makeWordId, WORD_TRACKER_SCHEMA_VERSION } from "../../src/tracker/model";
import { WORD_TRACKER_KEY } from "../../src/tracker/storage";

/** Tiny in-memory chrome.storage.local installed on globalThis before each test. */
function installChromeMock(store: Map<string, unknown>) {
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        },
      },
    },
  };
}

function storedData(store: Map<string, unknown>) {
  return store.get(WORD_TRACKER_KEY) as {
    schemaVersion: number;
    words: Record<string, { count: number; status: string; forms: string[]; id: string }>;
  };
}

describe("recordMeeting", () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    installChromeMock(store);
  });

  it("records a first meeting with the normalized lemma", async () => {
    const entry = await recordMeeting("went");
    expect(entry).not.toBeNull();
    expect(entry!.lemma).toBe("go");
    expect(entry!.forms).toEqual(["went"]);
    expect(entry!.count).toBe(1);
    expect(entry!.status).toBe("active");
    expect(entry!.id).toBe(makeWordId("go"));
  });

  it("accumulates count and distinct forms across meetings", async () => {
    await recordMeeting("went");
    const second = await recordMeeting("gone");
    expect(second!.count).toBe(2);
    expect(second!.forms).toEqual(["went", "gone"]);
    const third = await recordMeeting("go");
    expect(third!.count).toBe(3);
    expect(third!.status).toBe("ready");
    expect(third!.forms).toEqual(["went", "gone", "go"]);
  });

  it("persists under the wordTracker key with the schema version", async () => {
    await recordMeeting("went");
    const data = storedData(store);
    expect(data.schemaVersion).toBe(WORD_TRACKER_SCHEMA_VERSION);
    expect(Object.keys(data.words)).toEqual(["go"]);
  });

  it("ignores phrases and leaves storage untouched", async () => {
    const entry = await recordMeeting("give up");
    expect(entry).toBeNull();
    expect(store.has(WORD_TRACKER_KEY)).toBe(false);
  });

  it("normalizes case and punctuation", async () => {
    const entry = await recordMeeting("  Hello!  ");
    expect(entry).not.toBeNull();
    expect(entry!.lemma).toBe("hello");
    expect(entry!.forms).toEqual(["hello"]);
  });

  it("stores the definition argument and preserves an existing definition", async () => {
    const first = await recordMeeting("went", "to move from place to place");
    expect(first!.definition).toBe("to move from place to place");
    const second = await recordMeeting("gone", "a different definition");
    expect(second!.definition).toBe("to move from place to place");
  });

  it("resolves null instead of throwing when storage rejects", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      storage: {
        local: {
          get: async () => {
            throw new Error("storage unavailable");
          },
          set: async () => {
            throw new Error("storage unavailable");
          },
        },
      },
    };
    await expect(recordMeeting("went")).resolves.toBeNull();
  });
});
