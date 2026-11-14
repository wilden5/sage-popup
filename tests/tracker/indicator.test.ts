import { describe, it, expect } from "vitest";
import { meetingIndicator } from "../../src/tracker/indicator";
import { DEFAULT_THRESHOLD, makeWordId } from "../../src/tracker/model";
import type { WordEntry } from "../../src/tracker/model";

function makeEntry(overrides: Partial<WordEntry>): WordEntry {
  return {
    id: makeWordId(overrides.lemma ?? "go"),
    lemma: "go",
    forms: ["go"],
    count: 1,
    firstSeen: 1000,
    lastSeen: 1000,
    updatedAt: 1000,
    status: "active",
    ...overrides,
  };
}

describe("meetingIndicator", () => {
  it("shows the counter for an active entry after one meeting (default threshold)", () => {
    const info = meetingIndicator(makeEntry({ count: 1, status: "active" }));
    expect(info.kind).toBe("counter");
    expect(info.text).toBe("seen 1/" + DEFAULT_THRESHOLD);
    expect(info.title).toBe(
      "Met 1 of " +
        DEFAULT_THRESHOLD +
        " times. When a word is met " +
        DEFAULT_THRESHOLD +
        " times, it is marked ready to learn."
    );
  });

  it("shows the counter for an active entry after two meetings (default threshold)", () => {
    const info = meetingIndicator(makeEntry({ count: 2, status: "active" }));
    expect(info.kind).toBe("counter");
    expect(info.text).toBe("seen 2/" + DEFAULT_THRESHOLD);
    expect(info.title).toBe(
      "Met 2 of " +
        DEFAULT_THRESHOLD +
        " times. When a word is met " +
        DEFAULT_THRESHOLD +
        " times, it is marked ready to learn."
    );
  });

  it("uses a custom threshold in both text and title", () => {
    const info = meetingIndicator(makeEntry({ count: 2, status: "active" }), 5);
    expect(info.kind).toBe("counter");
    expect(info.text).toBe("seen 2/5");
    expect(info.title).toBe(
      "Met 2 of 5 times. When a word is met 5 times, it is marked ready to learn."
    );
  });

  it("shows the ready badge for a ready entry, with the count in the title", () => {
    const info = meetingIndicator(makeEntry({ count: 4, status: "ready" }));
    expect(info.kind).toBe("ready");
    expect(info.text).toBe("ready to learn");
    expect(info.title).toBe("Met 4 times — ready to learn.");
  });

  it("hides archived entries with empty text and title", () => {
    const info = meetingIndicator(makeEntry({ count: 7, status: "archived" }));
    expect(info).toEqual({ kind: "hidden", text: "", title: "" });
  });

  it("lets status win over a higher threshold: ready entry with threshold 5 is not a 4/5 counter", () => {
    const info = meetingIndicator(makeEntry({ count: 4, status: "ready" }), 5);
    expect(info.kind).toBe("ready");
    expect(info.text).toBe("ready to learn");
    expect(info.title).toBe("Met 4 times — ready to learn.");
    expect(info.text).not.toContain("4/5");
  });
});
