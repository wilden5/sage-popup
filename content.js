(() => {
  "use strict";

  /**
   * Oxford Popup — content script.
   *
   * Flow (mirrors Simple Translate):
   *   1. User selects a word -> a small floating button appears next to it.
   *   2. Click the button -> a minimal popup loads and shows the word's
   *      Oxford Learner's Dictionaries definition.
   */

  const BOOK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#3b6ea5" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/>' +
    '<path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/></svg>';

  const SPEAKER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 5 6 9H2v6h4l5 4z"/>' +
    '<path d="M15.5 8.5a5 5 0 0 1 0 7"/>' +
    '<path d="M19 5a10 10 0 0 1 0 14"/></svg>';

  const SEARCH_URL = "https://www.oxfordlearnersdictionaries.com/search/english/?q=";
  const MAX_WORD_LEN = 80;

  let icon = null;
  let popup = null;
  let pendingWord = null;
  let currentAudio = null;
  let anchorX = 40;
  let anchorY = 40; // viewport point below the word the popup is anchored to

  // ---------------------------------------------------------------- helpers

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function isOurUi(target) {
    return Boolean(
      (icon && (target === icon || icon.contains(target))) ||
      (popup && (target === popup || popup.contains(target)))
    );
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /** Trim whitespace and surrounding punctuation from the selection. */
  function normalize(text) {
    return text
      .replace(/\s+/g, " ")
      .replace(/^[\s"'“”‘’(\[{<»„.,;:!?…—–]+/, "")
      .replace(/[\s"'“”‘’)\]}>«“.,;:!?…—–]+$/, "")
      .trim();
  }

  function hideIcon() {
    if (icon) {
      icon.remove();
      icon = null;
    }
  }

  function hidePopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
    stopAudio();
  }

  function hideAll() {
    hideIcon();
    hidePopup();
  }

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }

  function playAudio(url) {
    stopAudio();
    currentAudio = new Audio(url);
    currentAudio.play().catch(() => {}); // ignore autoplay/network errors
  }

  // ----------------------------------------------------------- floating icon

  function showIcon(x, y) {
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

    const left = Math.max(4, Math.min(x + 2, window.innerWidth - 32));
    const top = Math.max(4, Math.min(y + 6, window.innerHeight - 32));
    icon.style.left = left + "px";
    icon.style.top = top + "px";
  }

  function openPopup() {
    const word = pendingWord;
    if (!word) return;
    const rect = icon ? icon.getBoundingClientRect() : null;
    const x = rect ? rect.left : 40;
    const y = rect ? rect.bottom : 40;
    hideIcon();
    renderPopup(word, x, y);
    void lookupAndRender(word);
  }

  // ------------------------------------------------------------------- popup

  function renderPopup(word, x, y) {
    hidePopup();
    popup = el("div");
    popup.id = "oxp-popup";

    const status = el("div", "oxp-status");
    status.append(el("span", "oxp-status-word", word));
    status.append(document.createTextNode(" — looking up…"));
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
  function placePopup(x, y) {
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

  async function lookupAndRender(word) {
    let response = null;
    try {
      response = await chrome.runtime.sendMessage({ type: "oxford-lookup", word });
    } catch (err) {
      // Extension context is gone (e.g. it was just reloaded).
    }
    if (!popup) return; // closed while loading
    clearChildren(popup);

    if (response && response.error) {
      popup.append(buildStatus(word, "couldn't reach oxfordlearnersdictionaries.com"));
      placePopup(); // content height changed — re-fit into the viewport
      return;
    }

    if (response && response.ok && response.html) {
      const entry = parseEntry(response.html);
      if (entry) {
        popup.append(buildEntry(entry, response.url));
        placePopup(); // content height changed — re-fit into the viewport
        return;
      }
    }
    popup.append(buildNotFound(word));
    placePopup(); // content height changed — re-fit into the viewport
  }

  /** Parse the Oxford definition page into a small plain object. */
  function parseEntry(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const entry = doc.querySelector("div.entry");
    if (!entry) return null;

    const headword = entry.querySelector("h1.headword");
    const pos = entry.querySelector(".webtop .pos");
    const phonBr = entry.querySelector(".phons_br .phon");
    const phonUs = entry.querySelector(".phons_n_am .phon");
    const pronUk = entry.querySelector(".phons_br .sound.pron-uk");
    const pronUs = entry.querySelector(".phons_n_am .sound.pron-us");
    // CEFR level badge (only Oxford 3000/5000 words have it; OPAL spans have no level).
    const symSpan = entry.querySelector(
      ".webtop .symbols span[class^='ox3ksym_'], .webtop .symbols span[class^='ox5ksym_']"
    );
    let level = "";
    let levelList = "";
    if (symSpan) {
      const lm = (symSpan.className || "").match(/sym_([abc][12])/);
      if (lm) {
        level = lm[1].toUpperCase();
        levelList = symSpan.className.indexOf("ox5k") === 0 ? "Oxford 5000" : "Oxford 3000";
      }
    }

    // First senses list of the first entry (skips run-on blocks).
    const list = entry.querySelector("ol.senses_multiple, ol.sense_single");
    const senses = [];
    if (list) {
      for (const li of list.querySelectorAll("li.sense")) {
        // Skip senses nested inside another sense (subsenses) if any appear.
        if (li.parentElement && li.parentElement.closest("li.sense")) continue;
        const grammar = li.querySelector(".sensetop .grammar");
        const def = li.querySelector(".def");
        const defText = def ? def.textContent.trim() : "";
        if (defText) {
          senses.push({
            grammar: grammar ? grammar.textContent.trim() : "",
            def: defText
          });
        }
      }
    }

    if (!headword || senses.length === 0) return null;
    return {
      headword: headword.textContent.trim(),
      pos: pos ? pos.textContent.trim() : "",
      phonBr: phonBr ? phonBr.textContent.trim() : "",
      phonUs: phonUs ? phonUs.textContent.trim() : "",
      audioUk: pronUk ? pronUk.getAttribute("data-src-mp3") || "" : "",
      audioUs: pronUs ? pronUs.getAttribute("data-src-mp3") || "" : "",
      level,
      levelList,
      senses
    };
  }

  function buildEntry(entry, url) {
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
    const addPhonPart = (label, transcription, audioUrl) => {
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

  function buildStatus(word, message) {
    const status = el("div", "oxp-status");
    status.append(el("span", "oxp-status-word", word));
    status.append(document.createTextNode(" — " + message));
    return status;
  }

  function buildNotFound(word) {
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
  // but hide the floating icon — its position belongs to the old scroll
  // offset. Scrolling inside the popup itself changes nothing.
  window.addEventListener(
    "scroll",
    (e) => {
      if (popup && e.target === popup) return;
      hideIcon();
    },
    true
  );

  window.addEventListener("blur", hideAll);
})();
