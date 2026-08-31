const SAFE_RETURN_ORIGIN = "https://bigbike.invalid";

/**
 * Guard against open redirects. A return destination must remain an ordinary
 * same-origin path even after URL decoding, so protocol-relative and backslash
 * variants cannot be interpreted as external URLs by a browser.
 */
export function isSafeReturnTo(url: string): boolean {
  if (!url || !url.startsWith("/") || url.startsWith("//") || /[\\\u0000-\u001F]/.test(url)) {
    return false;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return false;
  }

  if (decoded.startsWith("//") || decoded.includes("\\")) return false;

  try {
    return new URL(url, SAFE_RETURN_ORIGIN).origin === SAFE_RETURN_ORIGIN;
  } catch {
    return false;
  }
}
