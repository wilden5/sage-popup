(() => {
  "use strict";

  const input = document.getElementById("key");
  const status = document.getElementById("status");

  function setStatus(text, cls) {
    status.textContent = text;
    status.className = cls || "";
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

  document.getElementById("save").addEventListener("click", () => {
    const key = input.value.trim();
    chrome.storage.local
      .set({ mistralApiKey: key })
      .then(() => setStatus(key ? "Saved." : "Saved (key cleared — AI disabled).", "ok"))
      .catch(() => setStatus("Could not save — storage error.", "err"));
  });

  document.getElementById("test").addEventListener("click", () => {
    const key = input.value.trim();
    if (!key) {
      setStatus("Paste the key first.", "err");
      return;
    }
    setStatus("Testing…", "");
    chrome.runtime
      .sendMessage({ type: "oxford-test-key", key })
      .then((res) => {
        if (res && res.ok) setStatus("Key works — the AI is ready.", "ok");
        else setStatus("Mistral says: " + ((res && res.message) || "unknown error"), "err");
      })
      .catch(() => setStatus("Could not reach the background script.", "err"));
  });
})();
