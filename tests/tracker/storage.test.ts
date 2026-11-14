import { describe, it, expect, beforeEach } from "vitest";
import {
  WORD_TRACKER_KEY,
  WORD_TRACKER_SETTINGS_KEY,
  readTracker,
  writeTracker,
  readTrackerSettings,
  writeTrackerSettings,
} from "../../src/tracker/storage";
import { TRACKER_SETTINGS_SCHEMA_VERSION, defaultTrackerSettings } from "../../src/tracker/settings";
import { DEFAULT_THRESHOLD, emptyTracker } from "../../src/tracker/model";

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
