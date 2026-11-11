"use strict";

/**
 * Unit tests for the pure logic part of background.js (everything above the
 * "extension wiring" marker — no browser APIs touched). Run: node test_inflect.js
 */

const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "src", "background.js"), "utf8");
const pure = src.split("// ---- extension wiring")[0];

// eslint-disable-next-line no-eval
const sandbox = {};
new Function("scope", pure + "\n; scope.candidatesFor = candidatesFor; scope.buildAiPrompt = buildAiPrompt;")(sandbox);
const { candidatesFor, buildAiPrompt } = sandbox;

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

function contains(name, list, expected) {
  check(name, list.includes(expected), true);
}

// ---- inflection candidates (27 cases)

// 1-3: plain forms pass through untouched, no phantom candidates
check("plain word", candidatesFor("cocoa"), ["cocoa"]);
check("irregular with own entry (went)", candidatesFor("went"), ["went"]);
check("singular ending in -s is not stripped (status)", candidatesFor("status"), ["status"]);

// 4-6: irregular table
contains("children -> child", candidatesFor("children"), "child");
contains("women -> woman", candidatesFor("women"), "woman");
contains("hid -> hide", candidatesFor("hid"), "hide");

// 7-10: plural rules
contains("cities -> city", candidatesFor("cities"), "city");
contains("knives -> knife", candidatesFor("knives"), "knife");
contains("wolves -> wolf", candidatesFor("wolves"), "wolf");
contains("analyses -> analysis", candidatesFor("analyses"), "analysis");

// 11-16: -es / generic -s
contains("boxes -> box", candidatesFor("boxes"), "box");
contains("watches -> watch", candidatesFor("watches"), "watch");
contains("goes -> go", candidatesFor("goes"), "go");
contains("seeds -> seed", candidatesFor("seeds"), "seed");
contains("houses -> house", candidatesFor("houses"), "house");
contains("genies -> genie", candidatesFor("genies"), "genie");

// 17-21: verb -ing
contains("walking -> walk", candidatesFor("walking"), "walk");
contains("running -> run (doubling)", candidatesFor("running"), "run");
contains("making -> make", candidatesFor("making"), "make");
contains("typing -> type", candidatesFor("typing"), "type");
check("short -ing word untouched (sing)", candidatesFor("sing").includes("si"), false);

// 22-24: verb -ed
contains("walked -> walk", candidatesFor("walked"), "walk");
contains("stopped -> stop (doubling)", candidatesFor("stopped"), "stop");
contains("loved -> love", candidatesFor("loved"), "love");

// 25-27: possessives, phrases
contains("john's -> john", candidatesFor("john's"), "john");
contains("students' -> student", candidatesFor("students'"), "student");
contains("phrase varies last word (running shoes -> running shoe)", candidatesFor("running shoes"), "running shoe");

// ---- buildAiPrompt (6 cases)

const p1 = buildAiPrompt("cocoa", "I drink cocoa every morning.", false);
check("prompt quotes the word", p1.includes('"cocoa"'), true);
check("prompt says it is a word", p1.includes("the word"), true);
check("prompt includes context", p1.includes('Context from the page: "I drink cocoa every morning."'), true);
const p2 = buildAiPrompt("cocoa", "", false);
check("no context line when sentence empty", p2.includes("Context from the page"), false);
const p3 = buildAiPrompt("piece of cake", "That exam was a piece of cake.", true);
check("phrase prompt says phrase", p3.includes("the phrase") && p3.includes('"piece of cake"'), true);
check("prompt bans markdown", p1.includes("No markdown") && p1.includes("1. meaning"), true);

if (failed === 0) {
  console.log("ALL " + (passed + failed) + " PASSED");
} else {
  console.log(passed + " passed, " + failed + " FAILED");
  process.exit(1);
}
