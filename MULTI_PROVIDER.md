# S.A.G.E. (oxford-popup) — Multi-Provider BYOK Spec (v1.1.5 → v1.2.0)

Branch: **byok** (created from main). This file on main is the single
source of truth. The TypeScript migration (TS_MIGRATION.md) is COMPLETE
and merged; its process rules (§8 there) stay binding here.

Goal: the AI fallback works with the user's own API key (BYOK) for 8
providers, with zero behavior change for existing Mistral users.

## 1. Golden rules (every milestone)

- ZERO behavior change on the default path: a user who never opens
  settings keeps getting Mistral exactly as in v1.1.5 — same prompt,
  same streaming port protocol, same popup.
- BYOK only: keys live in `chrome.storage.local`, sent only to the
  selected provider's endpoint over HTTPS. No server, no analytics.
- The UI stays minimal: provider dropdown, one key field, one model
  field, Save / Test key / Grant access. No provider-specific extras.
- Model ids are NEVER hardcoded in logic. The registry holds only
  *suggested* defaults; the model field is free text. Suggestions are
  best-known 2026-11-12 and may be stale — the user can type any model.
- Reasoning/thinking output NEVER renders in the popup: adapters
  extract only whitelisted text deltas, everything else is ignored.
- Process (binding): fresh chat per round; one point = one commit,
  prefix `B<round>: ` (e.g. `B1.1: `); agent never touches main, never
  merges/rebases/force-pushes/tags; push ONLY with the explicit
  refspec `git push origin byok:byok` (never bare); agent runs no
  installs/builds/tests (claims of passing = autoblocker); report ends
  with the literal output of `git log --oneline origin/main..byok`;
  out-of-scope ideas go to the report, never code.

## 2. Provider registry (fixed MVP set; lives in src/shared/providers.ts)

| id | label | chat endpoint | auth | stream protocol | suggested model | optional host origin |
| --- | --- | --- | --- | --- | --- | --- |
| mistral | Mistral | https://api.mistral.ai/v1/chat/completions | Bearer | OpenAI SSE | mistral-small-latest | https://api.mistral.ai/* |
| openai | OpenAI | https://api.openai.com/v1/chat/completions | Bearer | OpenAI SSE | gpt-5-mini | https://api.openai.com/* |
| groq | Groq | https://api.groq.com/openai/v1/chat/completions | Bearer | OpenAI SSE | llama-3.3-70b-versatile | https://api.groq.com/* |
| openrouter | OpenRouter | https://openrouter.ai/api/v1/chat/completions | Bearer | OpenAI SSE | meta-llama/llama-3.3-70b-instruct:free | https://openrouter.ai/* |
| deepseek | DeepSeek | https://api.deepseek.com/chat/completions | Bearer | OpenAI SSE | deepseek-v4-flash | https://api.deepseek.com/* |
| xai | xAI | https://api.x.ai/v1/chat/completions | Bearer | OpenAI SSE | grok-4.7 | https://api.x.ai/* |
| anthropic | Anthropic | https://api.anthropic.com/v1/messages | x-api-key + anthropic-version: 2023-06-01 | Anthropic SSE | claude-haiku-5-5 | https://api.anthropic.com/* |
| gemini | Google Gemini | https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse | x-goog-api-key header | Gemini SSE | gemini-3.8-flash | https://generativelanguage.googleapis.com/* |

Notes:
- Endpoints and origins were verified live (2026-11-11: every endpoint
  answers 401/400 with the provider's JSON error, never a network
  error). DeepSeek's base path has NO /v1. The registry is extensible:
  future providers = new rows (+ optional new adapter kinds).
- Copilot API is EXCLUDED (owner's decision: it requires a paid Copilot
  subscription from the end user).
- Test-key endpoints (cheap authenticated GET, 200 = key works,
  401/403 = key rejected, anything else = show the provider's error
  message the way v1.1.2 does):
  - mistral: GET https://api.mistral.ai/v1/models
  - openai: GET https://api.openai.com/v1/models
  - groq: GET https://api.groq.com/openai/v1/models
  - openrouter: GET https://openrouter.ai/api/v1/models
  - deepseek: GET https://api.deepseek.com/models
  - xai: GET https://api.x.ai/v1/models
  - anthropic: GET https://api.anthropic.com/v1/models
    (x-api-key + anthropic-version headers)
  - gemini: GET https://generativelanguage.googleapis.com/v1beta/models
    (x-goog-api-key header)

## 3. Storage schema (chrome.storage.local)

- `aiProvider`: string — selected provider id; default `"mistral"`.
- `aiKeys`: object `{ [providerId]: string }` — per-provider keys.
  One-time migration: if `aiKeys` is unset and the legacy
  `mistralApiKey` exists, treat `aiKeys.mistral = mistralApiKey`
  (keep the legacy key in place, do not delete it).
- `aiModels`: object `{ [providerId]: string }` — absent entry = the
  registry suggestion for that provider.
- Reading settings happens through pure helpers in
  `src/shared/providers.ts` that take a plain storage snapshot object
  (NO chrome.* import — background, options and vitest share them).

## 4. Background: provider dispatch (contract unchanged)

- The `oxford-ai` port protocol ({type: chunk|done|no-key|error}) and
  `buildAiPrompt` (same "N. meaning — example" format, temperature 0.2,
  ~400 max tokens) are UNCHANGED. Token caps map per protocol: OpenAI
  body `max_tokens`; Anthropic body `max_tokens`; Gemini
  `generationConfig.maxOutputTokens`.
- `src/background/stream-mistral.ts` becomes the generic
  OpenAI-compatible streamer `src/background/stream-openai.ts`
  (mistral/openai/groq/openrouter/deepseek/xai): Bearer auth, body
  `{model, messages, stream: true, temperature, max_tokens}`; SSE lines
  `data: ...` + `[DONE]`; extract `delta.content` ONLY —
  `delta.reasoning_content` (DeepSeek), `delta.reasoning` and every
  other delta field are ignored, never rendered.
- New `src/background/stream-anthropic.ts`: headers `x-api-key` +
  `anthropic-version: 2023-06-01`; body `{model, max_tokens,
  temperature, stream: true, messages: [{role: "user", content:
  prompt}]}`; emit text ONLY from `content_block_delta` events where
  `delta.type === "text_delta"` (thinking_delta and everything else
  ignored); done on `message_stop`.
- New `src/background/stream-gemini.ts`: header `x-goog-api-key`; body
  `{contents: [{role: "user", parts: [{text: prompt}]}],
  generationConfig: {temperature, maxOutputTokens}}`; SSE `data:`
  chunks — emit `candidates[0].content.parts[*].text` joined; done on
  stream end (finishReason present on the last chunk).
- `src/background/main.ts` wiring: read aiProvider/aiKeys/aiModels,
  no key for the selected provider → "no-key" exactly as today;
  dispatch by the registry's adapter kind.
- SSE parsing is extracted into pure functions (one per protocol) so
  it is unit-testable offline.

## 5. Options page (minimal)

- Provider `<select>` with the 8 labels. On change: key/model inputs
  load that provider's stored values; the permission status + Grant
  access section re-checks the provider's origin.
- Fields: API key (password) + Save + Test key; Model (text) + Save,
  placeholder shows the registry suggestion when unset. Save writes
  `aiKeys[id]` / `aiModels[id]` and `aiProvider`.
- Test key hits the registry's models GET; the permission check runs
  first, exactly the v1.1.1/v1.1.2 Grant-access flow (permCall
  wrapper, optional_host_permissions).
- Manifest (milestone B4): `optional_host_permissions` = the 8
  provider origins (api.mistral.ai stays; never duplicate an origin
  between host_permissions and optional_host_permissions);
  `host_permissions` keeps ONLY Oxford. Version → 1.2.0 in B4.

## 6. Badge

The AI badge keeps the official Mistral logo for the mistral provider.
For other providers the same badge slot shows the provider label text
(tooltip "Explained by <label>"). No new logo assets in this phase.

## 7. Tests (vitest, offline, no network)

- Registry: exactly 8 rows; unique ids/origins/endpoints; endpoints
  byte-match §2 (DeepSeek WITHOUT /v1); suggested models non-empty;
  mistral is the default.
- Storage helpers: defaults; aiKeys/aiModels fallback to suggestions;
  legacy mistralApiKey migration; empty snapshot tolerated.
- SSE parsers against committed fixture strings
  (tests/fixtures/sse/, hand-written minimal strings, not real
  traffic): OpenAI-style (content delta emitted; reasoning_content
  ignored; [DONE] ends); Anthropic (message_start; text_delta emitted;
  thinking_delta ignored; message_stop ends); Gemini (text parts
  joined and emitted; finishReason chunk ends).
- The existing 57 checks stay green throughout (no edits to them).

## 8. Milestones

- B1: shared registry + storage helpers + types + tests (pure, no
  chrome).
- B2: background — generic OpenAI-compatible streamer + dispatch +
  SSE parser tests. Mistral now goes through the adapter: the port
  protocol and the prompt must stay identical.
- B3: Anthropic + Gemini adapters + their SSE parser tests.
- B4: options UI + storage migration + manifest origins + version
  1.2.0.
- B5: README + CI final + browser parity checklist (Denis; per
  provider, at minimum the UI states — and real-key checks wherever
  Denis has keys) + merge to main by Denis after sign-off.

## 9. Out of scope (do NOT do)

Copilot API; provider-specific extra parameters (reasoning_effort
toggles); per-site provider switching; the word tracker; renaming to
S.A.G.E.; store publication; new logo assets; changing the AI prompt
format; CSS redesign.
