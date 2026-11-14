import { describe, it, expect } from "vitest";
import {
  WORD_TRACKER_SCHEMA_VERSION,
  DEFAULT_THRESHOLD,
  makeWordId,
  emptyTracker,
  applyMeeting,
} from "../../src/tracker/model";

describe("makeWordId", () => {
  it("hashes the empty string to the FNV-1a offset basis", () => {
    expect(makeWordId("")).toBe("811c9dc5");
  });

  it("is deterministic across repeated calls", () => {
    expect(makeWordId("go")).toBe(makeWordId("go"));
    expect(makeWordId("hello")).toBe(makeWordId("hello"));
  });

  it("produces different ids for different lemmas", () => {
    const ids = new Set([makeWordId("go"), makeWordId("went"), makeWordId("hello"), makeWordId("")]);
    expect(ids.size).toBe(4);
  });

  it("returns an 8-char lowercase hex string", () => {
    expect(makeWordId("serendipity")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("emptyTracker", () => {
  it("has the current schema version and no words", () => {
    const data = emptyTracker();
    expect(data.schemaVersion).toBe(WORD_TRACKER_SCHEMA_VERSION);
    expect(data.words).toEqual({});
  });
});

describe("applyMeeting — first meeting", () => {
  it("creates the exact entry shape with injected now", () => {
    const data = emptyTracker();
    const entry = applyMeeting(data, "go", "went", undefined, undefined, 1000);
    expect(entry).toEqual({
      id: makeWordId("go"),
      lemma: "go",
      forms: ["went"],
      count: 1,
      firstSeen: 1000,
      lastSeen: 1000,
      updatedAt: 1000,
      status: "active",
    });
    expect(data.words["go"]).toBe(entry);
  });

  it("copies a non-empty definition on create", () => {
    const data = emptyTracker();
    const entry = applyMeeting(data, "go", "went", "to move from place to place", undefined, 1000);
    expect(entry.definition).toBe("to move from place to place");
  });

  it("ignores an empty-string definition on create", () => {
    const data = emptyTracker();
    const entry = applyMeeting(data, "go", "went", "", undefined, 1000);
    expect(entry.definition).toBeUndefined();
  });
});

describe("applyMeeting — subsequent meetings", () => {
  it("increments count and dedups forms", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "went", undefined, undefined, 1000);
    const entry = applyMeeting(data, "go", "went", undefined, undefined, 2000);
    expect(entry.count).toBe(2);
    expect(entry.forms).toEqual(["went"]);
    expect(entry.firstSeen).toBe(1000);
    expect(entry.lastSeen).toBe(2000);
    expect(entry.updatedAt).toBe(2000);
  });

  it("accumulates distinct raw forms for one lemma in first-seen order", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "went", undefined, undefined, 1000);
    applyMeeting(data, "go", "gone", undefined, undefined, 2000);
    const entry = applyMeeting(data, "go", "go", undefined, undefined, 3000);
    expect(entry.count).toBe(3);
    expect(entry.forms).toEqual(["went", "gone", "go"]);
  });
});

describe("applyMeeting — status transitions", () => {
  it("stays active below the default threshold and flips to ready at it", () => {
    const data = emptyTracker();
    expect(DEFAULT_THRESHOLD).toBe(3);
    expect(applyMeeting(data, "go", "went", undefined, undefined, 1000).status).toBe("active");
    expect(applyMeeting(data, "go", "gone", undefined, undefined, 2000).status).toBe("active");
    expect(applyMeeting(data, "go", "go", undefined, undefined, 3000).status).toBe("ready");
  });

  it("respects a custom threshold", () => {
    const data = emptyTracker();
    expect(applyMeeting(data, "go", "went", undefined, 2, 1000).status).toBe("active");
    expect(applyMeeting(data, "go", "go", undefined, 2, 2000).status).toBe("ready");
  });

  it("never downgrades ready as count grows", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "a", undefined, undefined, 1000);
    applyMeeting(data, "go", "b", undefined, undefined, 2000);
    applyMeeting(data, "go", "c", undefined, undefined, 3000);
    const entry = applyMeeting(data, "go", "d", undefined, undefined, 4000);
    expect(entry.count).toBe(4);
    expect(entry.status).toBe("ready");
  });

  it("keeps archived sticky even past the threshold", () => {
    const data = emptyTracker();
    const entry = applyMeeting(data, "go", "went", undefined, undefined, 1000);
    entry.status = "archived";
    const again = applyMeeting(data, "go", "go", undefined, undefined, 2000);
    expect(again.count).toBe(2);
    expect(again.status).toBe("archived");
    const third = applyMeeting(data, "go", "gone", undefined, undefined, 3000);
    expect(third.count).toBe(3);
    expect(third.status).toBe("archived");
  });
});

describe("applyMeeting — definition handling", () => {
  it("fills a missing definition later", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "went", undefined, undefined, 1000);
    const entry = applyMeeting(data, "go", "go", "to move", undefined, 2000);
    expect(entry.definition).toBe("to move");
  });

  it("never overwrites an existing definition", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "went", "first definition", undefined, 1000);
    const entry = applyMeeting(data, "go", "go", "second definition", undefined, 2000);
    expect(entry.definition).toBe("first definition");
  });

  it("ignores an empty-string definition on update", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "went", undefined, undefined, 1000);
    const entry = applyMeeting(data, "go", "go", "", undefined, 2000);
    expect(entry.definition).toBeUndefined();
  });
});

describe("applyMeeting — timestamps", () => {
  it("advances lastSeen/updatedAt with now while firstSeen stays", () => {
    const data = emptyTracker();
    applyMeeting(data, "go", "went", undefined, undefined, 1000);
    applyMeeting(data, "go", "gone", undefined, undefined, 5000);
    const entry = applyMeeting(data, "go", "go", undefined, undefined, 9000);
    expect(entry.firstSeen).toBe(1000);
    expect(entry.lastSeen).toBe(9000);
    expect(entry.updatedAt).toBe(9000);
  });
});
