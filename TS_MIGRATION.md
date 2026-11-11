# S.A.G.E. — TypeScript Migration Spec (v1 → v2 internal refactor)

**Repo:** `wilden5/oxford-popup` (private).
**Feature branch:** `ts-migration` (agent creates from `main` on first action; merge to `main` only by the human after final acceptance).
**Current shipped version:** 1.1.5 (plain JS, no build step), commit `e796c38`.
**Goal:** migrate to strict, modern TypeScript (arrow functions, modules, NO classes) with a real build + test pipeline. **Zero behavior change** — the extension must look and behave byte-identically to v1.1.5.

## 1. Golden rules (apply to every milestone)

1. **No behavior change.** The Mistral prompt text, `temperature`, `max_tokens`, streaming protocol, `chrome.storage` keys (`mistralApiKey`), CSS classes, DOM structure of the popup, TTS logic (`speakText`/`stopSpeech`), audio logic, popup positioning, dismiss/blur logic — all stay EXACTLY as in v1.1.5 (commit `e796c38`).
2. **No new features.** Multi-provider, renaming, manifest version bumps are OUT OF SCOPE.
3. Style: strict TS, `const` + arrow functions + plain modules. **No classes, no OOP ceremony, no `this`.**
4. Keep comments that explain *why* (popup survives blur/scroll rationale, voice fallback rationale, etc.).
5. One milestone = one focused set of commits. Do not mix milestones.

## 2. Hard platform constraint

Firefox loads the background as an event page and **does not support ES modules** — build outputs must be plain scripts, not ESM. The content script must remain an IIFE (no leaked globals).

## 3. Target repo layout

```
oxford-popup/
├─ src/
│  ├─ shared/
│  │  └─ types.ts              # message protocol, dict entry, ai item types
│  ├─ background/
│  │  ├─ inflect.ts            # candidatesFor, inflectCandidates, IRREGULAR (pure)
│  │  ├─ lookup.ts             # lookup, definitionUrl, cache (pure logic part)
│  │  ├─ ai-prompt.ts          # buildAiPrompt (pure)
│  │  ├─ stream-mistral.ts     # streamMistral, error parsing (pure fetch part)
│  │  └─ main.ts               # ALL chrome.* wiring (service worker entry)
│  ├─ content/
│  │  ├─ dom.ts                # el, clearChildren, isOurUi helpers
│  │  ├─ normalize.ts          # normalize, sentenceContext (pure string logic)
│  │  ├─ parser.ts             # parseEntry(html): DOMParser-based, pure of chrome.*
│  │  ├─ parse-ai-items.ts     # parseAiItems (pure; was between ai-items markers)
│  │  ├─ audio.ts              # playAudio/stopAudio
│  │  ├─ tts.ts                # speakText/stopSpeech (speechSynthesis)
│  │  ├─ popup.ts              # renderPopup, placePopup, build* renderers
│  │  └─ main.ts               # selection/icon/dismiss wiring (IIFE entry)
│  ├─ options/
│  │  └─ main.ts               # current options.js logic
│  └─ content.css              # unchanged, copied as-is
├─ options.html                 # unchanged, copied as-is
├─ manifest.json                # unchanged in this migration (still "Oxford Popup", v1.1.5)
├─ tests/
│  ├─ inflect.spec.ts
│  ├─ ai-prompt.spec.ts
│  ├─ parse-ai-items.spec.ts
│  ├─ parser.spec.ts
│  └─ fixtures/                 # saved Oxford HTML pages — committed (regression suite)
├─ scripts/
│  ├─ fetch-fixtures.mjs        # re-download Oxford fixture pages
│  ├─ live-check.mjs            # moved from old location, adapted paths
│  └─ build.mjs                 # typecheck -> bundle -> copy static -> zip
├─ package.json  tsconfig.json  vitest.config.ts  .gitignore
└─ .github/workflows/tests.yml  # updated in M1 and finalized in M5
```

## 4. Toolchain (fixed decisions — do not substitute)

- **TypeScript** `strict: true`, `target: ES2022`, `lib: ["ES2022", "DOM"]`, `types: ["chrome"]` (`@types/chrome` dev dep), `noUncheckedIndexedAccess: true`.
- **esbuild** — three bundles, entries `src/background/main.ts`, `src/content/main.ts`, `src/options/main.ts` (see §3 for M1 names): all format `iife`, `minify: false` (reviewability > size).
- **vitest** + **happy-dom** (`happy-dom` provides `DOMParser` for `parser.spec.ts` fixture tests).
- **Node ≥ 22** scripts only; no other runtime deps.
- `scripts/build.mjs` (uses the esbuild JS API; zips via the system `zip` CLI through `child_process`): `tsc --noEmit` → esbuild bundles to `dist/` → copy `manifest.json`, `content.css`, `options.html`, `README.md`, `icons/` into `dist/` → zip ONLY the `dist` contents at zip root (same layout as the shipped v1.1.5 zip: no tests, no scripts, no `.github`, no `src`) into `dist/oxford-popup-ts.zip`.
- `.gitignore`: `dist/`, `node_modules/`, `*.zip`.

## 5. Milestones

### M1 — Toolchain + build skeleton (no TS conversion yet)
- Move current JS into `src/**` as-is (still plain JS, `allowJs` temporarily true).
- `package.json`, `tsconfig.json`, `scripts/build.mjs`, `.gitignore` per §4.
- Update `.github/workflows/tests.yml`: `npm ci` → build → run unit tests → `live-check.mjs`.
- Acceptance: build produces a zip that loads and works in Chrome and Firefox (human browser checkpoint); no visual/behavioral diff; reviewer's local runs green.

### M2 — Convert to strict TypeScript + module split
- Convert per §3; delete the `// ---- extension wiring` and `/* ai-items-start/end */` markers — module boundaries replace them.
- `src/shared/types.ts` must type the full message protocol exactly as it behaves today: `oxford-lookup` request/response (`{ok, error, html?, url, word}`), port `oxford-ai` messages `{type:"chunk"|"done"|"no-key"|"error", text?, message?}`, `oxford-open-options` message, `DictEntry` (headword, pos, phonBr, phonUs, audioUk, audioUs, level, levelList, senses), `ParsedAiItem {meaning, example}`.
- Pure modules (inflect, prompt, parse-ai-items, normalize, parser, lookup logic) must not import or reference `chrome.*`.
- Acceptance: `tsc --noEmit` clean under strict; reviewer's test runs green; manual parity.

### M3 — Port unit tests to vitest
- `inflect.spec.ts` + `ai-prompt.spec.ts`: port ALL 33 checks from `test_inflect.js` (27 inflection + 6 prompt).
- `parse-ai-items.spec.ts`: port ALL 10 checks from `test_ai_parse.js`.
- Acceptance: same case counts green in vitest; old `test_*.js` files deleted.

### M4 — Oxford parser fixture tests (the big value add)
- `scripts/fetch-fixtures.mjs`: save full HTML of `cocoa`, `house`, `walk` Oxford pages into `tests/fixtures/` (browser UA; commit them — they ARE the regression suite).
- `parser.spec.ts` with happy-dom: per fixture assert headword, pos, phonBr/phonUs, `audioUk`/`audioUs` end with `.mp3` on the Oxford media host, senses count > 0, first sense grammar+def non-empty; CEFR: `house` and `walk` have level + correct levelList (`Oxford 3000`/`Oxford 5000`), `cocoa` has empty level.
- Negative test: garbage HTML → `parseEntry` returns null.
- Acceptance: `vitest run` green OFFLINE; `live-check.mjs` stays as the online canary.

### M5 — Polish, CI final, merge prep
- README: add Build (`npm ci && npm run build`), Test (`npm test`), Project structure sections.
- Final zip from clean `dist`; human runs the browser parity checklist; merge `ts-migration` → `main` only after sign-off.
- Acceptance: CI green on branch; parity checklist passed; merge (by the human).

## 6. Browser parity checklist (human, after M1 and again after M5)

1. Oxford word (e.g. "house"): popup with phonetics, 🔊 BrE/NAmE MP3 buttons, CEFR badge, definitions.
2. Inflected form ("knives"): resolves to entry.
3. Phrase ("piece of cake"): straight to Mistral, streaming list, TTS 🔊 BrE/NAmE buttons speak.
4. Unknown single word: Oxford not-found → AI fallback.
5. No API key in a fresh profile: Oxford-only works; phrase shows "Open settings".
6. Options page: Save key, Test key, Grant access (Firefox), status line.
7. Popup survives tab switch (v1.1.3) and scroll; icon follows selection (v1.0.5); example on its own line in AI list (v1.1.4).
8. Firefox `about:debugging`: temporary add-on loads; Grant access re-granted after reload.

## 7. Explicitly out of scope (do NOT do)

- Multi-provider registry (next project after this).
- Renaming to S.A.G.E. (separate step right before publication: manifest `name`, Gecko id, README, repo name — coordinated with the owner).
- Any CSS, prompt, or UX changes.
- Manifest version bump (stays 1.1.5 until the rename/pre-publish step).

## 8. Process rules (binding for the coding agent)

1. This spec (`TS_MIGRATION.md` on `main`) is the single source of truth. Work ONLY from it and from the round prompt. On any contradiction: STOP and put the question in the report — do not improvise.
2. FRESH CHAT: you have no memory of past sessions. Your only inputs: this repo, this spec, the round prompt, and review notes quoted in it.
3. One point = one commit. Commit messages in English, prefixed `<MILESTONE>.<ROUND>: <message>` (e.g. `M1.1: add esbuild-based build script`). No empty commits.
4. Branching: work ONLY in `ts-migration`. If it does not exist: create from `origin/main` as your FIRST action. If it exists: start with `git pull --rebase origin ts-migration`. NEVER push to `main`, never merge, never rebase onto other branches, never force-push, never rewrite history, never tag. Merge to `main` is done only by the human after acceptance.
5. You do NOT run tests, builds, installs, or any verification commands (no `npm install`, no `vitest`, no `node`, no build runs). Verification is done by the reviewer outside. Any claim in your report that tests/builds pass = autoblocker. Do NOT create or modify `package-lock.json`.
6. ANTI-PHANTOM-WORK RULE: your report MUST end with the literal output of `git log --oneline origin/main..HEAD`. Every commit you claim must appear there. Claiming work that is not in the repo = autoblocker.
7. Out-of-scope ideas (improvements, refactors beyond this spec) go to the report as "Out-of-scope notes", never into code.
8. Everything agent-facing — commits, code comments, report text — in English.
9. Reports are posted in the chat as your final message (not committed to the repo).
