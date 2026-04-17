const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_REQUEST_GAP_MS = 500;

interface CacheEntry {
  html: string;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
let lastRequestAt = 0;

export async function fetchPage(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.html;
  }

  const gap = Date.now() - lastRequestAt;
  if (gap < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - gap));
  }

  lastRequestAt = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": "rcmcp/0.1.0" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();
  cache.set(url, { html, fetchedAt: Date.now() });
  return html;
}
