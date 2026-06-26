const DANGEROUS_SCHEMES = ["javascript:", "vbscript:", "data:"];

export function normalizeMenuUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return "/";
  const lower = trimmed.toLowerCase();
  if (DANGEROUS_SCHEMES.some((s) => lower.startsWith(s))) return "/";

  // Extract just the pathname from absolute URLs so active-state logic works correctly.
  let path = trimmed;
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      path = parsed.pathname;
    } catch {
      return "/";
    }
  }

  // Chuẩn hóa và map các URL cũ sang URL tĩnh mới để tránh 404
  let normalizedPath = path;
  if (normalizedPath.startsWith("/")) {
    // Loại bỏ trailing slash và .html để so khớp
    const cleanPath = normalizedPath.replace(/\/$/, "").replace(/\.html$/, "");
    
    if (cleanPath === "/chinh-sach/bao-mat") {
      normalizedPath = "/chinh-sach/chinh-sach-bao-mat-thong-tin/";
    } else if (cleanPath === "/chinh-sach/bao-hanh") {
      normalizedPath = "/chinh-sach/chinh-sach-bao-hanh/";
    } else if (cleanPath === "/chinh-sach/doi-tra") {
      normalizedPath = "/chinh-sach/chinh-sach-doi-tra-hang/";
    }
  }

  if (
    normalizedPath.startsWith("/") &&
    !normalizedPath.endsWith("/") &&
    !normalizedPath.includes("?") &&
    !normalizedPath.includes("#")
  ) {
    return normalizedPath + "/";
  }
  return normalizedPath;
}

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // Only relative paths (starting with /) can match Next.js pathname.
  if (!href.startsWith("/")) return false;
  if (href === "/" || href === "") return pathname === "/";
  const base = href.endsWith("/") ? href.slice(0, -1) : href;
  return pathname === base || pathname.startsWith(`${base}/`);
}
