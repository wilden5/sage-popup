/**
 * Generic OpenAI-compatible streaming adapter (MULTI_PROVIDER.md §4):
 * mistral / openai / groq / openrouter / deepseek / xai all speak this
 * protocol — Bearer auth, body {model, stream, temperature, max_tokens},
 * SSE lines "data: ..." + "[DONE]".
 *
 * POST <endpoint> with stream:true and feed content deltas to onChunk(text).
 * Resolves when the stream ends with data: [DONE]. Throws Error with a
 * readable message on HTTP/API/stream failures.
 *
 * The per-line SSE classification lives in the PURE parseOpenAiSseLine so
 * vitest can test it offline; the read loop below is its only caller.
 */

/** One raw SSE line of an OpenAI-compatible stream, classified. */
export interface OpenAiSseLine {
  kind: "chunk" | "done" | "ignore";
  text: string; // the content delta when kind === "chunk", "" otherwise
}

/**
 * Classify one raw SSE line:
 *  - "data: [DONE]"                          -> done
 *  - JSON payload with choices[0].delta.content (non-empty string)
 *                                            -> chunk with that text
 *  - reasoning fields (delta.reasoning_content, delta.reasoning) and every
 *    other delta field                       -> ignore (never rendered)
 *  - non-data lines, empty payloads, invalid/partial JSON -> ignore
 */
export function parseOpenAiSseLine(line: string): OpenAiSseLine {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return { kind: "ignore", text: "" };
  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return { kind: "done", text: "" };
  if (!payload) return { kind: "ignore", text: "" };
  let json: any = null;
  try {
    json = JSON.parse(payload);
  } catch (err) {
    return { kind: "ignore", text: "" }; // partial JSON split across network chunks — skip
  }
  const delta = json && json.choices && json.choices[0] && json.choices[0].delta;
  if (delta && typeof delta.content === "string" && delta.content.length > 0) {
    return { kind: "chunk", text: delta.content };
  }
  return { kind: "ignore", text: "" };
}

/**
 * POST <endpoint> with stream:true and feed content deltas to
 * onChunk(text). Resolves when the stream ends with data: [DONE].
 * Throws Error with a readable message on HTTP/API/stream failures.
 */
export async function streamOpenAi(
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
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        stream: true,
        temperature: 0.2,
        max_tokens: 400,
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
      if (data && (data.message || data.detail)) detail = data.message || data.detail;
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
      const parsed = parseOpenAiSseLine(rawLine);
      if (parsed.kind === "done") return;
      if (parsed.kind === "chunk") onChunk(parsed.text);
    }
  }
}
