"use strict";

/**
 * Unit tests for parseAiItems from content.js (extracted between the
 * ai-items markers — the function itself has no DOM dependencies).
 * Run: node test_ai_parse.js
 */

const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "src", "content.js"), "utf8");
const start = src.indexOf("/* ai-items-start");
const end = src.indexOf("/* ai-items-end");
if (start === -1 || end === -1) {
  console.error("FAIL: ai-items markers not found in content.js");
  process.exit(1);
}
const body = src.slice(start, end);

const sandbox = {};
new Function("scope", body + "\n; scope.parseAiItems = parseAiItems;")(sandbox);
const { parseAiItems } = sandbox;

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error("FAIL: " + name + "\n  expected " + JSON.stringify(expected) + "\n  actual   " + JSON.stringify(actual));
  }
}

// 1: numbered items with em dash split into meaning + example
check(
  "numbered items",
  parseAiItems("1. a hot drink — I drink cocoa at breakfast.\n2. powder — Add cocoa to the batter."),
  [
    { meaning: "a hot drink", example: "I drink cocoa at breakfast." },
    { meaning: "powder", example: "Add cocoa to the batter." }
  ]
);

// 2: quotes around examples are stripped
check(
  "quotes stripped",
  parseAiItems('1. easy — "The exam was easy."'),
  [{ meaning: "easy", example: "The exam was easy." }]
);

// 3: empty lines skipped
check("empty lines skipped", parseAiItems("\n\n1. a — b\n\n"), [{ meaning: "a", example: "b" }]);

// 4: stray preamble skipped
check(
  "preamble skipped",
  parseAiItems("Sure! Here are the meanings:\n1. a — b"),
  [{ meaning: "a", example: "b" }]
);

// 5: closing line skipped
check(
  "closing skipped",
  parseAiItems("1. a — b\nHope this helps!"),
  [{ meaning: "a", example: "b" }]
);

// 6: en dash and plain hyphen also split
check(
  "en dash splits",
  parseAiItems("1. a – b"),
  [{ meaning: "a", example: "b" }]
);
check(
  "plain hyphen splits",
  parseAiItems("2) a - b"),
  [{ meaning: "a", example: "b" }]
);

// 7: unnumbered line without dash -> meaning only
check(
  "no dash -> meaning only",
  parseAiItems("a short meaning"),
  [{ meaning: "a short meaning", example: "" }]
);

// 8: caps at 4 items
check(
  "caps at 4 items",
  parseAiItems("1. a — b\n2. c — d\n3. e — f\n4. g — h\n5. i — j").length,
  4
);

// 9: whitespace trimmed
check(
  "whitespace trimmed",
  parseAiItems("  1.  a  —  b  "),
  [{ meaning: "a", example: "b" }]
);

if (failed === 0) {
  console.log("ALL " + (passed + failed) + " PASSED");
} else {
  console.log(passed + " passed, " + failed + " FAILED");
  process.exit(1);
}
