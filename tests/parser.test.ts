/**
 * Fixture-based regression tests for parseEntry (src/content/parser.ts).
 *
 * The fixtures in tests/fixtures/ are the first <div class="entry"> subtree
 * of the live Oxford Learner's Dictionaries pages for cocoa / house / walk
 * (scripts and comments stripped), committed as the regression baseline.
 * They run fully OFFLINE — scripts/live-check.js stays the online canary.
 */

import { describe, it, expect } from "vitest";

import { parseEntry } from "../src/content/parser";

import cocoaHtml from "./fixtures/cocoa.html?raw";
import houseHtml from "./fixtures/house.html?raw";
import walkHtml from "./fixtures/walk.html?raw";

const FIXTURES = [
  {
    name: "cocoa",
    html: cocoaHtml,
    headword: "cocoa",
    pos: "noun",
    level: "",
    levelList: "",
  },
  {
    name: "house",
    html: houseHtml,
    headword: "house",
    pos: "noun",
    level: "A1",
    levelList: "Oxford 3000",
  },
  {
    name: "walk",
    html: walkHtml,
    headword: "walk",
    pos: "verb",
    level: "A1",
    levelList: "Oxford 3000",
  },
] as const;

describe("parseEntry — Oxford fixture pages", () => {
  for (const fixture of FIXTURES) {
    describe(fixture.name, () => {
      it("parses the entry and extracts headword and pos", () => {
        const entry = parseEntry(fixture.html);
        expect(entry).not.toBeNull();
        expect(entry!.headword).toBe(fixture.headword);
        expect(entry!.pos).toBe(fixture.pos);
      });

      it("extracts BrE/NAmE transcriptions and MP3 audio URLs", () => {
        const entry = parseEntry(fixture.html);
        expect(entry).not.toBeNull();
        expect(entry!.phonBr.length).toBeGreaterThan(0);
        expect(entry!.phonBr.startsWith("/")).toBe(true);
        expect(entry!.phonUs.length).toBeGreaterThan(0);
        expect(entry!.phonUs.startsWith("/")).toBe(true);
        expect(entry!.audioUk.length).toBeGreaterThan(0);
        expect(entry!.audioUk).toContain(".mp3");
        expect(entry!.audioUs.length).toBeGreaterThan(0);
        expect(entry!.audioUs).toContain(".mp3");
      });

      it("extracts at least one sense with a non-empty definition", () => {
        const entry = parseEntry(fixture.html);
        expect(entry).not.toBeNull();
        expect(entry!.senses.length).toBeGreaterThanOrEqual(1);
        for (const sense of entry!.senses) {
          expect(sense.def.length).toBeGreaterThan(0);
        }
      });

      it(`extracts the CEFR level (${fixture.level || "none"}) and list (${fixture.levelList || "none"})`, () => {
        const entry = parseEntry(fixture.html);
        expect(entry).not.toBeNull();
        expect(entry!.level).toBe(fixture.level);
        expect(entry!.levelList).toBe(fixture.levelList);
      });
    });
  }
});

describe("parseEntry — garbage rejection", () => {
  it("returns null for a page that is not a dictionary entry", () => {
    expect(
      parseEntry("<html><body><p>not a dictionary page</p></body></html>")
    ).toBeNull();
  });

  it("returns null for an entry without senses", () => {
    expect(
      parseEntry('<div class="entry"><h1 class="headword">x</h1></div>')
    ).toBeNull();
  });
});
