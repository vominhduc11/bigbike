/**
 * SSR-safe `localStorage` access with JSON (de)serialization.
 *
 * Centralizes the `typeof window === "undefined"` guard and the try/catch JSON
 * parse that was repeated across the storage modules. Returns the fallback on
 * the server, when the key is absent, or on any parse/quota failure — never
 * throws.
 *
 * Callers that need extra invariants on the parsed value (e.g. an Array.isArray
 * check, a length cap, or an element-type filter) must apply them to the result;
 * this helper only handles the storage + JSON boundary.
 */
export const safeStorage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage errors (private mode, quota exceeded, …)
    }
  },
};
