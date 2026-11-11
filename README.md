# Oxford Popup

A minimal browser extension: select a word, click the floating button that
appears next to it, and see the word's definition from the
[Oxford Learner's Dictionary](https://www.oxfordlearnersdictionaries.com) in a
small popup — the same flow as Simple Translate, but with an English
definition instead of a translation.

Works in both Chrome and Firefox (Manifest V3).

## What the popup shows

- headword, part of speech, UK/US transcription
- CEFR level badge (A1–C2) for Oxford 3000/5000 words
- one-click UK/US pronunciation (the audio files come from Oxford's own
  entry pages — no third-party TTS)
- all senses of the first dictionary entry (numbered, with grammar labels
  like *[uncountable]*)
- a link to the full entry on oxfordlearnersdictionaries.com
- the popup always fits on screen: it flips above the word or clamps to
  the viewport edge (with its own scrollbar for long entries)
- if the word is not found — a link to an Oxford search
- phrases (2+ selected words) and words missing from Oxford are explained
  by Mistral AI, streamed into the same popup and marked with the Mistral
  badge (uses your own API key — see Settings)

Inflected forms are handled automatically: the original selection is tried
first (many inflections like *went* or *knives* have their own Oxford
entries), then likely base forms — plurals (*-s, -es, -ies, -ves, -ses*),
verb forms (*-ed, -ing*), and a few irregulars (*children → child*). For
phrases only the last word is varied (*cocoa beans → cocoa bean*).

The popup stays open while you scroll the page or the popup itself; close it
with a click outside or `Esc`.

## Settings

One optional setting: your personal
[Mistral API key](https://console.mistral.ai/api-keys) (La Plateforme,
free tier is enough). It enables the AI explanations — selected phrases
and words Oxford does not know. Open the extension's settings page, paste
the key, **Test key**, **Save**. The key is stored only in
`chrome.storage.local` in your browser and is sent only to
`api.mistral.com`. Without a key everything Oxford keeps working; AI
fallback simply degrades to the usual "no definition found" UI.

## Install

### Firefox (temporary, until the browser closes)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Pick `manifest.json` from this folder

For a permanent install, the extension must be signed via
[addons.mozilla.org](https://addons.mozilla.org/) (or self-distribution with
`web-ext sign`).

### Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Pick this folder

## How it works

```
selection → floating icon → click
  single word:
  → content.js asks background.js to fetch
      https://www.oxfordlearnersdictionaries.com/definition/english/<word>
  → background.js fetches the page (host_permissions bypass CORS),
    returns raw HTML
  → content.js parses it with DOMParser and renders the popup
  phrase (2+ words) or word missing from Oxford:
  → content.js opens a runtime port to background.js
  → background.js streams a Mistral chat completion
      (POST https://api.mistral.com/v1/chat/completions, stream:true,
       Bearer key from chrome.storage.local)
  → content.js renders the streamed chunks as the same numbered list
```

- `content.js` — selection handling, the floating icon, the popup, HTML
  parsing, streaming AI rendering
- `background.js` — fetching definition pages + a small in-memory cache,
  Mistral streaming over a runtime port
- `content.css` — popup styles
- `options.html` / `options.js` — the API-key settings page
- `make_icons.py` — regenerates the icons (optional, Python stdlib only)

## Permissions

- `host_permissions: https://www.oxfordlearnersdictionaries.com/*` and
  `https://api.mistral.com/*` — only these. The extension reads every page
  you select text on (any site) but sends data only to the Oxford dictionary
  domain and, for the AI fallback, to the Mistral API with your own key.
  The key itself stays in `chrome.storage.local`. No analytics.

## Maintenance

If Oxford changes their markup, fix the selectors in `parseEntry()` in
`content.js`:

| what | selector |
| --- | --- |
| entry | `div.entry` |
| headword | `h1.headword` |
| part of speech | `.webtop .pos` |
| UK/US transcription | `.phons_br .phon` / `.phons_n_am .phon` |
| senses list | `ol.senses_multiple, ol.sense_single` |
| sense | `li.sense` |
| grammar label | `.sensetop .grammar` |
| definition | `.def` |
