const fs = require("fs");
let src = fs.readFileSync("background.js", "utf8");
src = src.split("// ---- extension wiring")[0]; // pure logic only, no chrome.*
eval(src + "; globalThis.candidatesFor = candidatesFor; globalThis.buildAiPrompt = buildAiPrompt;");

const cases = [
  ["seeds", ["seeds", "seed"]],
  ["cities", ["cities", "city", "citie"]],
  ["knives", ["knives", "knife", "knif", "knive"]],
  ["boxes", ["boxes", "box", "boxe"]],
  ["watches", ["watches", "watch", "watche"]],
  ["goes", ["goes", "go", "goe"]],
  ["potatoes", ["potatoes", "potato", "potatoe"]],
  ["children", ["children", "child"]],
  ["women", ["women", "woman"]],
  ["hid", ["hid", "hide"]],
  ["stopped", ["stopped", "stopp", "stop", "stoppe"]],
  ["loved", ["loved", "lov", "love"]],
  ["hoped", ["hoped", "hop", "hope"]],
  ["running", ["running", "runn", "run", "runne"]],
  ["making", ["making", "mak", "make"]],
  ["houses", ["houses", "hous", "housis", "house"]],
  ["analyses", ["analyses", "analys", "analysis", "analyse"]],
  ["crises", ["crises", "cris", "crisis", "crise"]],
  ["buses", ["buses", "bus", "busis", "buse"]],
  ["cocoa beans", ["cocoa beans", "cocoa bean"]],
  ["seed's", ["seed", "see"]],
  ["bosses", ["bosses", "boss", "bosse"]],
  ["genies", ["genies", "geny", "genie"]],
  ["leaves", ["leaves", "leafe", "leaf", "leave"]],
  ["shoes", ["shoes", "sho", "shoe"]],
  ["bus", ["bus"]],
  ["went", ["went"]],
];
let fails = 0;
for (const [input, expected] of cases) {
  const got = candidatesFor(input);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) { fails++; console.log("FAIL", input, "\n  got:", JSON.stringify(got), "\n  exp:", JSON.stringify(expected)); }
  else console.log("ok  ", input.padEnd(12), "->", JSON.stringify(got));
}

// buildAiPrompt: strict answer format the streaming renderer relies on.
const pPhrase = buildAiPrompt("cocoa beans", "I like hot cocoa beans.", true);
const pWord = buildAiPrompt("flour", "", false);
const promptChecks = [
  [pPhrase.includes('"cocoa beans"'), "prompt quotes the phrase"],
  [/phrase/.test(pPhrase), "prompt says phrase for multi-word"],
  [/word/.test(pWord) && pWord.includes("flour"), "prompt says word for single"],
  [pPhrase.includes("I like hot cocoa beans."), "prompt includes context sentence"],
  [!pWord.includes("Context from the page"), "prompt omits context when absent"],
  [/1\. meaning — example sentence/.test(pPhrase) && /No markdown/.test(pPhrase), "prompt demands numbered format, no markdown"],
];
for (const [ok, label] of promptChecks) {
  if (!ok) { fails++; console.log("FAIL prompt:", label); }
  else console.log("ok   prompt:", label);
}

console.log(fails ? fails + " FAILURES" : "ALL " + (cases.length + promptChecks.length) + " PASSED");
process.exit(fails ? 1 : 0);
