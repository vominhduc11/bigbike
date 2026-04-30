export function normalizeMenuUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return "/";
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
  if (href === "/") return pathname === "/";
  const normalizedHref = href.endsWith("/") ? href.slice(0, -1) : href;
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}
