import { candidatesFor } from "./inflect";
import type { OxfordLookupResponse } from "../shared/types";

export const DEFINITION_URL = "https://www.oxfordlearnersdictionaries.com/definition/english/";
const FETCH_TIMEOUT_MS = 10000;
const CACHE_MAX = 128;
const MAX_CANDIDATES = 8;

const cache = new Map<string, OxfordLookupResponse>();

export async function lookup(rawWord: string): Promise<OxfordLookupResponse> {
  const word = String(rawWord || "").trim();
  if (!word) return { ok: false, error: false, url: "", word };

  const slug = word.toLowerCase().replace(/\s+/g, "-");
  if (cache.has(slug)) return cache.get(slug)!;

  const result: OxfordLookupResponse = { ok: false, error: false, url: definitionUrl(slug), word };
  try {
    for (const candidate of candidatesFor(word).slice(0, MAX_CANDIDATES)) {
      const candSlug = candidate.toLowerCase().replace(/\s+/g, "-");
      const url = definitionUrl(candSlug);
      const response = await fetchWithTimeout(url);
      if (response && response.ok) {
        result.ok = true;
        result.html = await response.text();
        result.url = url;
        break;
      }
    }
  } catch (err) {
    result.error = true; // network failure / timeout
  }

  cache.set(slug, result);
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  return result;
}

export function definitionUrl(slug: string): string {
  return DEFINITION_URL + encodeURIComponent(slug) + "?q=" + encodeURIComponent(slug);
}

export async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "follow"
    });
  } catch (err) {
    return null; // counted as a failed candidate, not a global error
  } finally {
    clearTimeout(timer);
  }
}
