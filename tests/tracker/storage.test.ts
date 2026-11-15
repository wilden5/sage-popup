import { describe, it, expect, beforeEach } from "vitest";
import {
  WORD_TRACKER_KEY,
  WORD_TRACKER_SETTINGS_KEY,
  clearArchived,
  clearTracker,
  readTracker,
  writeTracker,
  readTrackerSettings,
  writeTrackerSettings,
  saveWord,
  unsaveWord,
} from "../../src/tracker/storage";
import { TRACKER_SETTINGS_SCHEMA_VERSION, defaultTrackerSettings } from "../../src/tracker/settings";
import { DEFAULT_THRESHOLD, WORD_TRACKER_SCHEMA_VERSION, emptyTracker } from "../../src/tracker/model";
import type { WordEntry } from "../../src/tracker/model";

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

describe("tracker settings storage", () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    installChromeMock(store);
  });

  it("returns defaults when the key is missing", async () => {
    expect(await readTrackerSettings()).toEqual(defaultTrackerSettings());
  });

  it("returns defaults for a non-object value", async () => {
    store.set(WORD_TRACKER_SETTINGS_KEY, "nope");
    expect(await readTrackerSettings()).toEqual(defaultTrackerSettings());
  });

  it("returns defaults on a schema version mismatch", async () => {
    store.set(WORD_TRACKER_SETTINGS_KEY, { schemaVersion: 999, threshold: 5 });
    expect(await readTrackerSettings()).toEqual(defaultTrackerSettings());
  });

  it("returns defaults when the threshold is not a finite number", async () => {
    store.set(WORD_TRACKER_SETTINGS_KEY, { schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: "3" });
    expect(await readTrackerSettings()).toEqual(defaultTrackerSettings());
    store.set(WORD_TRACKER_SETTINGS_KEY, { schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: NaN });
    expect(await readTrackerSettings()).toEqual(defaultTrackerSettings());
  });

  it("reads back a written settings object", async () => {
    await writeTrackerSettings({ schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: 7 });
    expect(await readTrackerSettings()).toEqual({ schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: 7 });
    expect(store.get(WORD_TRACKER_SETTINGS_KEY)).toEqual({
      schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION,
      threshold: 7,
    });
  });

  it("clamps an out-of-range stored threshold instead of throwing", async () => {
    store.set(WORD_TRACKER_SETTINGS_KEY, { schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: 42 });
    expect(await readTrackerSettings()).toEqual({
      schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION,
      threshold: 10,
    });
  });

  it("keeps the settings key separate from the wordTracker key", async () => {
    await writeTracker(emptyTracker());
    await writeTrackerSettings({ schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: 2 });
    expect(store.has(WORD_TRACKER_KEY)).toBe(true);
    expect(store.has(WORD_TRACKER_SETTINGS_KEY)).toBe(true);
    expect((await readTracker()).words).toEqual({});
    expect((await readTrackerSettings()).threshold).toBe(2);
  });

  it("default threshold is DEFAULT_THRESHOLD", () => {
    expect(defaultTrackerSettings().threshold).toBe(DEFAULT_THRESHOLD);
  });
});

describe("tracker collection cleanup", () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    installChromeMock(store);
  });

  function makeEntry(lemma: string, status: WordEntry["status"]): WordEntry {
    return {
      id: lemma + "-id",
      lemma,
      forms: [lemma],
      count: 2,
      firstSeen: 1000,
      lastSeen: 2000,
      updatedAt: 2000,
      status,
      definition: "definition of " + lemma,
    };
  }

  it("clearTracker writes an empty words map with the current schema version", async () => {
    await writeTracker({
      schemaVersion: WORD_TRACKER_SCHEMA_VERSION,
      words: { run: makeEntry("run", "active"), old: makeEntry("old", "archived") },
    });
    await clearTracker();
    expect(store.get(WORD_TRACKER_KEY)).toEqual({
      schemaVersion: WORD_TRACKER_SCHEMA_VERSION,
      words: {},
    });
    expect(await readTracker()).toEqual(emptyTracker());
  });

  it("clearTracker leaves the settings key untouched", async () => {
    await writeTrackerSettings({ schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: 4 });
    await writeTracker({ schemaVersion: WORD_TRACKER_SCHEMA_VERSION, words: { run: makeEntry("run", "ready") } });
    await clearTracker();
    expect((await readTrackerSettings()).threshold).toBe(4);
  });

  it("clearArchived removes only archived entries and keeps every other entry intact", async () => {
    const active = makeEntry("run", "active");
    const ready = makeEntry("think", "ready");
    const archived = makeEntry("old", "archived");
    await writeTracker({
      schemaVersion: WORD_TRACKER_SCHEMA_VERSION,
      words: { run: active, think: ready, old: archived },
    });
    await clearArchived();
    const data = await readTracker();
    expect(Object.keys(data.words).sort()).toEqual(["run", "think"]);
    expect(data.words["run"]).toEqual(active);
    expect(data.words["think"]).toEqual(ready);
    expect(data.schemaVersion).toBe(WORD_TRACKER_SCHEMA_VERSION);
  });

  it("clearArchived on an empty or archived-free collection changes nothing", async () => {
    await writeTracker(emptyTracker());
    await clearArchived();
    expect(await readTracker()).toEqual(emptyTracker());
    const ready = makeEntry("think", "ready");
    await writeTracker({ schemaVersion: WORD_TRACKER_SCHEMA_VERSION, words: { think: ready } });
    await clearArchived();
    expect((await readTracker()).words["think"]).toEqual(ready);
  });
});

describe("saveWord / unsaveWord", () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    installChromeMock(store);
  });

  function makeEntry(lemma: string): WordEntry {
    return {
      id: lemma + "-id",
      lemma,
      forms: [lemma],
      count: 2,
      firstSeen: 1000,
      lastSeen: 2000,
      updatedAt: 2000,
      status: "active",
    };
  }

  async function seed(entries: Record<string, WordEntry>): Promise<void> {
    await writeTracker({ schemaVersion: WORD_TRACKER_SCHEMA_VERSION, words: entries });
  }

  it("saveWord sets the saved flag + context, bumps updatedAt, and fills a missing definition", async () => {
    await seed({ run: makeEntry("run") });
    const entry = await saveWord("run", "He likes to run in the morning.", "to move fast on foot");
    expect(entry).not.toBeNull();
    expect(entry!.saved).toBe(true);
    expect(entry!.context).toBe("He likes to run in the morning.");
    expect(entry!.definition).toBe("to move fast on foot");
    expect(entry!.updatedAt).toBeGreaterThan(2000);
    const stored = (await readTracker()).words["run"];
    expect(stored).toEqual(entry);
    // the rest of the entry is untouched
    expect(stored!.count).toBe(2);
    expect(stored!.firstSeen).toBe(1000);
    expect(stored!.status).toBe("active");
  });

  it("saveWord never overwrites an existing definition", async () => {
    const withDef = makeEntry("run");
    withDef.definition = "existing definition";
    await seed({ run: withDef });
    const entry = await saveWord("run", "ctx", "a different definition");
    expect(entry!.definition).toBe("existing definition");
    expect((await readTracker()).words["run"]!.definition).toBe("existing definition");
  });

  it("saveWord ignores an empty-string definition", async () => {
    await seed({ run: makeEntry("run") });
    const entry = await saveWord("run", "ctx", "");
    expect(entry!.definition).toBeUndefined();
  });

  it("saveWord is a null no-op for an unknown lemma and writes nothing", async () => {
    await seed({ run: makeEntry("run") });
    const entry = await saveWord("unknown", "ctx", "def");
    expect(entry).toBeNull();
    expect(Object.keys((await readTracker()).words)).toEqual(["run"]);
  });

  it("unsaveWord flips the flag off and keeps the whole entry", async () => {
    const savedEntry = makeEntry("run");
    savedEntry.saved = true;
    savedEntry.context = "ctx";
    savedEntry.definition = "to move fast on foot";
    await seed({ run: savedEntry });
    await unsaveWord("run");
    const stored = (await readTracker()).words["run"];
    expect(stored).not.toBeUndefined();
    expect(stored!.saved).toBe(false);
    expect(stored!.context).toBe("ctx"); // context is kept, only the flag flips
    expect(stored!.definition).toBe("to move fast on foot");
    expect(stored!.count).toBe(2);
    expect(stored!.status).toBe("active");
    expect(stored!.updatedAt).toBeGreaterThan(2000);
  });

  it("unsaveWord is a no-op for an unknown lemma", async () => {
    await seed({ run: makeEntry("run") });
    await unsaveWord("unknown");
    expect(Object.keys((await readTracker()).words)).toEqual(["run"]);
  });
});
