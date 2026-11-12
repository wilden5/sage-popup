/**
 * Anthropic streaming adapter (MULTI_PROVIDER.md §4): POST <endpoint>
 * (https://api.anthropic.com/v1/messages) with headers x-api-key +
 * anthropic-version: 2023-06-01, body {model, max_tokens, temperature,
 * stream: true, messages}. Emits text ONLY from content_block_delta events
 * where delta.type === "text_delta"; thinking_delta and everything else
 * are ignored, never rendered. Done on message_stop.
 *
 * The per-line SSE classification lives in the PURE parseAnthropicSseLine
 * so vitest can test it offline; the read loop below is its only caller.
 */

/** One raw SSE line of an Anthropic stream, classified. */
export interface AnthropicSseLine {
  kind: "chunk" | "done" | "ignore";
  text: string; // the text delta when kind === "chunk", "" otherwise
}

/**
 * Classify one raw SSE line:
 *  - "data:" payload with type "content_block_delta" and
 *    delta.type === "text_delta"             -> chunk with delta.text
 *  - any other delta.type (thinking_delta etc.) -> ignore
 *  - "data:" payload with type "message_stop" -> done
 *  - "event: ..." lines, empty payloads, invalid/partial JSON -> ignore
 */
export function parseAnthropicSseLine(line: string): AnthropicSseLine {
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
  if (!json || typeof json.type !== "string") return { kind: "ignore", text: "" };
  if (json.type === "message_stop") return { kind: "done", text: "" };
  if (json.type === "content_block_delta") {
    const delta = json.delta;
    if (delta && delta.type === "text_delta" && typeof delta.text === "string" && delta.text.length > 0) {
      return { kind: "chunk", text: delta.text };
    }
    return { kind: "ignore", text: "" }; // thinking_delta and everything else
  }
  return { kind: "ignore", text: "" }; // message_start, ping, etc.
}

/**
 * POST <endpoint> with stream:true and feed text deltas to onChunk(text).
 * Resolves on message_stop. Throws Error with a readable message on
 * HTTP/API/stream failures.
 */
export async function streamAnthropic(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const host = new URL(endpoint).hostname;
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 400, // REQUIRED by the Anthropic API
        temperature: 0.2,
        stream: true,
        messages: [{ role: "user", content: prompt }]
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
      const parsed = parseAnthropicSseLine(rawLine);
      if (parsed.kind === "done") return;
      if (parsed.kind === "chunk") onChunk(parsed.text);
    }
  }
}
