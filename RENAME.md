# RENAME.md — S.A.G.E. rebrand before store submission

Decisions fixed by the owner (Denis, 2026-11-13). This spec is the source of
truth for the rename round (R1), same standing as TS_MIGRATION.md and
MULTI_PROVIDER.md. Scope: branding only, done before the first store
submission (AMO first; CWS is blocked by payment region for now, Edge
Add-ons is a free extra target).

## §1 Goal and ground rules

- The old name is a trademark risk in store review (Oxford = OUP brand).
- ZERO behavior change: no logic, no CSS, no user-facing dictionary texts,
  no message protocol, no tests, no fixtures.
- One task = one commit, prefix `R1.<n>:`. Push ONLY `git push origin rename:rename`.
- The GitHub repo itself is renamed separately by the owner (oxford-popup →
  sage). GitHub redirects old URLs and git remotes, so either name works;
  prefer `sage`.

## §2 Fixed new values — do not deviate

| Where | Old | New |
| --- | --- | --- |
| manifest.json → name | Oxford Popup | S.A.G.E. – Select And Get Explanation |
| manifest.json → version | 1.2.0 | 1.3.0 |
| manifest.json → browser_specific_settings.gecko.id | oxford-popup@denis | sage@wilden5 |
| manifest.json → description | unchanged | unchanged (factual data-source mention stays) |
| package.json → name | oxford-popup | sage |
| package.json → version | 1.1.5 | 1.3.0 (sync — it was stale) |
| package.json → description | Oxford Popup | S.A.G.E. |
| make_icons.py → module docstring, first line | Generate Oxford Popup icons … | Generate S.A.G.E. icons … (rest of the docstring unchanged) |
| options.html → \<title\> | Oxford Popup — Settings | S.A.G.E. — Settings |
| options.html → \<h1\> | Oxford Popup | S.A.G.E. |
| scripts/build.mjs → header comment + zipPath | oxford-popup-ts.zip / "Build script for Oxford Popup (TypeScript migration)." | sage.zip / "Build script for S.A.G.E. (TypeScript)." |
| .github/workflows/tests.yml → upload-artifact name + path | oxford-popup-ts, dist/oxford-popup-ts.zip | sage, dist/sage.zip |
| README.md → h1 | # Oxford Popup | # S.A.G.E. – Select And Get Explanation |

Dash note: the long form uses the EN DASH exactly as written:
`S.A.G.E. – Select And Get Explanation`.

Gecko id fallback (only if AMO ever reports `sage@wilden5` as taken):
`sage-extension@wilden5` — owner decision 2026-11-13. Not part of R1.

## §3 Whitelist — "oxford" strings that MUST stay (functional, not branding)

- `https://www.oxfordlearnersdictionaries.com/*` everywhere: manifest
  host_permissions, src/*, scripts/live-check.js, tests/fixtures/, README links.
- User-facing dictionary texts: "Full entry on Oxford", "Search on Oxford",
  "Show Oxford definition", the "Oxford-only" phrase in the options.html hint.
- "Oxford 3000/5000" CEFR badge naming.
- Internal message protocol: `oxford-lookup`, `oxford-test-key`,
  `oxford-open-options`, the `oxford-ai` port, and TS type names
  (OxfordLookupRequest etc.).
- icons/: no changes (binaries stay; the generator script only gets its
  docstring first line updated).

## §4 Tasks (branch `rename`, one task = one commit)

- **R1.1** manifest.json — exactly three values: name, version, gecko.id.
- **R1.2** package.json (name, version, description) + make_icons.py
  (docstring first line only).
- **R1.3** options.html — \<title\> and \<h1\> only (the hint paragraph that
  mentions "Oxford-only" stays byte-identical).
- **R1.4** scripts/build.mjs + .github/workflows/tests.yml in ONE commit
  (zip name and artifact path must move in lockstep, or the CI artifact
  upload step breaks on the intermediate commit): `sage.zip` everywhere,
  artifact name `sage`. Do NOT touch the trigger/branch list (the `rename`
  trigger is already there).
- **R1.5** README.md — branding spots only:
  - h1 → the long form from §2;
  - `about:addons → Oxford Popup → «Разрешения и данные»` →
    `about:addons → S.A.G.E. → «Разрешения и данные»`;
  - project tree root `oxford-popup/` → `sage/`;
  - Development section: `dist/oxford-popup-ts.zip` → `dist/sage.zip`;
  - CI section: both `oxford-popup-ts` artifact mentions → `sage`, and the
    stale phrase "runs on every push to `main` and `byok`" → "runs on every
    push to `main` and the active round branches".
  Everything else in README (dictionary flow, AI, permissions, selector
  table, gotchas) stays byte-identical.

## §5 Verification (reviewer)

- CI green on `rename`: build, 88 unit tests, live-check, artifact upload `sage`.
- After R1: `grep -rni "oxford-popup" --exclude-dir=.git .` → 0 matches and
  `grep -rn "Oxford Popup" --exclude-dir=.git .` → 0 matches. All remaining
  "oxford" strings must belong to §3.
- No file under src/, tests/, or scripts/live-check.js changed.

## §6 Process rules (unchanged from previous phases)

Fresh chat per round; the agent never pushes to main, never merges, rebases
or tags; push only by the explicit refspec `git push origin rename:rename`;
commit messages in English with the R1.<n> prefix; escape sequences are
written as escapes (a raw newline inside a string literal is an autoblock);
the report ends with the literal output of `git log --oneline origin/main..HEAD`;
claims about work not present in that log are an autoblock; out-of-scope
ideas go in the report, not the code.

## §7 Human steps (Denis — outside the agent round)

1. Rename the GitHub repo `oxford-popup` → `sage` (Settings → Rename; old
   links and git remotes keep working via redirect). Locally:
   `git remote set-url origin git@github.com:wilden5/sage.git`.
2. After review sign-off: merge `rename` → main manually
   (`git merge --no-ff rename`) — as always, only Denis's hands.
3. The store-submission plan (AMO first, Edge Add-ons as a free extra, CWS
   blocked by payment region) is tracked in Knowledge, not here.
