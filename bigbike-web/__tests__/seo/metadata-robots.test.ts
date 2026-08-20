import { describe, expect, it } from "vitest";

import { buildPublicMetadata } from "@/lib/seo/metadata";

/**
 * Trước 2026-08-06 KHÔNG có một test nào truy vấn thẻ robots ở bất kỳ đâu — đúng lý do
 * các lỗ noindex trong báo cáo audit tồn tại lâu mà không ai thấy.
 *
 * Rule liên quan: BUSINESS_RULES `SEO_RULE_001` (cờ tách theo ngôn ngữ) và `SEO_RULE_002`
 * (ngưỡng đủ nội dung EN). Backend đã resolve sẵn hai tầng đó vào `seo.noIndex` theo `lang`;
 * ở web việc còn lại chỉ là truyền đúng cờ vào đây.
 */
const base = {
  title: "Mũ bảo hiểm",
  description: "Mô tả",
  canonicalPath: "/product/mu-bao-hiem/",
} as const;

describe("buildPublicMetadata — thẻ robots", () => {
  it("KHÔNG phát thẻ robots khi cho phép hiển thị (mặc định của Google là index)", () => {
    expect(buildPublicMetadata(base).robots).toBeUndefined();
    expect(buildPublicMetadata({ ...base, noIndex: false }).robots).toBeUndefined();
  });

  it("phát noindex, follow khi tắt hiển thị", () => {
    // follow: true có chủ ý — trang bị ẩn vẫn nên truyền link cho các trang còn hiển thị.
    expect(buildPublicMetadata({ ...base, noIndex: true }).robots).toEqual({
      index: false,
      follow: true,
    });
  });
});

describe("buildPublicMetadata — canonical và hreflang", () => {
  it("canonical luôn tự sinh từ đường dẫn truyền vào (SEO_RULE_003), không đọc từ dữ liệu admin", () => {
    const metadata = buildPublicMetadata(base);
    expect(metadata.alternates?.canonical).toMatch(/\/product\/mu-bao-hiem\/$/);
  });

  it("không khai hreflang khi không truyền languageAlternates", () => {
    expect(buildPublicMetadata(base).alternates?.languages).toBeUndefined();
  });

  it("khai đủ vi/en/x-default khi có bản dịch, x-default trỏ về bản tiếng Việt", () => {
    const metadata = buildPublicMetadata({
      ...base,
      languageAlternates: { vi: "/product/mu-bao-hiem/", en: "/en/product/helmet/" },
    });

    expect(metadata.alternates?.languages).toMatchObject({
      vi: expect.stringContaining("/product/mu-bao-hiem/"),
      en: expect.stringContaining("/en/product/helmet/"),
      "x-default": expect.stringContaining("/product/mu-bao-hiem/"),
    });
  });

  it("trang bị ẩn mà vẫn khai hreflang là tín hiệu mâu thuẫn — các trang chi tiết phải bỏ alternates", () => {
    // buildPublicMetadata cố ý KHÔNG tự bỏ: quyết định nằm ở trang gọi nó, vì trang còn phải
    // biết bản ngôn ngữ kia có được hiển thị hay không. Test này khoá đúng hợp đồng đó —
    // truyền vào thì nó vẫn phát, nên caller có trách nhiệm không truyền.
    const metadata = buildPublicMetadata({
      ...base,
      noIndex: true,
      languageAlternates: { vi: "/product/mu-bao-hiem/", en: "/en/product/helmet/" },
    });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.languages).toBeDefined();
  });
});

describe("buildPublicMetadata — Open Graph locale", () => {
  it("mặc định là vi_VN, chuyển sang en_US khi locale=en", () => {
    expect(buildPublicMetadata(base).openGraph).toMatchObject({
      locale: "vi_VN",
      alternateLocale: ["en_US"],
    });
    expect(buildPublicMetadata({ ...base, locale: "en" }).openGraph).toMatchObject({
      locale: "en_US",
      alternateLocale: ["vi_VN"],
    });
  });
});

describe("buildPublicMetadata — tiêu đề và ảnh tuyệt đối", () => {
  it("không lặp tên shop khi tiêu đề do admin đã có BigBike", () => {
    const metadata = buildPublicMetadata({
      ...base,
      title: "Mũ bảo hiểm | BigBike | BigBike",
    });
    expect(metadata.title).toEqual({ absolute: "Mũ bảo hiểm | BigBike" });
    expect(metadata.openGraph?.title).toBe("Mũ bảo hiểm | BigBike");
  });

  it("chỉ phát ảnh chia sẻ khi có cấu hình và chuyển ảnh tương đối thành URL đầy đủ", () => {
    expect(buildPublicMetadata(base).openGraph?.images).toBeUndefined();
    const metadata = buildPublicMetadata({ ...base, ogImage: "/media/share.jpg" });
    const openGraphImages = metadata.openGraph?.images;
    const openGraphImage = Array.isArray(openGraphImages) ? openGraphImages[0] : openGraphImages;
    const twitterImages = metadata.twitter?.images;
    const twitterImage = Array.isArray(twitterImages) ? twitterImages[0] : twitterImages;
    expect(openGraphImage).toMatchObject({ url: expect.stringMatching(/^https?:\/\//) });
    expect(twitterImage).toMatch(/^https?:\/\//);
  });
});

describe("buildPublicMetadata — mô tả chữ thuần", () => {
  it("loại HTML/chat widget khỏi fallback và giới hạn ở 165 ký tự", () => {
    const metadata = buildPublicMetadata({
      ...base,
      description: "<p>Mô tả sản phẩm</p><div id=\"messageView\"><div class=\"chat-message\">Không đưa vào SEO</div></div> "
        + "Nội dung bổ sung đủ dài để kiểm tra giới hạn từ và không phát nguyên mã HTML.",
    });

    expect(metadata.description).not.toContain("<p>");
    expect(metadata.description).not.toContain("Không đưa vào SEO");
    expect(metadata.description?.length).toBeLessThanOrEqual(165);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.description).toBe(metadata.description);
  });
});
