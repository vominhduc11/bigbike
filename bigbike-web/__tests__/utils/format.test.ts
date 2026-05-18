import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatVnd,
  isSafeHomeVideoUrl,
  isSafePublicHref,
  isValidVnPhone,
  resolveMediaUrl,
  safeText,
  toSafePublicHref,
} from "@/lib/utils/format";

describe("formatVnd", () => {
  it("formats a positive integer", () => {
    expect(formatVnd(100000)).toBe("100.000 đ");
  });

  it("returns 'Lien he' for null", () => {
    expect(formatVnd(null)).toBe("Liên hệ");
  });

  it("returns 'Lien he' for undefined", () => {
    expect(formatVnd(undefined)).toBe("Liên hệ");
  });

  it("handles zero", () => {
    expect(formatVnd(0)).toBe("0 đ");
  });
});

describe("safeText", () => {
  it("returns fallback for empty string", () => {
    expect(safeText("")).toBe("Đang cập nhật");
  });

  it("returns fallback for null", () => {
    expect(safeText(null)).toBe("Đang cập nhật");
  });

  it("trims whitespace and returns value", () => {
    expect(safeText("  hello  ")).toBe("hello");
  });

  it("accepts custom fallback", () => {
    expect(safeText(null, "N/A")).toBe("N/A");
  });
});

describe("isValidVnPhone", () => {
  it("accepts valid 10-digit VN numbers", () => {
    expect(isValidVnPhone("0901234567")).toBe(true);
    expect(isValidVnPhone("0351234567")).toBe(true);
  });

  it("rejects numbers with wrong prefix", () => {
    expect(isValidVnPhone("0201234567")).toBe(false);
    expect(isValidVnPhone("1234567890")).toBe(false);
  });

  it("rejects numbers with wrong length", () => {
    expect(isValidVnPhone("090123456")).toBe(false);
    expect(isValidVnPhone("09012345678")).toBe(false);
  });
});

describe("resolveMediaUrl", () => {
  it("proxies CDN URLs to /wp-content/uploads/", () => {
    const url = "https://cdn.bigbike.vn/uploads/2024/01/image.jpg";
    expect(resolveMediaUrl(url)).toBe("/wp-content/uploads/2024/01/image.jpg");
  });

  it("rewrites absolute bigbike wp-content uploads to same-origin paths", () => {
    const url = "https://bigbike.vn/wp-content/uploads/2024/05/video-thumb.jpg?size=large";
    expect(resolveMediaUrl(url)).toBe("/wp-content/uploads/2024/05/video-thumb.jpg?size=large");
  });

  it("returns null/undefined as-is", () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeUndefined();
  });

  it("passes through /media/ relative URLs unchanged", () => {
    expect(resolveMediaUrl("/media/wp-uploads/2024/01/image.jpg")).toBe(
      "/media/wp-uploads/2024/01/image.jpg",
    );
    expect(resolveMediaUrl("/media/uploads/uuid/file.jpg")).toBe(
      "/media/uploads/uuid/file.jpg",
    );
  });

  it("passes through non-CDN URLs unchanged", () => {
    expect(resolveMediaUrl("/local/image.jpg")).toBe("/local/image.jpg");
  });
});

describe("safe public href", () => {
  it("accepts relative links", () => {
    expect(isSafePublicHref("/san-pham.html")).toBe(true);
  });

  it("accepts https absolute links", () => {
    expect(isSafePublicHref("https://bigbike.vn/tai-nghe.html")).toBe(true);
  });

  it("rejects unsafe schemes and protocol-relative URLs", () => {
    expect(isSafePublicHref("javascript:alert(1)")).toBe(false);
    expect(isSafePublicHref("//evil.com")).toBe(false);
  });

  it("falls back when href is unsafe", () => {
    expect(toSafePublicHref("javascript:alert(1)", "/san-pham/")).toBe("/san-pham/");
  });
});

describe("safe home video url", () => {
  it("accepts allowed youtube hosts", () => {
    expect(isSafeHomeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isSafeHomeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("accepts internal media paths", () => {
    expect(isSafeHomeVideoUrl("/media-proxy/uploads/home/video.mp4")).toBe(true);
  });

  it("rejects arbitrary external hosts", () => {
    expect(isSafeHomeVideoUrl("https://evil.com/video.mp4")).toBe(false);
    expect(isSafeHomeVideoUrl("https://evil.com/path/youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    const result = formatDate("2024-01-15T00:00:00Z");
    expect(result).toContain("2024");
  });

  it("returns fallback for null", () => {
    expect(formatDate(null)).toBe("Đang cập nhật");
  });

  it("returns fallback for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("Đang cập nhật");
  });
});
