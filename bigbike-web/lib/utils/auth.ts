/**
 * Guard against open-redirect: only accept same-origin paths.
 * Rejects absolute URLs, protocol-relative URLs (//evil.com), and empty strings.
 */
export function isSafeReturnTo(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}
