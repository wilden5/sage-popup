/**
 * Oxford Popup — content script (entry point).
 *
 * Flow (mirrors Simple Translate):
 *   1. User selects a word -> a small floating button appears next to it.
 *   2. Click the button -> a minimal popup loads and shows the word's
 *      Oxford Learner's Dictionaries definition.
 *   3. Multi-word selections, and single words Oxford does not know, fall
 *      back to an AI explanation from the user's selected BYOK provider
 *      streamed straight into the popup (marked with the provider badge).
 *      Needs an API key in settings; without one the popup keeps working
 *      Oxford-only.
 *
 * Layout note: the renderers and the lookup/AI flow live in ./popup (which
 * owns the popup node via the popupState holder); the pure helpers live in
 * their sibling modules. This file keeps the constants, the floating icon,
 * the dismissal logic and all document/window event listeners.
 */

import { el } from "./dom";
import { normalize } from "./normalize";
import { stopAudio } from "./audio";
import { stopSpeech } from "./tts";
import {
  popupState,
  closeAiPort,
  renderPopup,
  lookupAndRender,
  tryAi,
  buildNoKey
} from "./popup";

export const BOOK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#3b6ea5" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/>' +
  '<path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/></svg>';

// Official Mistral AI mark (2025), drawn as rects so it scales cleanly.
export const MISTRAL_SVG =
  '<svg viewBox="0 0 129 91" aria-hidden="true">' +
  '<rect x="18.292" y="0" width="18.293" height="18.123" fill="#ffd800"/>' +
  '<rect x="91.473" y="0" width="18.293" height="18.123" fill="#ffd800"/>' +
  '<rect x="18.292" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>' +
  '<rect x="73.181" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>' +
  '<rect x="18.292" y="36.243" width="91.476" height="18.122" fill="#ff8205"/>' +
  '<rect x="18.292" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>' +
  '<rect x="54.883" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>' +
  '<rect x="91.473" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>' +
  '<rect x="0" y="72.504" width="54.89" height="18.123" fill="#e10500"/>' +
  '<rect x="73.181" y="72.504" width="54.89" height="18.123" fill="#e10500"/>' +
  "</svg>";

export const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M11 5 6 9H2v6h4l5 4z"/>' +
  '<path d="M15.5 8.5a5 5 0 0 1 0 7"/>' +
  '<path d="M19 5a10 10 0 0 1 0 14"/></svg>';

export const SEARCH_URL = "https://www.oxfordlearnersdictionaries.com/search/english/?q=";
export const MAX_WORD_LEN = 80;

let icon: HTMLDivElement | null = null;
let pendingWord: string | null = null;
let pendingRange: Range | null = null; // live Range of the current selection (for icon tracking)
let pendingIsPhrase = false; // 2+ words selected -> straight to the AI
let pendingSentence = ""; // context sentence around the selection (for the AI)

function isOurUi(target: EventTarget | null): boolean {
  const popup = popupState.node;
  return Boolean(
    (icon && (target === icon || icon.contains(target as Node))) ||
    (popup && (target === popup || popup.contains(target as Node)))
  );
}

function hideIcon(): void {
  if (icon) {
    icon.remove();
    icon = null;
  }
}

export function hidePopup(): void {
  if (popupState.node) {
    popupState.node.remove();
    popupState.node = null;
  }
  stopAudio();
  stopSpeech();
  closeAiPort();
}

function hideAll(): void {
  hideIcon();
  hidePopup();
  pendingRange = null;
}

/**
 * A short slice of the surrounding paragraph (~330 chars) around the
 * selection, sent to the selected provider as context. Best effort: an empty string is
 * fine — the prompt works without it.
 */
function sentenceContext(): string {
  try {
    if (!pendingRange || !pendingWord) return "";
    const node = pendingRange.startContainer;
    const block = node.nodeType === 3 ? node.parentElement : node; // text node -> element
    if (!block) return "";
    const text = (block.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const anchor = pendingWord.split(" ")[0]!;
    const idx = text.indexOf(anchor);
    if (idx === -1) return text.slice(0, 320);
    const start = Math.max(0, idx - 150);
    const end = Math.min(text.length, idx + pendingWord.length + 180);
    return text.slice(start, end);
  } catch (err) {
    return "";
  }
}

// ----------------------------------------------------------- floating icon

function positionIcon(x: number, y: number): void {
  if (!icon) return;
  const left = Math.max(4, Math.min(x + 2, window.innerWidth - 32));
  const top = Math.max(4, Math.min(y + 6, window.innerHeight - 32));
  icon.style.left = left + "px";
  icon.style.top = top + "px";
}

function showIcon(x: number, y: number): void {
  hideIcon();
  icon = el("div");
  icon.id = "oxp-icon";
  icon.title = "Show Oxford definition";
  icon.innerHTML = BOOK_SVG;
  icon.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  icon.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPopup();
  });
  document.documentElement.appendChild(icon);
  positionIcon(x, y);
}

/**
 * On scroll keep the floating icon attached to the selected word: it moves
 * with the word, disappears together with it once the word leaves the
 * viewport, and reappears when the (still selected) word scrolls back into
 * view. Throttled to one update per frame via requestAnimationFrame.
 */
let iconFollowQueued = false;
function followSelection(): void {
  if (iconFollowQueued) return;
  iconFollowQueued = true;
  requestAnimationFrame(() => {
    iconFollowQueued = false;
    const popup = popupState.node;
    if (!pendingRange || !pendingWord || popup) return; // no icon while the popup is open
    const rect = pendingRange.getBoundingClientRect();
    if (
      !rect ||
      (!rect.width && !rect.height) ||
      rect.top > window.innerHeight ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.right < 0
    ) {
      hideIcon(); // the word left the viewport — the icon leaves with it
      return;
    }
    if (icon) {
      positionIcon(rect.right, rect.bottom);
    } else {
      showIcon(rect.right, rect.bottom); // word scrolled back — bring the icon back
    }
  });
}

function openPopup(): void {
  const word = pendingWord;
  if (!word) return;
  const isPhrase = pendingIsPhrase;
  const sentence = pendingSentence;
  const rect = icon ? icon.getBoundingClientRect() : null;
  const x = rect ? rect.left : 40;
  const y = rect ? rect.bottom : 40;
  hideIcon();
  renderPopup(word, x, y, isPhrase, sentence);
  if (isPhrase) {
    // Phrases go straight to the selected provider (per design: context explanation).
    tryAi(word, sentence, true, () => buildNoKey(word), false);
  } else {
    void lookupAndRender(word, sentence);
  }
}

// -------------------------------------------------------------- selection

document.addEventListener(
  "mouseup",
  (e) => {
    if (e.button !== 0) return;
    if (isOurUi(e.target)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      pendingWord = null;
      hideIcon();
      return;
    }

    const word = normalize(sel.toString());
    // Only offer lookups that can end up in the English dictionary.
    if (!word || word.length > MAX_WORD_LEN || !/[a-zA-Z]/.test(word)) {
      pendingWord = null;
      hideIcon();
      return;
    }

    pendingWord = word;
    pendingRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    pendingIsPhrase = /\s/.test(word); // two or more words
    pendingSentence = sentenceContext();
    let x = e.clientX;
    let y = e.clientY;
    if (sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect && (rect.width || rect.height)) {
        x = rect.right;
        y = rect.bottom;
      }
    }
    showIcon(x, y);
  },
  true
);

// --------------------------------------------------------------- dismissal

document.addEventListener(
  "mousedown",
  (e) => {
    if (!isOurUi(e.target)) hideAll();
  },
  true
);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideAll();
});

// On scroll keep the popup open (it is position:fixed and fully usable),
// and keep the floating icon attached to the selected word — it follows
// the word and disappears once the word leaves the viewport. Scrolling
// inside the popup itself changes nothing.
window.addEventListener(
  "scroll",
  (e) => {
    const popup = popupState.node;
    if (popup && e.target === popup) return;
    followSelection();
  },
  true
);

// The popup deliberately survives window blur (switching tabs/windows and
// coming back): the selection is still there, so its anchor stays valid —
// same "state of the page, not a transient tooltip" logic as scrolling.
// Only explicit user actions dismiss it: click outside, Escape, a new lookup.
