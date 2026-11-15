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
- **Phrase read-aloud.** Phrase explanations can be read aloud with the
  browser's built-in text-to-speech. The extension itself sends nothing:
  the phrase is passed to the browser, which uses the voices installed on
  your system (your browser's own privacy policy applies to any voice it
  provides).
- **Nothing else.** The extension does not read, store or transmit page
  content beyond the text you explicitly selected.

## What is stored, and where

- Your provider choice, model preferences and API keys are stored only in
  the browser's local extension storage (`chrome.storage.local`).
- Keys are sent only to the provider whose key they are, over HTTPS, only
  when that provider is used. They are never included in any other request.
- **Word tracker.** Meeting counters for the words you look up (with the
  first definition found) and your ready threshold are stored only in
  `chrome.storage.local`; they never leave your browser and can be removed
  on the settings page.
- **Cards to learn.** Saved words and phrases — with their definitions and
  the sentence context around them — are stored only in
  `chrome.storage.local`; they never leave your browser.
- The extension keeps no history of your lookups beyond these word tracker
  counters.

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
