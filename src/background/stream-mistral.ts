export const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
export const MISTRAL_MODELS_URL = "https://api.mistral.ai/v1/models";
const AI_MODEL = "mistral-small-latest";

/**
 * POST /v1/chat/completions with stream:true and feed content deltas to
 * onChunk(text). Resolves when the stream ends with data: [DONE].
 * Throws Error with a readable message on HTTP/API/stream failures.
 */
export async function streamMistral(
  apiKey: string,
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  let response;
  try {
    response = await fetch(MISTRAL_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: AI_MODEL,
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
    throw new Error("could not reach api.mistral.ai — " + raw);
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
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      let json: any = null;
      try {
        json = JSON.parse(payload);
      } catch (err) {
        continue; // partial JSON split across network chunks — skip
      }
      const delta = json.choices && json.choices[0] && json.choices[0].delta;
      if (delta && delta.content) onChunk(delta.content);
    }
  }
}
