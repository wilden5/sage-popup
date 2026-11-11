(() => {
  "use strict";

  const MISTRAL_ORIGIN = "https://api.mistral.com/*";
  const input = document.getElementById("key");
  const status = document.getElementById("status");
  const perm = document.getElementById("perm");
  const grantBtn = document.getElementById("grant");

  function setStatus(text, cls) {
    status.textContent = text;
    status.className = cls || "";
  }

  function setPerm(text, cls) {
    perm.textContent = text;
    perm.className = cls || "";
  }

  // chrome.permissions returns promises in Firefox and callbacks in Chrome —
  // support both shapes.
  function permCall(method, args) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
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

  const hasAccess = () => permCall("contains", { origins: [MISTRAL_ORIGIN] });
  const requestAccess = () => permCall("request", { origins: [MISTRAL_ORIGIN] });

  function refreshPerm() {
    return hasAccess().then((granted) => {
      if (granted) {
        setPerm("✓ Access to api.mistral.com granted", "ok");
      } else {
        setPerm("✗ No access to api.mistral.com — click “Grant access”", "err");
      }
      grantBtn.style.display = granted ? "none" : "inline-block";
      return granted;
    });
  }

  // Show the key stored in the browser (if any).
  chrome.storage.local
    .get("mistralApiKey")
    .then((data) => {
      if (data && data.mistralApiKey) {
        input.value = data.mistralApiKey;
        setStatus("Your key is saved.", "ok");
      }
    })
    .catch(() => {});

  refreshPerm();

  document.getElementById("save").addEventListener("click", () => {
    const key = input.value.trim();
    chrome.storage.local
      .set({ mistralApiKey: key })
      .then(() => setStatus(key ? "Saved." : "Saved (key cleared — AI disabled).", "ok"))
      .catch(() => setStatus("Could not save — storage error.", "err"));
  });

  // Explicit host-permission grant (needed in Firefox, one click in Chrome).
  grantBtn.addEventListener("click", () => {
    requestAccess().then((granted) => {
      refreshPerm();
      if (granted) {
        setStatus("Access granted. You can test the key now.", "ok");
      } else {
        setStatus(
          "Access was not granted. Firefox: about:addons → Oxford Popup → «Разрешения и данные» → enable api.mistral.com.",
          "err"
        );
      }
    });
  });

  document.getElementById("test").addEventListener("click", () => {
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
        setStatus("No access to api.mistral.com — the browser blocks the request. Click “Grant access”.", "err");
        return;
      }
      try {
        const res = await chrome.runtime.sendMessage({ type: "oxford-test-key", key });
        if (res && res.ok) setStatus("Key works — the AI is ready.", "ok");
        else setStatus("Mistral says: " + ((res && res.message) || "unknown error"), "err");
      } catch (err) {
        setStatus("Could not reach the background script.", "err");
      }
    });
  });
})();
