/**
 * Popup rendering + lookup/AI flow.
 *
 * Owns the popup node itself: it is shared with main.ts (hidePopup /
 * isOurUi / the scroll listener), so it lives in a plain mutable holder
 * object — an exported `let` cannot be reassigned from an importing module.
 * anchorX/anchorY/aiPort/aiWord are only touched here and stay module-local.
 */

import { el, clearChildren } from "./dom";
import { parseEntry } from "./parser";
import type { DictEntry } from "./parser";
import { parseAiItems } from "./parse-ai-items";
import { playAudio } from "./audio";
import { speakText } from "./tts";
import { hidePopup, SPEAKER_SVG, MISTRAL_SVG, SEARCH_URL } from "./main";
import type { AiPortMessage, OxfordLookupResponse, StorageSnapshot } from "../shared/types";
import { providerById, selectedProvider } from "../shared/providers";
import { recordMeeting } from "../tracker/counter";
import { meetingIndicator } from "../tracker/indicator";
import { readTracker, readTrackerSettings, saveWord, unsaveWord } from "../tracker/storage";
import type { WordEntry } from "../tracker/model";
import { deletePhrase, readPhraseCollection, savePhrase } from "../collection/storage";
import { normalizePhrase } from "../collection/model";

/** The open popup element (null while no popup is shown) plus the sentence
 *  context captured for the current lookup (stored when the popup opens). */
export const popupState: { node: HTMLDivElement | null; sentence: string } = { node: null, sentence: "" };

let anchorX = 40;
let anchorY = 40; // viewport point below the word the popup is anchored to
let aiPort: chrome.runtime.Port | null = null; // runtime port streaming the AI answer
let aiWord = ""; // word/phrase of the current AI answer

// Save bookmark state for the current popup: the normalized word/phrase,
// whether it is a phrase (phrase collection) or a single word (tracker
// entry), the saved flag read from storage, and the rendered button (if any).
let bookmark: { text: string; isPhrase: boolean; saved: boolean; button: HTMLButtonElement | null } | null = null;
// The currently rendered first definition (Oxford sense, or the first AI
// item when the lookup fell back to AI) — saved when the bookmark is toggled on.
let currentDefinition: string | undefined;

// Selected BYOK provider for the badge/texts. Defaults to Mistral so the
// very first render (before the async read resolves) is byte-identical
// to v1.1.5; the read resolves long before any user selection.
let aiLabel = "Mistral";
let aiIsMistral = true;
chrome.storage.local
  .get(null)
  .then((snap) => {
    const row = providerById(selectedProvider(snap as StorageSnapshot));
    if (row) {
      aiLabel = row.label;
      aiIsMistral = row.id === "mistral";
    }
  })
  .catch(() => {});

export function closeAiPort(): void {
  if (aiPort) {
    try {
      aiPort.disconnect();
    } catch (err) {
      // already gone
    }
    aiPort = null;
  }
}

export function renderPopup(word: string, x: number, y: number, aiMode: boolean, sentence = ""): void {
  hidePopup();
  popupState.sentence = sentence;
  bookmark = { text: word, isPhrase: aiMode, saved: false, button: null };
  currentDefinition = undefined;
  void loadBookmarkSaved(word, aiMode); // read the store in parallel with the lookup
  const popup = el("div");
  popupState.node = popup;
  popup.id = "oxp-popup";

  const status = el("div", "oxp-status");
  status.append(el("span", "oxp-status-word", word));
  status.append(document.createTextNode(aiMode ? " — asking " + aiLabel + "…" : " — looking up…"));
  if (aiMode) status.append(buildAiBadge());
  popup.append(status);

  document.documentElement.appendChild(popup);

  // Position after layout so offsetWidth/Height are known.
  placePopup(x, y);
}

/**
 * Keep the popup fully inside the viewport. Called twice: once for the
 * small "looking up…" stub and again after the real content renders —
 * the entry is much taller, so the earlier placement can no longer fit.
 * 1) below the word; 2) if it overflows — above the word;
 * 3) if that is impossible too — clamped to the viewport edge
 *    (the popup has its own scrollbar via max-height).
 */
export function placePopup(x?: number, y?: number): void {
  const popup = popupState.node;
  if (!popup) return;
  if (x !== undefined) anchorX = x;
  if (y !== undefined) anchorY = y;
  const w = popup.offsetWidth;
  const h = popup.offsetHeight;
  const margin = 8;
  const left = Math.max(margin, Math.min(anchorX, window.innerWidth - w - margin));
  let top = anchorY + 4;
  if (top + h > window.innerHeight - margin) {
    top = Math.max(margin, Math.min(anchorY - h - 8, window.innerHeight - h - margin));
  }
  popup.style.left = left + "px";
  popup.style.top = top + "px";
}

// ------------------------------------------------------------ save bookmark

const BOOKMARK_PATH = "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z";

function bookmarkSvg(saved: boolean): string {
  const color = saved ? "#176d3a" : "#57606a";
  return (
    '<svg viewBox="0 0 24 24" fill="' +
    (saved ? "#176d3a" : "none") +
    '" stroke="' +
    color +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="' +
    BOOKMARK_PATH +
    '"/></svg>'
  );
}

function headRow(): Element | null {
  return popupState.node ? popupState.node.querySelector(".oxp-head") : null;
}

function buildBookmarkButton(): HTMLButtonElement {
  const btn = el("button", "oxp-save");
  btn.type = "button";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleBookmark();
  });
  return btn;
}

function updateBookmarkButton(): void {
  if (!bookmark || !bookmark.button) return;
  bookmark.button.innerHTML = bookmarkSvg(bookmark.saved);
  bookmark.button.title = bookmark.saved ? "Saved to your cards" : "Save to your cards";
}

/**
 * Attach the bookmark button to the head row when it should be visible: an
 * already-saved item shows the filled bookmark from the first frame; an
 * unsaved item's bookmark appears only once a definition has rendered.
 */
function attachBookmark(definitionReady: boolean): void {
  if (!bookmark || bookmark.button) return;
  if (!bookmark.saved && !definitionReady) return;
  const head = headRow();
  if (!head) return;
  bookmark.button = buildBookmarkButton();
  head.append(bookmark.button);
  updateBookmarkButton();
}

/** Read the saved state in parallel with the lookup; refresh the button. */
async function loadBookmarkSaved(text: string, isPhrase: boolean): Promise<void> {
  let saved = false;
  try {
    if (isPhrase) {
      const data = await readPhraseCollection();
      saved = Boolean(data.phrases[normalizePhrase(text)]);
    } else {
      const data = await readTracker();
      const entry = data.words[text];
      saved = Boolean(entry && entry.saved);
    }
  } catch (err) {
    // storage unavailable — keep the unsaved outline
  }
  if (!bookmark || bookmark.text !== text || bookmark.isPhrase !== isPhrase) return; // re-rendered or closed
  bookmark.saved = saved;
  attachBookmark(false);
}

/** Click = toggle, instant: save or unsave, then flip the icon. */
async function toggleBookmark(): Promise<void> {
  if (!bookmark) return;
  const { text, isPhrase, saved } = bookmark;
  const context = popupState.sentence;
  try {
    if (isPhrase) {
      if (saved) {
        await deletePhrase(normalizePhrase(text));
        bookmark.saved = false;
      } else {
        await savePhrase(text, context, currentDefinition ?? "");
        bookmark.saved = true;
      }
    } else {
      if (saved) {
        await unsaveWord(text);
        bookmark.saved = false;
      } else {
        await saveWord(text, context, currentDefinition);
        bookmark.saved = true;
      }
    }
  } catch (err) {
    return; // storage failed — keep the icon as it was
  }
  updateBookmarkButton();
}

/** Append the meeting indicator to the head row once storage resolves. */
async function showMeetingIndicator(entry: WordEntry | null): Promise<void> {
  if (!entry || !popupState.node) return;
  let threshold: number | undefined;
  try {
    threshold = (await readTrackerSettings()).threshold;
  } catch (err) {
    // storage unavailable — fall back to the default threshold
  }
  const info = meetingIndicator(entry, threshold);
  if (info.kind === "hidden") return;
  const head = popupState.node.querySelector(".oxp-head");
  if (!head) return; // popup re-rendered or closed while storage resolved
  const span = el("span", "oxp-meeting" + (info.kind === "ready" ? " oxp-ready" : ""), info.text);
  span.title = info.title;
  const saveBtn = head.querySelector(".oxp-save");
  if (saveBtn) head.insertBefore(span, saveBtn); // keep the bookmark on the far right
  else head.append(span);
}

export async function lookupAndRender(word: string, sentence: string): Promise<void> {
  let response: OxfordLookupResponse | null = null;
  try {
    response = (await chrome.runtime.sendMessage({ type: "oxford-lookup", word })) as
      | OxfordLookupResponse
      | null;
  } catch (err) {
    // Extension context is gone (e.g. it was just reloaded).
  }
  if (!popupState.node) return; // closed while loading
  clearChildren(popupState.node);

  if (response && response.error) {
    popupState.node.append(buildStatus(word, "couldn't reach oxfordlearnersdictionaries.com"));
    placePopup(); // content height changed — re-fit into the viewport
    tryAi(
      word,
      sentence,
      false,
      () => {
        if (!popupState.node) return;
        clearChildren(popupState.node);
        popupState.node.append(buildStatus(word, "couldn't reach oxfordlearnersdictionaries.com"));
        placePopup();
      },
      true
    );
    return;
  }

  if (response && response.ok && response.html) {
    const entry = parseEntry(response.html);
    if (entry) {
      popupState.node.append(buildEntry(entry, response.url));
      currentDefinition = entry.senses.length > 0 ? entry.senses[0]!.def : undefined;
      void recordMeeting(word, currentDefinition).then(showMeetingIndicator);
      attachBookmark(true); // the senses list rendered — the bookmark may appear now
      placePopup(); // content height changed — re-fit into the viewport
      return;
    }
  }
  popupState.node.append(buildNotFound(word));
  placePopup(); // content height changed — re-fit into the viewport
  tryAi(
    word,
    sentence,
    false,
    () => {
      if (!popupState.node) return;
      clearChildren(popupState.node);
      popupState.node.append(buildNotFound(word));
      placePopup();
    },
    true
  );
}

export function buildEntry(entry: DictEntry, url: string): DocumentFragment {
  const frag = document.createDocumentFragment();

  const head = el("div", "oxp-head");
  head.append(el("span", "oxp-word", entry.headword));
  if (entry.pos) head.append(el("span", "oxp-pos", entry.pos));
  if (entry.level) {
    const badge = el("span", "oxp-level", entry.level);
    badge.title = entry.levelList
      ? entry.levelList + " · CEFR level " + entry.level
      : "CEFR level " + entry.level;
    head.append(badge);
  }
  frag.append(head);

  // Pronunciation line: [speaker] BrE /X/ · [speaker] NAmE /Y/
  const phon = el("div", "oxp-phon");
  const addPhonPart = (label: string, transcription: string, audioUrl: string) => {
    const part = el("span", "oxp-phon-part");
    if (audioUrl) {
      const btn = el("button", "oxp-audio");
      btn.type = "button";
      btn.title = "Play " + label + " pronunciation";
      btn.innerHTML = SPEAKER_SVG;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        playAudio(audioUrl);
      });
      part.append(btn);
    }
    if (transcription) {
      part.append(document.createTextNode(label + " " + transcription));
    }
    if (part.childNodes.length) phon.append(part);
  };
  addPhonPart("BrE", entry.phonBr, entry.audioUk);
  if (phon.childNodes.length && entry.phonUs) {
    phon.append(el("span", "oxp-phon-sep", "·"));
  }
  addPhonPart("NAmE", entry.phonUs, entry.audioUs);
  if (phon.childNodes.length) frag.append(phon);

  const ol = el("ol", "oxp-senses");
  for (const s of entry.senses) {
    const li = el("li");
    if (s.grammar) li.append(el("span", "oxp-gram", s.grammar + " "));
    li.append(el("span", "oxp-def", s.def));
    ol.append(li);
  }
  frag.append(ol);

  const footer = el("div", "oxp-footer");
  const link = el("a", "oxp-link", "Full entry on Oxford");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  footer.append(link);
  frag.append(footer);

  return frag;
}

export function buildStatus(word: string, message: string): HTMLDivElement {
  const status = el("div", "oxp-status");
  status.append(el("span", "oxp-status-word", word));
  status.append(document.createTextNode(" — " + message));
  return status;
}

export function buildNotFound(word: string): DocumentFragment {
  const box = document.createDocumentFragment();
  box.append(buildStatus(word, "no definition found"));
  const footer = el("div", "oxp-footer");
  const link = el("a", "oxp-link", "Search on Oxford");
  link.href = SEARCH_URL + encodeURIComponent(word);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  footer.append(link);
  box.append(footer);
  return box;
}

// --------------------------------------------------------------------- AI

export function buildAiBadge(): HTMLSpanElement {
  if (aiIsMistral) {
    const badge = el("span", "oxp-ai-badge");
    badge.title = "Explained by Mistral AI";
    badge.innerHTML = MISTRAL_SVG;
    return badge;
  }
  const badge = el("span", "oxp-ai-badge oxp-ai-text-badge", aiLabel);
  badge.title = "Explained by " + aiLabel;
  return badge;
}

/**
 * Ask the selected provider to explain word/phrase and stream the answer
 * into the popup. `restore` rebuilds the previous (Oxford) UI when the
 * user has no API key yet; `renderInitial` re-renders the " — asking…"
 * stub with the provider badge — false for the phrase path where
 * renderPopup() already drew it.
 */
export function tryAi(
  word: string,
  sentence: string,
  isPhrase: boolean,
  restore: () => void,
  renderInitial: boolean
): void {
  if (!popupState.node) return;
  closeAiPort();
  aiWord = word;

  if (renderInitial) {
    clearChildren(popupState.node);
    const status = el("div", "oxp-status");
    status.append(el("span", "oxp-status-word", word));
    status.append(document.createTextNode(" — asking " + aiLabel + "…"));
    status.append(buildAiBadge());
    popupState.node.append(status);
    placePopup();
  }

  let buffer = "";
  aiPort = chrome.runtime.connect({ name: "oxford-ai" });
  aiPort.onMessage.addListener((msg: AiPortMessage) => {
    if (!popupState.node) return;
    if (msg.type === "chunk") {
      buffer += msg.text;
      renderAiAnswer(buffer, false);
    } else if (msg.type === "done") {
      closeAiPort();
      if (!buffer.trim()) {
        renderAiFallbackOnly(); // model returned nothing — show not-found
        return;
      }
      renderAiAnswer(buffer, true);
      if (!isPhrase) void recordMeeting(word).then(showMeetingIndicator);
    } else if (msg.type === "no-key") {
      closeAiPort();
      restore();
    } else if (msg.type === "error") {
      closeAiPort();
      clearChildren(popupState.node);
      popupState.node.append(buildStatus(word, aiLabel + " request failed"));
      popupState.node.append(el("div", "oxp-detail", String(msg.message || "unknown error")));
      // The most common cause is a missing provider-origin permission —
      // send the user straight to the settings page that can grant it.
      const footer = el("div", "oxp-footer");
      const btn = el("button", "oxp-btn", "Open settings");
      btn.type = "button";
      btn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "oxford-open-options" });
      });
      footer.append(btn);
      popupState.node.append(footer);
      placePopup();
    }
  });
  aiPort.postMessage({ word, sentence, isPhrase });
}

/** Render the streamed buffer as header + numbered list (Oxford-like). */
export function renderAiAnswer(buffer: string, done: boolean): void {
  if (!popupState.node) return;
  clearChildren(popupState.node);

  const head = el("div", "oxp-head");
  head.append(el("span", "oxp-word", aiWord));
  head.append(buildAiBadge());
  popupState.node.append(head);
  // The head is rebuilt on every chunk — the old bookmark button is gone.
  if (bookmark && bookmark.text === aiWord) bookmark.button = null;

  // Pronunciation row: browser TTS buttons (phrases have no Oxford MP3s).
  const phon = el("div", "oxp-phon");
  const addSpeakPart = (label: string, lang: string) => {
    const part = el("span", "oxp-phon-part");
    const btn = el("button", "oxp-audio");
    btn.type = "button";
    btn.title = "Speak the " + label + " way (browser voice)";
    btn.innerHTML = SPEAKER_SVG;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      speakText(aiWord, lang);
    });
    part.append(btn);
    part.append(document.createTextNode(" " + label));
    phon.append(part);
  };
  addSpeakPart("BrE", "en-GB");
  phon.append(el("span", "oxp-phon-sep", "·"));
  addSpeakPart("NAmE", "en-US");
  popupState.node.append(phon);

  const items = parseAiItems(buffer);
  const ol = el("ol", "oxp-senses");
  for (const item of items) {
    const li = el("li");
    li.append(el("span", "oxp-def", item.meaning));
    if (item.example) {
      li.append(el("span", "oxp-ex", '"' + item.example + '"'));
    }
    ol.append(li);
  }
  popupState.node.append(ol);
  if (items.length > 0) currentDefinition = items[0]!.meaning;
  attachBookmark(items.length > 0); // first AI item rendered (or already saved)

  if (done) {
    const footer = el("div", "oxp-footer");
    footer.append(
      el("span", "oxp-ai-note", aiIsMistral ? "Explained by Mistral AI" : "Explained by " + aiLabel)
    );
    popupState.node.append(footer);
  }
  placePopup(); // content height changed — re-fit into the viewport
}

/** The AI answer was empty: degrade to the Oxford not-found UI. */
export function renderAiFallbackOnly(): void {
  if (!popupState.node) return;
  clearChildren(popupState.node);
  popupState.node.append(buildNotFound(aiWord));
  placePopup();
}

/** Phrase mode without an API key: explain + a way to open the settings. */
export function buildNoKey(word: string): void {
  if (!popupState.node) return;
  clearChildren(popupState.node);
  // a/an before the label ("an OpenAI", "a Mistral") — byte-identical for mistral.
  const article = /^[aeiou]/i.test(aiLabel) ? "an" : "a";
  popupState.node.append(buildStatus(word, "AI explanations need " + article + " " + aiLabel + " API key"));
  const footer = el("div", "oxp-footer");
  const btn = el("button", "oxp-btn", "Open settings");
  btn.type = "button";
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "oxford-open-options" });
  });
  footer.append(btn);
  footer.append(document.createTextNode(" "));
  const link = el("a", "oxp-link", "Search on Oxford");
  link.href = SEARCH_URL + encodeURIComponent(word);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  footer.append(link);
  popupState.node.append(footer);
  placePopup();
}
