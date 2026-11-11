const fs = require("fs");
let src = fs.readFileSync("content.js", "utf8");
const start = src.indexOf("/* ai-items-start");
const end = src.indexOf("/* ai-items-end");
if (start < 0 || end < 0) { console.log("FAIL: markers not found"); process.exit(1); }
eval(src.slice(start, end) + "; globalThis.parseAiItems = parseAiItems;");

const cases = [
  // [input, expected [{meaning, example}]]
  ["1. a seed — I planted a seed in the garden.",
    [{ meaning: "a seed", example: "I planted a seed in the garden." }]],
  ["1. a seed — I planted a seed in the garden.\n2. the beginning of something — The idea was a seed of change.",
    [{ meaning: "a seed", example: "I planted a seed in the garden." },
     { meaning: "the beginning of something", example: "The idea was a seed of change." }]],
  ["1) small hard part of a plant — Birds eat seeds.",
    [{ meaning: "small hard part of a plant", example: "Birds eat seeds." }]],
  ["1. meaning with no example",
    [{ meaning: "meaning with no example", example: "" }]],
  ["Sure! Here are the meanings:\n1. one who runs — She runs fast.",
    [{ meaning: "one who runs", example: "She runs fast." }]],
  ["1. quoted example — \"He gave a quote.\"",
    [{ meaning: "quoted example", example: "He gave a quote." }]],
  ["just a plain line without numbering",
    [{ meaning: "just a plain line without numbering", example: "" }]],
  ["1. item one — Example one.\n2. item two — Example two.\n3. item three — Example three.\n4. item four — Example four.\n5. item five — Example five.",
    [{ meaning: "item one", example: "Example one." },
     { meaning: "item two", example: "Example two." },
     { meaning: "item three", example: "Example three." },
     { meaning: "item four", example: "Example four." }]],
  ["", []],
];
let fails = 0;
for (const [input, expected] of cases) {
  const got = parseAiItems(input);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) { fails++; console.log("FAIL", JSON.stringify(input), "\n  got:", JSON.stringify(got), "\n  exp:", JSON.stringify(expected)); }
  else console.log("ok  ", JSON.stringify(input.slice(0, 40)));
}
console.log(fails ? fails + " FAILURES" : "ALL " + cases.length + " PASSED");
process.exit(fails ? 1 : 0);
