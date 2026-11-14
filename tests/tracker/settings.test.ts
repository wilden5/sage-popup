import { describe, it, expect } from "vitest";
import {
  TRACKER_SETTINGS_SCHEMA_VERSION,
  clampThreshold,
  defaultTrackerSettings,
  applyThreshold,
} from "../../src/tracker/settings";
import { DEFAULT_THRESHOLD, emptyTracker, applyMeeting } from "../../src/tracker/model";
import type { WordEntry } from "../../src/tracker/model";

function makeEntry(lemma: string, overrides: Partial<WordEntry>): WordEntry {
  return {
    id: lemma,
    lemma,
    forms: [lemma],
    count: 1,
    firstSeen: 1000,
    lastSeen: 1000,
    updatedAt: 1000,
    status: "active",
    ...overrides,
  };
}

describe("defaultTrackerSettings", () => {
  it("returns schema version 1 and the default threshold", () => {
    expect(defaultTrackerSettings()).toEqual({
      schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION,
      threshold: DEFAULT_THRESHOLD,
    });
    expect(TRACKER_SETTINGS_SCHEMA_VERSION).toBe(1);
  });
});

describe("clampThreshold", () => {
  it("keeps values inside [1, 10] unchanged", () => {
    for (const v of [1, 2, 3, 5, 10]) {
      expect(clampThreshold(v)).toBe(v);
    }
  });

  it("clamps below 1 to 1 and above 10 to 10", () => {
    expect(clampThreshold(0)).toBe(1);
    expect(clampThreshold(-7)).toBe(1);
    expect(clampThreshold(11)).toBe(10);
    expect(clampThreshold(999)).toBe(10);
  });

  it("rounds fractional values to an integer", () => {
    expect(clampThreshold(2.4)).toBe(2);
    expect(clampThreshold(2.5)).toBe(3);
    expect(clampThreshold(0.4)).toBe(1);
    expect(clampThreshold(10.6)).toBe(10);
  });

  it("falls back to the default for non-finite input", () => {
    expect(clampThreshold(NaN)).toBe(DEFAULT_THRESHOLD);
    expect(clampThreshold(Infinity)).toBe(DEFAULT_THRESHOLD);
    expect(clampThreshold(-Infinity)).toBe(DEFAULT_THRESHOLD);
  });
});

describe("applyThreshold", () => {
  it("flips active entries to ready at the threshold and keeps the rest active", () => {
    const data = emptyTracker();
    data.words["go"] = makeEntry("go", { count: 3, status: "active" });
    data.words["walk"] = makeEntry("walk", { count: 2, status: "active" });
    applyThreshold(data, 3);
    expect(data.words["go"]!.status).toBe("ready");
    expect(data.words["walk"]!.status).toBe("active");
  });

  it("downgrades ready back to active when the threshold rises (both directions)", () => {
    const data = emptyTracker();
    data.words["go"] = makeEntry("go", { count: 3, status: "ready" });
    applyThreshold(data, 5);
    expect(data.words["go"]!.status).toBe("active");
    applyThreshold(data, 3);
    expect(data.words["go"]!.status).toBe("ready");
  });

  it("never touches archived entries", () => {
    const data = emptyTracker();
    data.words["old"] = makeEntry("old", { count: 99, status: "archived", updatedAt: 4242 });
    applyThreshold(data, 1);
    expect(data.words["old"]!.status).toBe("archived");
    expect(data.words["old"]!.updatedAt).toBe(4242);
  });

  it("leaves updatedAt unchanged for recomputed entries", () => {
    const data = emptyTracker();
    data.words["go"] = makeEntry("go", { count: 5, status: "active", updatedAt: 7777 });
    applyThreshold(data, 2);
    expect(data.words["go"]!.status).toBe("ready");
    expect(data.words["go"]!.updatedAt).toBe(7777);
  });

  it("clamps an out-of-range threshold", () => {
    const data = emptyTracker();
    data.words["go"] = makeEntry("go", { count: 1, status: "ready" });
    applyThreshold(data, 50); // clamps to 10 -> count 1 is below -> active
    expect(data.words["go"]!.status).toBe("active");
    applyThreshold(data, 0); // clamps to 1 -> count 1 meets it -> ready
    expect(data.words["go"]!.status).toBe("ready");
  });

  it("matches the meeting-driven status for entries built via applyMeeting", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "went", undefined, undefined, 1000);
    applyMeeting(data, "go", "gone", undefined, undefined, 2000);
    applyThreshold(data, 2);
    expect(data.words["go"]!.status).toBe("ready");
  });
});
