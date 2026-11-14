/**
 * Oxford Popup — options page (multi-provider BYOK, MULTI_PROVIDER.md §5).
 *
 * Provider dropdown populated from the pure registry, one API-key field,
 * one free-text model field, Save / Test key / Grant access. Keys and model
 * overrides live in chrome.storage.local under aiKeys / aiModels; the
 * legacy mistralApiKey is only ever read (via apiKeyFor), never written or
 * deleted. The default provider stays Mistral, so existing users see zero
 * behavior change.
 */
import type { StorageSnapshot } from "../shared/types";
import {
  DEFAULT_PROVIDER_ID,
  PROVIDERS,
  apiKeyFor,
  providerById,
  selectedProvider
} from "../shared/providers";
import type { WordEntry, WordTrackerData } from "../tracker/model";
import { emptyTracker } from "../tracker/model";
import {
  TRACKER_SETTINGS_SCHEMA_VERSION,
  applyThreshold,
  clampThreshold,
  defaultTrackerSettings
} from "../tracker/settings";
import type { WordTrackerSettings } from "../tracker/settings";
import { readTracker, readTrackerSettings, writeTracker, writeTrackerSettings } from "../tracker/storage";
import { countByStatus, filterByQuery, listWords } from "./words";
import type { SortKey, StatusFilter, WordListResult } from "./words";

(() => {
  "use strict";

  const select = document.getElementById("provider") as HTMLSelectElement;
  const input = document.getElementById("key") as HTMLInputElement;
  const modelInput = document.getElementById("model") as HTMLInputElement;
  const status = document.getElementById("status") as HTMLElement;
  const perm = document.getElementById("perm") as HTMLElement;
  const grantBtn = document.getElementById("grant") as HTMLButtonElement;

  function setStatus(text: string, cls: string) {
    status.textContent = text;
    status.className = cls || "";
  }

  function setPerm(text: string, cls: string) {
    perm.textContent = text;
    perm.className = cls || "";
  }

  // chrome.permissions returns promises in Firefox and callbacks in Chrome —
  // support both shapes.
  function permCall(method: "contains" | "request", args: { origins: string[] }): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const done = (value: unknown) => {
        if (!settled) {
          settled = true;
          resolve(!!value);
        }
      };
      try {
        const p = chrome.permissions[method](args, done);
        if (p && typeof p.then === "function") p.then(done, () => done(false));
      } catch (err) {
        done(false);
      }
    });
  }

  function currentRow() {
    return providerById(select.value) ?? providerById(DEFAULT_PROVIDER_ID)!;
  }

  const currentOrigin = () => currentRow().origin;
  // The bare hostname of the selected origin (api.mistral.ai for mistral) —
  // the same text shape the v1.1.5 options page used.
  const currentHost = () => new URL(currentOrigin()).hostname;

  const hasAccess = () => permCall("contains", { origins: [currentOrigin()] });
  const requestAccess = () => permCall("request", { origins: [currentOrigin()] });

  function refreshPerm() {
    const host = currentHost();
    return hasAccess().then((granted) => {
      if (granted) {
        setPerm("✓ Access to " + host + " granted", "ok");
      } else {
        setPerm("✗ No access to " + host + " — click “Grant access”", "err");
      }
      grantBtn.style.display = granted ? "none" : "inline-block";
      return granted;
    });
  }

  // Populate the dropdown with the registry rows in table order.
  for (const p of PROVIDERS) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    select.appendChild(opt);
  }

  // Fill the inputs for a provider from a storage snapshot: the key via the
  // migration-aware helper, the model as the raw stored OVERRIDE (never the
  // suggestion), the placeholder as the registry suggestion.
  function fill(id: string, snapshot: StorageSnapshot) {
    const row = providerById(id) ?? providerById(DEFAULT_PROVIDER_ID)!;
    select.value = row.id;
    input.value = apiKeyFor(snapshot, row.id);
    const models = snapshot["aiModels"];
    const stored =
      models !== null && typeof models === "object"
        ? (models as Record<string, unknown>)[row.id]
        : undefined;
    modelInput.value = typeof stored === "string" ? stored : "";
    modelInput.placeholder = row.suggestedModel;
  }

  async function init() {
    try {
      const snapshot = (await chrome.storage.local.get(null)) as StorageSnapshot;
      const id = selectedProvider(snapshot);
      fill(id, snapshot);
      if (input.value) setStatus("Your " + currentRow().label + " key is saved.", "ok");
    } catch (err) {
      // storage unavailable — leave the fields empty
    }
    refreshPerm();
  }

  // Switching provider loads that provider's stored key/model and re-checks
  // the permission for the newly selected origin.
  select.addEventListener("change", () => {
    (async () => {
      try {
        const snapshot = (await chrome.storage.local.get(null)) as StorageSnapshot;
        fill(select.value, snapshot);
        // Recompute the status for the newly selected provider — never leave
        // the previous provider's text visible.
        const row = currentRow();
        if (apiKeyFor(snapshot, row.id)) {
          setStatus("Your " + row.label + " key is saved.", "ok");
        } else {
          setStatus("", "");
        }
      } catch (err) {
        // storage unavailable — leave the fields as they are
      }
      refreshPerm();
    })();
  });

  init();

  (document.getElementById("save") as HTMLButtonElement).addEventListener("click", () => {
    const id = select.value;
    const key = input.value.trim();
    const model = modelInput.value.trim();
    (async () => {
      try {
        const data = await chrome.storage.local.get(["aiKeys", "aiModels"]);
        const aiKeys: Record<string, string> =
          data && data.aiKeys !== null && typeof data.aiKeys === "object"
            ? { ...(data.aiKeys as Record<string, string>) }
            : {};
        const aiModels: Record<string, string> =
          data && data.aiModels !== null && typeof data.aiModels === "object"
            ? { ...(data.aiModels as Record<string, string>) }
            : {};
        aiKeys[id] = key;
        if (model) aiModels[id] = model;
        else delete aiModels[id]; // empty model -> the registry suggestion applies
        await chrome.storage.local.set({ aiKeys, aiModels, aiProvider: id });
        setStatus(
          key
            ? "Saved for " + currentRow().label + "."
            : "Saved for " + currentRow().label + " (key cleared — AI disabled).",
          "ok"
        );
      } catch (err) {
        setStatus("Could not save — storage error.", "err");
      }
    })();
  });

  // Explicit host-permission grant (needed in Firefox, one click in Chrome).
  grantBtn.addEventListener("click", () => {
    const host = currentHost();
    requestAccess().then((granted) => {
      refreshPerm();
      if (granted) {
        setStatus("Access granted. You can test the key now.", "ok");
      } else {
        setStatus(
          "Access was not granted. Firefox: about:addons → Oxford Popup → «Разрешения и данные» → enable " + host + ".",
          "err"
        );
      }
    });
  });

  (document.getElementById("test") as HTMLButtonElement).addEventListener("click", () => {
    const row = currentRow();
    const host = currentHost();
    const key = input.value.trim();
    if (!key) {
      setStatus("Paste the key first.", "err");
      return;
    }
    setStatus("Testing…", "");
    hasAccess().then(async (granted) => {
      if (!granted) granted = await requestAccess();
      refreshPerm();
      if (!granted) {
        setStatus("No access to " + host + " — the browser blocks the request. Click “Grant access”.", "err");
        return;
      }
      try {
        const res = await chrome.runtime.sendMessage({ type: "oxford-test-key", key, provider: row.id });
        if (res && res.ok) setStatus("Key works — the AI is ready.", "ok");
        else setStatus(row.label + " says: " + ((res && res.message) || "unknown error"), "err");
      } catch (err) {
        setStatus("Could not reach the background script.", "err");
      }
    });
  });

  // ------------------------------------------------------------------ tabs

  const tabAi = document.getElementById("tab-ai") as HTMLButtonElement;
  const tabTracker = document.getElementById("tab-tracker") as HTMLButtonElement;
  const panelAi = document.getElementById("panel-ai") as HTMLElement;
  const panelTracker = document.getElementById("panel-tracker") as HTMLElement;

  function activateTab(which: "ai" | "tracker") {
    tabAi.classList.toggle("active", which === "ai");
    tabTracker.classList.toggle("active", which === "tracker");
    panelAi.hidden = which !== "ai";
    panelTracker.hidden = which !== "tracker";
  }

  tabAi.addEventListener("click", () => activateTab("ai"));
  tabTracker.addEventListener("click", () => activateTab("tracker"));

  /** True when at least one non-empty key exists in the stored aiKeys map. */
  function hasAnyStoredKey(snapshot: StorageSnapshot): boolean {
    const keys = snapshot["aiKeys"];
    if (keys === null || typeof keys !== "object") return false;
    for (const value of Object.values(keys as Record<string, unknown>)) {
      if (typeof value === "string" && value !== "") return true;
    }
    return false;
  }

  // ---------------------------------------------------------- word tracker

  const thresholdInput = document.getElementById("threshold") as HTMLInputElement;
  const summaryEl = document.getElementById("tracker-summary") as HTMLElement;
  const searchInput = document.getElementById("word-search") as HTMLInputElement;
  const chipsEl = document.getElementById("status-chips") as HTMLElement;
  const listEl = document.getElementById("word-list") as HTMLElement;
  const paginationEl = document.getElementById("word-pagination") as HTMLElement;
  const sortCountBtn = document.getElementById("sort-count") as HTMLButtonElement;
  const sortRecentBtn = document.getElementById("sort-recent") as HTMLButtonElement;

  const CHIPS: { filter: StatusFilter; label: string }[] = [
    { filter: "all", label: "All" },
    { filter: "active", label: "Learning" },
    { filter: "ready", label: "Ready" },
    { filter: "archived", label: "Archived" },
  ];

  const trackerState: {
    data: WordTrackerData;
    settings: WordTrackerSettings;
    filter: StatusFilter;
    query: string;
    sort: SortKey;
    page: number;
  } = {
    data: emptyTracker(),
    settings: defaultTrackerSettings(),
    filter: "all",
    query: "",
    sort: "count",
    page: 1,
  };

  function actionButton(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "word-action " + cls;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  async function persistTracker(): Promise<void> {
    try {
      await writeTracker(trackerState.data);
    } catch (err) {
      // storage unavailable — the list still re-renders from memory
    }
    renderTracker();
  }

  function archiveWord(lemma: string): void {
    const entry = trackerState.data.words[lemma];
    if (!entry) return;
    entry.status = "archived";
    entry.updatedAt = Date.now();
    void persistTracker();
  }

  function restoreWord(lemma: string): void {
    const entry = trackerState.data.words[lemma];
    if (!entry) return;
    entry.status = entry.count >= trackerState.settings.threshold ? "ready" : "active";
    entry.updatedAt = Date.now();
    void persistTracker();
  }

  function deleteWord(lemma: string): void {
    delete trackerState.data.words[lemma];
    void persistTracker();
  }

  function buildWordRow(entry: WordEntry): HTMLElement {
    const row = document.createElement("div");
    row.className = "word-row" + (entry.status === "archived" ? " archived" : "");

    const main = document.createElement("div");
    main.className = "word-main";

    const line1 = document.createElement("div");
    line1.className = "word-line1";
    const lemma = document.createElement("span");
    lemma.className = "word-lemma";
    lemma.textContent = entry.lemma;
    line1.appendChild(lemma);
    const count = document.createElement("span");
    count.className = "word-count";
    count.textContent = "× " + entry.count;
    line1.appendChild(count);
    if (entry.status === "ready") {
      const badge = document.createElement("span");
      badge.className = "word-badge ready";
      badge.textContent = "ready to learn";
      line1.appendChild(badge);
    } else if (entry.status === "archived") {
      const badge = document.createElement("span");
      badge.className = "word-badge archived";
      badge.textContent = "archived";
      line1.appendChild(badge);
    }
    main.appendChild(line1);

    if (entry.definition) {
      const def = document.createElement("div");
      def.className = "word-def";
      def.textContent = entry.definition;
      def.title = entry.definition;
      main.appendChild(def);
    }
    row.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "word-actions";
    if (entry.status === "archived") {
      actions.appendChild(actionButton("Restore", "restore", () => restoreWord(entry.lemma)));
    } else {
      actions.appendChild(actionButton("Archive", "archive", () => archiveWord(entry.lemma)));
    }
    actions.appendChild(actionButton("Delete", "delete", () => deleteWord(entry.lemma)));
    row.appendChild(actions);

    return row;
  }

  function renderRows(rows: WordEntry[], trackerEmpty: boolean): void {
    listEl.textContent = "";
    if (trackerEmpty) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No words yet. Select words on pages — meetings are counted automatically.";
      listEl.appendChild(p);
      return;
    }
    if (rows.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Nothing found.";
      listEl.appendChild(p);
      return;
    }
    for (const entry of rows) {
      listEl.appendChild(buildWordRow(entry));
    }
  }

  function renderPagination(result: WordListResult): void {
    paginationEl.textContent = "";
    if (result.pageCount <= 1) return;
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "‹ Prev";
    prev.disabled = result.page <= 1;
    prev.addEventListener("click", () => {
      trackerState.page = result.page - 1;
      renderTracker();
    });
    const label = document.createElement("span");
    label.textContent = "Page " + result.page + " of " + result.pageCount;
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Next ›";
    next.disabled = result.page >= result.pageCount;
    next.addEventListener("click", () => {
      trackerState.page = result.page + 1;
      renderTracker();
    });
    paginationEl.appendChild(prev);
    paginationEl.appendChild(label);
    paginationEl.appendChild(next);
  }

  function renderTracker(): void {
    const entries = Object.values(trackerState.data.words);
    // The summary line stays about the whole collection; the chip counts
    // describe the CURRENT search result set (query applied, all statuses).
    const allCounts = countByStatus(entries);
    const counts = countByStatus(filterByQuery(entries, trackerState.query));

    summaryEl.textContent =
      entries.length + " word" + (entries.length === 1 ? "" : "s") + " · " + allCounts.ready + " ready to learn";

    chipsEl.textContent = "";
    for (const chip of CHIPS) {
      const n = chip.filter === "all" ? counts.all : counts[chip.filter];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (trackerState.filter === chip.filter ? " active" : "");
      btn.textContent = chip.label + " (" + n + ")";
      btn.addEventListener("click", () => {
        trackerState.filter = chip.filter;
        trackerState.page = 1;
        renderTracker();
      });
      chipsEl.appendChild(btn);
    }

    sortCountBtn.classList.toggle("active", trackerState.sort === "count");
    sortRecentBtn.classList.toggle("active", trackerState.sort === "lastSeen");

    const result = listWords(entries, {
      statusFilter: trackerState.filter,
      query: trackerState.query,
      sort: trackerState.sort,
      page: trackerState.page,
    });
    trackerState.page = result.page; // clamp the page if it overflowed

    renderRows(result.rows, entries.length === 0);
    renderPagination(result);
  }

  thresholdInput.addEventListener("change", () => {
    const clamped = clampThreshold(Number(thresholdInput.value));
    thresholdInput.value = String(clamped);
    trackerState.settings = { schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: clamped };
    (async () => {
      try {
        await writeTrackerSettings(trackerState.settings);
        applyThreshold(trackerState.data, clamped);
        await writeTracker(trackerState.data);
      } catch (err) {
        // storage unavailable — the in-memory view still updates
      }
      renderTracker();
    })();
  });

  searchInput.addEventListener("input", () => {
    trackerState.query = searchInput.value;
    trackerState.page = 1;
    renderTracker();
  });

  sortCountBtn.addEventListener("click", () => {
    trackerState.sort = "count";
    trackerState.page = 1;
    renderTracker();
  });

  sortRecentBtn.addEventListener("click", () => {
    trackerState.sort = "lastSeen";
    trackerState.page = 1;
    renderTracker();
  });

  async function initTabsAndTracker(): Promise<void> {
    try {
      const [snapshot, data, settings] = await Promise.all([
        chrome.storage.local.get(null),
        readTracker(),
        readTrackerSettings()
      ]);
      // Default tab, decided once from the storage snapshot: with a stored
      // API key the user lands on the word tracker, otherwise on AI settings.
      activateTab(hasAnyStoredKey(snapshot as StorageSnapshot) ? "tracker" : "ai");
      trackerState.data = data;
      trackerState.settings = settings;
      thresholdInput.value = String(settings.threshold);
    } catch (err) {
      // storage unavailable — keep the defaults and the AI settings tab
      activateTab("ai");
    }
    renderTracker();
  }

  void initTabsAndTracker();
})();
