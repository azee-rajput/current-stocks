// Shared fetch helper: browser-like UA, timeout, and an in-memory TTL cache so
// that many page renders don't hammer the free upstream sources.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

type Entry = { at: number; value: unknown; pending?: Promise<unknown> };
const g = globalThis as unknown as { __pkCache?: Map<string, Entry> };
const cache = (g.__pkCache ??= new Map<string, Entry>());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs && !hit.pending) return hit.value as T;
  if (hit?.pending) return hit.pending as Promise<T>;
  const pending = load()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((err) => {
      // Serve stale data on failure if we have any.
      if (hit && !hit.pending) {
        cache.set(key, { at: hit.at, value: hit.value });
        return hit.value as T;
      }
      cache.delete(key);
      throw err;
    });
  cache.set(key, { at: hit?.at ?? 0, value: hit?.value, pending });
  return pending;
}

export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json,application/xml;q=0.9,*/*;q=0.8" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  return JSON.parse(await fetchText(url, timeoutMs)) as T;
}

/** Run async jobs with a concurrency cap (keeps us polite to upstream sites). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
