/**
 * Gemini streaming adapter (MULTI_PROVIDER.md §4): POST the registry's
 * chatEndpoint pattern (the literal "<model>" is replaced with the
 * URL-encoded model id; ?alt=sse selects the SSE format) with header
 * x-goog-api-key (NO Bearer), body {contents, generationConfig:{temperature,
 * maxOutputTokens}}. Emits candidates[0].content.parts[*].text joined per
 * chunk; the chunk carrying candidates[0].finishReason ends the stream.
 *
 * The per-line SSE classification lives in the PURE parseGeminiSseLine so
 * vitest can test it offline; the read loop below is its only caller.
 */

/** One raw SSE line of a Gemini stream, classified. */
export interface GeminiSseLine {
  kind: "chunk" | "done" | "ignore";
  text: string; // the joined parts text when kind is "chunk"/"done", "" otherwise
}

/**
 * Classify one raw SSE line:
 *  - "data:" JSON payload: join all candidates[0].content.parts[*].text;
 *    if candidates[0].finishReason is present -> done (text preserved,
 *    possibly empty); else if the joined text is non-empty -> chunk;
 *  - no candidates / no parts / invalid/partial JSON / non-data lines
 *    -> ignore
 */
export function parseGeminiSseLine(line: string): GeminiSseLine {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return { kind: "ignore", text: "" };
  const payload = trimmed.slice(5).trim();
  if (!payload) return { kind: "ignore", text: "" };
  let json: any = null;
  try {
    json = JSON.parse(payload);
  } catch (err) {
    return { kind: "ignore", text: "" }; // partial JSON split across network chunks — skip
  }
  const candidate =
    json && json.candidates && json.candidates[0] ? json.candidates[0] : null;
  if (!candidate) return { kind: "ignore", text: "" };
  const parts =
    candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts
      : [];
  const text = parts
    .map((p: any) => (p && typeof p.text === "string" ? p.text : ""))
    .join("");
  if (candidate.finishReason !== undefined && candidate.finishReason !== null) {
    return { kind: "done", text: text };
  }
  if (text.length > 0) return { kind: "chunk", text: text };
  return { kind: "ignore", text: "" };
}

/**
 * POST the endpoint pattern (with "<model>" replaced by the encoded
 * model id) and feed joined text parts to onChunk(text). Resolves on the
 * chunk carrying finishReason. Throws Error with a readable message on
 * HTTP/API/stream failures.
 */
export async function streamGemini(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const url = endpoint.replace("<model>", encodeURIComponent(model));
  const host = new URL(url).hostname;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
      })
    });
  } catch (err: any) {
    // Network-level failure (DNS, CORS/permission block, timeout). Keep the
    // browser's own message — it distinguishes the cases in devtools and UI.
    const raw = String(err && err.message ? err.message : err);
    throw new Error("could not reach " + host + " — " + raw);
  }

  if (!response.ok) {
    let detail = "HTTP " + response.status;
    try {
      const data = await response.json();
      if (data && data.error && data.error.message) detail = data.error.message;
      else if (data && (data.message || data.detail)) detail = data.message || data.detail;
    } catch (err) {
      // keep the HTTP status as the detail
    }
    throw new Error(detail);
  }
  if (!response.body) {
    throw new Error("empty response stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    buffer += decoder.decode(step.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() as string; // keep the incomplete tail for the next chunk
    for (const rawLine of lines) {
      const parsed = parseGeminiSseLine(rawLine);
      if (parsed.kind === "done") {
        if (parsed.text.length > 0) onChunk(parsed.text);
        return;
      }
      if (parsed.kind === "chunk") onChunk(parsed.text);
    }
  }
}
