const store = new Map();
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

// Only successful Gemini responses get cached (see call sites) — a failed
// call should retry fresh next time, not lock in a fallback for an hour.
export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCached(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
