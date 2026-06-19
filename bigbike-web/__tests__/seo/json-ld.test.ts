import { describe, it, expect } from "vitest";
import type { Product, VideoAsset } from "@/lib/contracts/public";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd,
  buildVideoObjectsJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

// Kiểm thử bản dựng JSON-LD của PDP (checklist SEO #22 — phiên bản lặp lại được
// của Rich Results Test, không phụ thuộc URL công khai). Bảo đảm Product / Offer /
// AggregateRating / weight / positiveNotes / BreadcrumbList / FAQPage / VideoObject
// đúng cấu trúc schema.org VÀ các field nhạy cảm chỉ phát sinh khi có dữ liệu thật.

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    sku: "SKU-001",
    slug: "ao-giap-moto-abc",
    name: "Áo giáp mô tô ABC",
    shortDescription: "Áo giáp bảo hộ cho người đi mô tô.",
    category: { id: "c1", slug: "ao-giap", name: "Áo giáp" },
    brand: { id: "b1", slug: "abc", name: "ABC" },
    image: { url: "https://cdn/main.jpg", alt: "Áo giáp ABC" },
    gallery: [
      { mediaType: "image", image: { url: "https://cdn/g1.jpg" } },
      { mediaType: "image", image: { url: "https://cdn/main.jpg" } },
    ],
    price: { retailPrice: 1_000_000, salePrice: 800_000, currency: "VND" },
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "NONE",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
    ...overrides,
  };
}

describe("buildProductJsonLd", () => {
  it("sinh Product hợp lệ với offer, ảnh khử trùng, ưu/nhược", () => {
    const product = makeProduct({
      variants: [
        {
          id: "v1",
          name: "Đỏ",
          options: [{ name: "Màu", value: "Đỏ" }],
          stockState: "IN_STOCK",
          isAvailable: true,
          image: { url: "https://cdn/variant-red.jpg" },
        },
      ],
      rating: 4.5,
      ratingCount: 12,
      positiveNotes: [{ content: "Nhẹ" }, { content: "Thoáng khí" }],
      negativeNotes: [{ content: "Giá cao" }],
    });

    const ld = buildProductJsonLd(product) as Record<string, any>;

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("Áo giáp mô tô ABC");
    expect(ld.sku).toBe("SKU-001");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "ABC" });
    expect(ld.url).toContain("/product/ao-giap-moto-abc/");

    // Ảnh: main + gallery + variant, khử trùng theo URL (main.jpg lặp 1 lần).
    expect(ld.image).toEqual([
      "https://cdn/main.jpg",
      "https://cdn/g1.jpg",
      "https://cdn/variant-red.jpg",
    ]);

    // Offer: lấy giá KHUYẾN MÃI khi có, đơn vị VND, còn hàng → InStock.
    expect(ld.offers).toMatchObject({
      "@type": "Offer",
      price: 800_000,
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    });

    // AggregateRating khai vì ratingCount > 0.
    expect(ld.aggregateRating).toMatchObject({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 12,
    });

    // positiveNotes / negativeNotes → ItemList có position tăng dần.
    expect(ld.positiveNotes["@type"]).toBe("ItemList");
    expect(ld.positiveNotes.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Nhẹ" },
      { "@type": "ListItem", position: 2, name: "Thoáng khí" },
    ]);
    expect(ld.negativeNotes.itemListElement).toHaveLength(1);
  });

  it("dùng giá bán lẻ khi không có giá khuyến mãi", () => {
    const ld = buildProductJsonLd(
      makeProduct({ price: { retailPrice: 500_000, currency: "VND" } }),
    ) as Record<string, any>;
    expect(ld.offers.price).toBe(500_000);
  });

  it("map tồn kho hết hàng → OutOfStock", () => {
    const ld = buildProductJsonLd(makeProduct({ stockState: "OUT_OF_STOCK" })) as Record<string, any>;
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("KHÔNG khai aggregateRating khi chưa có review thật (chống khai khống #23)", () => {
    expect((buildProductJsonLd(makeProduct({ rating: 0, ratingCount: 0 })) as any).aggregateRating).toBeUndefined();
    expect((buildProductJsonLd(makeProduct({ rating: 4, ratingCount: 0 })) as any).aggregateRating).toBeUndefined();
    expect((buildProductJsonLd(makeProduct({ ratingCount: null })) as any).aggregateRating).toBeUndefined();
  });

  it("bỏ field rỗng khi thiếu dữ liệu GĐ3 (ưu/nhược)", () => {
    const ld = buildProductJsonLd(
      makeProduct({ positiveNotes: [], negativeNotes: [] }),
    ) as Record<string, any>;
    expect(ld.positiveNotes).toBeUndefined();
    expect(ld.negativeNotes).toBeUndefined();
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("ưu tiên thương hiệu: Trang chủ → Thương hiệu → Sản phẩm", () => {
    const ld = buildBreadcrumbJsonLd(makeProduct()) as Record<string, any>;
    expect(ld["@type"]).toBe("BreadcrumbList");
    const names = ld.itemListElement.map((i: any) => i.name);
    expect(names).toEqual(["Trang chủ", "ABC", "Áo giáp mô tô ABC"]);
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2, 3]);
  });

  it("dùng danh mục khi không có thương hiệu", () => {
    const ld = buildBreadcrumbJsonLd(makeProduct({ brand: undefined })) as Record<string, any>;
    expect(ld.itemListElement.map((i: any) => i.name)).toEqual([
      "Trang chủ",
      "Áo giáp",
      "Áo giáp mô tô ABC",
    ]);
  });

  it("bỏ qua danh mục 'chua-phan-loai' khi không có thương hiệu", () => {
    const ld = buildBreadcrumbJsonLd(
      makeProduct({ brand: undefined, category: { id: "c0", slug: "chua-phan-loai", name: "Chưa phân loại" } }),
    ) as Record<string, any>;
    expect(ld.itemListElement.map((i: any) => i.name)).toEqual(["Trang chủ", "Áo giáp mô tô ABC"]);
  });
});

describe("buildFaqPageJsonLd", () => {
  it("sinh FAQPage với Question/Answer", () => {
    const ld = buildFaqPageJsonLd([
      { question: "Bảo hành bao lâu?", answer: "12 tháng." },
      { question: "Có ship không?", answer: "Toàn quốc." },
    ]) as Record<string, any>;
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Bảo hành bao lâu?",
      acceptedAnswer: { "@type": "Answer", text: "12 tháng." },
    });
  });

  it("trả object rỗng (không khai schema) khi không có FAQ", () => {
    expect(buildFaqPageJsonLd([])).toEqual({});
  });
});

describe("buildVideoObjectsJsonLd", () => {
  const product = makeProduct();

  it("YouTube → embedUrl; mô tả lấy từ video.description; uploadDate = ngày tạo SP", () => {
    const videos: VideoAsset[] = [
      {
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Đánh giá",
        description: "Cận cảnh áo giáp.",
        thumbnail: { url: "https://cdn/thumb.jpg" },
      },
    ];
    const [ld] = buildVideoObjectsJsonLd(videos, product) as Record<string, any>[];
    expect(ld["@type"]).toBe("VideoObject");
    expect(ld.name).toBe("Đánh giá");
    expect(ld.description).toBe("Cận cảnh áo giáp.");
    expect(ld.embedUrl).toBe("https://www.youtube.com/embed/abcdefghijk");
    expect(ld.contentUrl).toBeUndefined();
    expect(ld.thumbnailUrl).toEqual(["https://cdn/thumb.jpg"]);
    expect(ld.uploadDate).toBe("2026-06-01T00:00:00Z");
  });

  it("video tải lên (không phải YouTube) → contentUrl; thiếu thumbnail thì lấy ảnh SP", () => {
    const [ld] = buildVideoObjectsJsonLd(
      [{ url: "https://cdn/clip.mp4", title: "Clip" }],
      product,
    ) as Record<string, any>[];
    expect(ld.embedUrl).toBeUndefined();
    expect(ld.contentUrl).toBe("https://cdn/clip.mp4");
    expect(ld.thumbnailUrl).toEqual(["https://cdn/main.jpg"]); // fallback ảnh chính SP
  });

  it("bỏ qua video không có URL và video không có thumbnail nào khả dụng", () => {
    const bare = makeProduct({ image: undefined, gallery: [] });
    expect(buildVideoObjectsJsonLd([{ title: "Không URL" }], bare)).toEqual([]);
    expect(buildVideoObjectsJsonLd([{ url: "https://cdn/x.mp4" }], bare)).toEqual([]);
  });
});

describe("serializeJsonLd", () => {
  it("escape các ký tự phá HTML để chống injection trong <script>", () => {
    const out = serializeJsonLd({ name: '</script><b>&"x"' });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
    expect(out).toContain("\\u0026");
  });
});
