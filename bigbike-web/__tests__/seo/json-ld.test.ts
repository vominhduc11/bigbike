import { describe, it, expect } from "vitest";
import type { Article, Product, VideoAsset } from "@/lib/contracts/public";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd,
  buildArticleBreadcrumbJsonLd,
  buildVideoObjectsJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

// Kiểm thử bản dựng JSON-LD của PDP (checklist SEO #22 — phiên bản lặp lại được
// của Rich Results Test, không phụ thuộc URL công khai). Bảo đảm Product / Offer /
// AggregateRating / positiveNotes / BreadcrumbList / FAQPage / VideoObject
// đúng cấu trúc schema.org VÀ các field nhạy cảm chỉ phát sinh khi có dữ liệu thật.

// JSON-LD có cấu trúc động (schema.org) nên builder trả Record<string, unknown>.
// Hai helper ép kiểu từ unknown (KHÔNG dùng any) để truy cập key/phần tử lồng nhau.
const obj = (v: unknown) => v as Record<string, unknown>;
const arr = (v: unknown) => v as Array<Record<string, unknown>>;

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
      positiveNotes: [{ content: "<p><strong>Nhẹ</strong></p>" }, { content: "<p>Thoáng khí</p>" }],
      negativeNotes: [{ content: "Giá cao" }],
    });

    const ld = obj(buildProductJsonLd(product));

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
    expect(obj(ld.positiveNotes)["@type"]).toBe("ItemList");
    expect(obj(ld.positiveNotes).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Nhẹ" },
      { "@type": "ListItem", position: 2, name: "Thoáng khí" },
    ]);
    expect(obj(ld.negativeNotes).itemListElement).toHaveLength(1);
  });

  it("dùng giá bán lẻ khi không có giá khuyến mãi", () => {
    const ld = obj(
      buildProductJsonLd(makeProduct({ price: { retailPrice: 500_000, currency: "VND" } })),
    );
    expect(obj(ld.offers).price).toBe(500_000);
  });

  it("map tồn kho hết hàng → OutOfStock", () => {
    const ld = obj(buildProductJsonLd(makeProduct({ stockState: "OUT_OF_STOCK" })));
    expect(obj(ld.offers).availability).toBe("https://schema.org/OutOfStock");
  });

  it("KHÔNG khai aggregateRating khi chưa có review thật (chống khai khống #23)", () => {
    expect(obj(buildProductJsonLd(makeProduct({ rating: 0, ratingCount: 0 }))).aggregateRating).toBeUndefined();
    expect(obj(buildProductJsonLd(makeProduct({ rating: 4, ratingCount: 0 }))).aggregateRating).toBeUndefined();
    expect(obj(buildProductJsonLd(makeProduct({ ratingCount: null }))).aggregateRating).toBeUndefined();
  });

  it("bỏ field rỗng khi thiếu dữ liệu GĐ3 (ưu/nhược)", () => {
    const ld = obj(buildProductJsonLd(makeProduct({ positiveNotes: [], negativeNotes: [] })));
    expect(ld.positiveNotes).toBeUndefined();
    expect(ld.negativeNotes).toBeUndefined();
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("ưu tiên thương hiệu: Trang chủ → Thương hiệu → Sản phẩm", () => {
    const ld = obj(buildBreadcrumbJsonLd(makeProduct()));
    expect(ld["@type"]).toBe("BreadcrumbList");
    const names = arr(ld.itemListElement).map((i) => i.name);
    expect(names).toEqual(["Trang chủ", "ABC", "Áo giáp mô tô ABC"]);
    expect(arr(ld.itemListElement).map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it("dùng danh mục khi không có thương hiệu", () => {
    const ld = obj(buildBreadcrumbJsonLd(makeProduct({ brand: undefined })));
    expect(arr(ld.itemListElement).map((i) => i.name)).toEqual([
      "Trang chủ",
      "Áo giáp",
      "Áo giáp mô tô ABC",
    ]);
  });

  it("bỏ qua danh mục 'chua-phan-loai' khi không có thương hiệu", () => {
    const ld = obj(buildBreadcrumbJsonLd(
      makeProduct({ brand: undefined, category: { id: "c0", slug: "chua-phan-loai", name: "Chưa phân loại" } }),
    ));
    expect(arr(ld.itemListElement).map((i) => i.name)).toEqual(["Trang chủ", "Áo giáp mô tô ABC"]);
  });
});

describe("English JSON-LD locale", () => {
  it("uses English home/news labels when the canonical route is English", () => {
    const article = {
      id: "article-1",
      slug: "bai-viet-1",
      title: "English article",
      body: "Article body",
      publishStatus: "PUBLISHED",
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    } as Article;
    const ld = obj(buildArticleBreadcrumbJsonLd(article, "/en/news/english-article/"));
    const names = arr(ld.itemListElement).map((item) => item.name);

    expect(names).toEqual(["Home", "News", "English article"]);
  });
});

describe("buildFaqPageJsonLd", () => {
  it("sinh FAQPage với Question/Answer", () => {
    const ld = obj(buildFaqPageJsonLd([
      { question: "Bảo hành bao lâu?", answer: "12 tháng." },
      { question: "Có ship không?", answer: "Toàn quốc." },
    ]));
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(2);
    expect(arr(ld.mainEntity)[0]).toMatchObject({
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
    const ld = obj(buildVideoObjectsJsonLd(videos, product)[0]);
    expect(ld["@type"]).toBe("VideoObject");
    expect(ld.name).toBe("Đánh giá");
    expect(ld.description).toBe("Cận cảnh áo giáp.");
    expect(ld.embedUrl).toBe("https://www.youtube.com/embed/abcdefghijk");
    expect(ld.contentUrl).toBeUndefined();
    expect(ld.thumbnailUrl).toEqual(["https://cdn/thumb.jpg"]);
    expect(ld.uploadDate).toBe("2026-06-01T00:00:00Z");
  });

  it("video tải lên (không phải YouTube) → contentUrl; thiếu thumbnail thì lấy ảnh SP", () => {
    const ld = obj(buildVideoObjectsJsonLd([{ url: "https://cdn/clip.mp4", title: "Clip" }], product)[0]);
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
