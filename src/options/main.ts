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
})();
