# PUBLISH_PREP.md — store preparation round (R2)

Owner decisions (2026-11-13): **MIT license**; the repo goes **public at
publication time**; the privacy policy (required by AMO and CWS) is hosted
as PRIVACY.md in this repo. Docs-only round: LICENSE + PRIVACY.md + a
README refresh. ZERO code changes.

## §1 Ground rules

- No changes to src/, tests/, scripts/, manifest.json, options.html,
  content.css, build.mjs, or any workflow file. Only the three files named
  below.
- One task = one commit, prefix `R2.<n>:`.
  Push ONLY `git push origin publish-prep:publish-prep`.
- LICENSE and PRIVACY.md content is taken from this spec VERBATIM — the
  reviewer diffs them byte-for-byte against §2/§3. Do not paraphrase.

## §2 R2.1 — LICENSE (new file, repo root)

Exactly this text, no more, no less:

```
MIT License

Copyright (c) 2026 Denis Ivanchenko

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## §3 R2.2 — PRIVACY.md (new file, repo root)

Exactly this content:

```markdown
# Sage Pop-Up — Privacy Policy

Sage Pop-Up shows dictionary definitions and AI explanations for text you
select. This page explains what data the extension handles. In short: the
extension has no accounts, no analytics and no servers of its own — the only
data that leaves your browser is the text you ask about, sent to the sites
named below.

## What leaves your browser

- **Single-word lookups.** The word you selected is sent to
  `https://www.oxfordlearnersdictionaries.com` to fetch the definition page —
  the same request your browser makes when you look the word up on that site
  yourself.
- **AI explanations** (phrases, or words missing from the dictionary). The
  selected text plus a short snippet of the surrounding sentence (about 330
  characters) is streamed to the AI provider you selected in Settings —
  Mistral, OpenAI, Groq, OpenRouter, DeepSeek, xAI, Anthropic or Google
  Gemini — using **your own API key**. That request is authenticated with
  your key, and the provider's own privacy policy applies to it.
- **Nothing else.** The extension does not read, store or transmit page
  content beyond the text you explicitly selected.

## What is stored, and where

- Your provider choice, model preferences and API keys are stored only in
  the browser's local extension storage (`chrome.storage.local`).
- Keys are sent only to the provider whose key they are, over HTTPS, only
  when that provider is used. They are never included in any other request.
- The extension keeps no history of your lookups.

## Permissions

- The content script runs on all sites so the popup can appear next to any
  selection; it processes only the text you select.
- The Oxford dictionary host permission is used for lookups. Each AI
  provider origin is an **optional** permission that you grant explicitly
  from the settings page.

## Third parties

- Oxford Learner's Dictionaries (Oxford University Press) — receives the
  word you looked up, as any visit to their website would.
- The AI provider you selected — receives the selected text and its
  sentence context, with your own API key.

## Changes

This policy is updated when the extension changes; the current version is
always kept in this repository.

## Contact

Open an issue in the project's GitHub repository.
```

## §4 R2.3 — README.md (exact edit list; everything else byte-identical)

1. **Development section:** "(the zip
   contains ONLY the `dist` contents at the zip root — the same layout as
   the shipped v1.1.5)." → replace the tail so it reads
   "— the same layout as every shipped version)."
2. **Settings section:** "The default provider is Mistral, so existing
   v1.1.5 users keep working unchanged: a previously saved Mistral key is
   migrated read-only and keeps working as-is, with zero behavior change."
   → "The default provider is Mistral, so keys saved by earlier versions
   keep working unchanged: a previously saved Mistral key is migrated
   read-only and keeps working as-is, with zero behavior change."
3. **Project structure tree:** the line
   `├─ content.css  options.html  manifest.json  icons/` →
   `├─ content.css  options.html  manifest.json  make_icons.py  icons/`;
   the last line
   `└─ package.json  tsconfig.json  vitest.config.ts` →
   `└─ package.json  tsconfig.json  vitest.config.ts  LICENSE  PRIVACY.md`.
4. **Two new sections at the very end of the file** (after the CI section
   and the "One gotcha" paragraph):

```markdown
## License

MIT — see [LICENSE](LICENSE).

## Privacy

See [PRIVACY.md](PRIVACY.md): no accounts, no analytics, no servers — the
selected text goes only to the Oxford dictionary site and, for AI
explanations, to the provider you pick with your own key.
```

## §5 Verification (reviewer)

- CI green on `publish-prep` (docs-only, must not be able to break it).
- Only LICENSE, PRIVACY.md, README.md changed; LICENSE and PRIVACY.md match
  §2/§3 byte-for-byte; README differs only in the four zones of §4.

## §6 Process rules (unchanged from previous phases)

Fresh chat per round; the agent never pushes to main, never merges, rebases
or tags; push only by the explicit refspec; commit messages in English with
the R2.<n> prefix; escape sequences are written as escapes (a raw newline
inside a string literal is an autoblock); the report ends with the literal
output of `git log --oneline origin/main..HEAD`; claims about work not
present in that log are an autoblock; out-of-scope ideas go in the report,
not the code.

## §7 Human steps (Denis — outside the agent round)

1. Record screenshots (1280×800) for the store listings and README — they
   are also needed for R3; binaries are uploaded manually via the GitHub
   web UI.
2. Flip the repo to public at publication time (R4); the AMO/CWS privacy
   policy URLs then point at PRIVACY.md here.
