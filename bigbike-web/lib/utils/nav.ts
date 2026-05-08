const DANGEROUS_SCHEMES = ["javascript:", "vbscript:", "data:"];

export function normalizeMenuUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return "/";
  const lower = trimmed.toLowerCase();
  if (DANGEROUS_SCHEMES.some((s) => lower.startsWith(s))) return "/";

  // Extract just the pathname from absolute URLs so active-state logic works correctly.
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname;
      return path.endsWith("/") || path.includes("?") || path.includes("#")
        ? path
        : path + "/";
    } catch {
      return "/";
    }
  }

  if (
    trimmed.startsWith("/") &&
    !trimmed.endsWith("/") &&
    !trimmed.includes("?") &&
    !trimmed.includes("#")
  ) {
    return trimmed + "/";
  }
  return trimmed;
}

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // Only relative paths (starting with /) can match Next.js pathname.
  if (!href.startsWith("/")) return false;
  if (href === "/" || href === "") return pathname === "/";
  const base = href.endsWith("/") ? href.slice(0, -1) : href;
  return pathname === base || pathname.startsWith(`${base}/`);
}
