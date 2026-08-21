import { describe, it, expect } from "vitest";
import type { Article, Category, Product, VideoAsset } from "@/lib/contracts/public";
import {
  buildBreadcrumbJsonLd,
  buildArticleJsonLd,
  buildCategoryCollectionJsonLd,
  buildFaqPageJsonLd,
  buildLocalBusinessJsonLd,
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
  it("sinh ProductGroup theo giá/mã hàng/tồn kho từng mẫu, ảnh khử trùng, ưu/nhược", () => {
    const product = makeProduct({
      variants: [
        {
          id: "v1",
          sku: "SKU-RED",
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
    expect(ld["@type"]).toBe("ProductGroup");
    expect(ld.name).toBe("Áo giáp mô tô ABC");
    expect(ld.productGroupID).toBe("SKU-001");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "ABC" });
    expect(ld.url).toContain("/product/ao-giap-moto-abc/");

    // Ảnh: main + gallery + variant, khử trùng theo URL (main.jpg lặp 1 lần).
    expect(ld.image).toEqual([
      "https://cdn/main.jpg",
      "https://cdn/g1.jpg",
      "https://cdn/variant-red.jpg",
    ]);

    // Mỗi mẫu dùng giá thực tế khách thấy (mẫu không ghi đè giá thì dùng giá chung),
    // mã hàng và tồn kho riêng — không còn một Offer chung sai lệch.
    expect(arr(ld.hasVariant)).toHaveLength(1);
    expect(arr(ld.hasVariant)[0]).toMatchObject({
      "@type": "Product",
      sku: "SKU-RED",
      offers: {
      "@type": "Offer",
      price: 800_000,
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      },
    });

    // AggregateRating khai vì ratingCount > 0.
    expect(ld.aggregateRating).toMatchObject({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 12,
    });

    // Ưu/nhược điểm KHÔNG được vào JSON-LD dù makeProduct() có sẵn dữ liệu.
    expect(ld.positiveNotes).toBeUndefined();
    expect(ld.negativeNotes).toBeUndefined();
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

  it("khai từng giá và trạng thái còn/hết hàng theo đúng mẫu khách chọn, không tạo trạng thái sắp hết", () => {
    const ld = obj(buildProductJsonLd(makeProduct({
      variants: [
        {
          id: "red", sku: "SKU-RED", name: "Đỏ", options: [{ name: "Màu", value: "Đỏ" }],
          price: { retailPrice: 900_000, salePrice: 750_000, currency: "VND" }, stockState: "IN_STOCK", isAvailable: true,
        },
        {
          id: "blue", sku: "SKU-BLUE", name: "Xanh", options: [{ name: "Màu", value: "Xanh" }],
          price: { retailPrice: 1_100_000, currency: "VND" }, stockState: "OUT_OF_STOCK", isAvailable: false,
        },
      ],
    })));
    const variants = arr(ld.hasVariant);

    expect(obj(variants[0].offers)).toMatchObject({ price: 750_000, availability: "https://schema.org/InStock" });
    expect(obj(variants[1].offers)).toMatchObject({ price: 1_100_000, availability: "https://schema.org/OutOfStock" });
    expect(JSON.stringify(ld)).not.toContain("LimitedAvailability");
  });

  it("KHÔNG khai aggregateRating khi chưa có review thật (chống khai khống #23)", () => {
    expect(obj(buildProductJsonLd(makeProduct({ rating: 0, ratingCount: 0 }))).aggregateRating).toBeUndefined();
    expect(obj(buildProductJsonLd(makeProduct({ rating: 4, ratingCount: 0 }))).aggregateRating).toBeUndefined();
    expect(obj(buildProductJsonLd(makeProduct({ rating: null, ratingCount: 18 }))).aggregateRating).toBeUndefined();
    expect(obj(buildProductJsonLd(makeProduct({ rating: 7, ratingCount: 18 }))).aggregateRating).toBeUndefined();
    expect(obj(buildProductJsonLd(makeProduct({ ratingCount: null }))).aggregateRating).toBeUndefined();
  });

  // Chặn hồi quy: Google chỉ hỗ trợ rich result ưu/nhược điểm cho trang đánh giá
  // biên tập độc lập, KHÔNG cho trang bán hàng của người bán. Khai lại = sai loại
  // trang, nguy cơ phạt thủ công toàn site. Ưu/nhược vẫn hiển thị dạng HTML thường.
  it("KHÔNG BAO GIỜ khai ưu/nhược điểm vào JSON-LD, kể cả khi có đủ dữ liệu", () => {
    const withNotes = obj(
      buildProductJsonLd(
        makeProduct({
          positiveNotes: [{ content: "Nhẹ" }, { content: "Thoáng khí" }],
          negativeNotes: [{ content: "Giá cao" }],
        }),
      ),
    );
    const empty = obj(buildProductJsonLd(makeProduct({ positiveNotes: [], negativeNotes: [] })));

    for (const ld of [withNotes, empty]) {
      expect(ld.positiveNotes).toBeUndefined();
      expect(ld.negativeNotes).toBeUndefined();
      // Không được lách sang tên khác (Review/pros/cons) — quét cả chuỗi đã serialize.
      const serialized = JSON.stringify(ld);
      expect(serialized).not.toMatch(/positiveNotes|negativeNotes|"pros"|"cons"|"@type":"Review"/);
    }
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("đi qua danh mục thay vì thương hiệu: Trang chủ → Danh mục → Sản phẩm", () => {
    const ld = obj(buildBreadcrumbJsonLd(makeProduct()));
    expect(ld["@type"]).toBe("BreadcrumbList");
    const names = arr(ld.itemListElement).map((i) => i.name);
    expect(names).toEqual(["Trang chủ", "Áo giáp", "Áo giáp mô tô ABC"]);
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

  it("bỏ qua danh mục 'chua-phan-loai' khi không có danh mục hợp lệ", () => {
    const ld = obj(buildBreadcrumbJsonLd(
      makeProduct({ category: { id: "c0", slug: "chua-phan-loai", name: "Chưa phân loại" } }),
    ));
    expect(arr(ld.itemListElement).map((i) => i.name)).toEqual(["Trang chủ", "Áo giáp mô tô ABC"]);
  });

  it("giữ đủ danh mục cha và con theo đúng thứ tự đang hiển thị", () => {
    const ld = obj(buildBreadcrumbJsonLd(makeProduct(), "/product/ao-giap-moto-abc/", [
      { id: "parent", slug: "bao-ho", name: "Đồ bảo hộ" },
      { id: "child", slug: "ao-giap", name: "Áo giáp" },
    ]));
    expect(arr(ld.itemListElement).map((i) => i.name)).toEqual([
      "Trang chủ", "Đồ bảo hộ", "Áo giáp", "Áo giáp mô tô ABC",
    ]);
  });
});

describe("article and category structured data", () => {
  const article = {
    id: "article-1",
    slug: "bai-viet-1",
    title: "Bài viết",
    body: "Nội dung",
    coverImage: { url: "/media/article-cover.jpg" },
    authorName: "Nguyễn Văn A",
    publishStatus: "PUBLISHED",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  } as Article;

  it("chỉ khai author khi bài có tên tác giả và luôn dùng URL ảnh đầy đủ", () => {
    const withAuthor = obj(buildArticleJsonLd(article, "BigBike"));
    expect(withAuthor.author).toEqual({ "@type": "Person", name: "Nguyễn Văn A" });
    expect(withAuthor.image).toEqual([expect.stringMatching(/^https?:\/\//)]);
    expect(obj(buildArticleJsonLd({ ...article, authorName: "  " }, "BigBike")).author).toBeUndefined();
  });

  it("chỉ liệt kê sản phẩm của trang hiện tại và tiếp tục vị trí qua trang", () => {
    const ld = obj(buildCategoryCollectionJsonLd(
      { id: "c1", slug: "ao-giap", name: "Áo giáp" } as Category,
      [makeProduct({ slug: "sp-1" }), makeProduct({ slug: "sp-2" })],
      2,
      12,
      "/danh-muc/ao-giap/?page=2",
      "<p>Áo giáp <strong>chính hãng</strong></p>",
    ));
    expect(ld["@type"]).toBe("CollectionPage");
    expect(obj(ld.mainEntity).numberOfItems).toBe(2);
    expect(arr(obj(ld.mainEntity).itemListElement).map((item) => item.position)).toEqual([13, 14]);
    expect(arr(obj(ld.mainEntity).itemListElement)[0].url).toMatch(/^https?:\/\//);
    expect(ld.description).toBe("Áo giáp chính hãng");
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
    const ld = obj(buildArticleBreadcrumbJsonLd(article, "/en/tin-tuc/english-article/"));
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

  it("YouTube → nocookie embedUrl; mô tả hiển thị nguyên văn và uploadDate fallback ngày tạo SP", () => {
    const videos: VideoAsset[] = [
      {
        id: "video-youtube-1",
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Đánh giá",
        description: "Cận cảnh áo giáp.",
        thumbnail: { url: "https://cdn/thumb.jpg" },
      },
    ];
    const ld = obj(buildVideoObjectsJsonLd(videos, product)[0]);
    expect(ld["@type"]).toBe("VideoObject");
    expect(ld["@id"]).toContain("#video-video-youtube-1");
    expect(ld.name).toBe("Đánh giá");
    expect(ld.description).toBe("Cận cảnh áo giáp.");
    expect(ld.embedUrl).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?enablejsapi=1&playsinline=1&rel=0");
    expect(ld.contentUrl).toBeUndefined();
    expect(ld.thumbnailUrl).toEqual(["https://cdn/thumb.jpg"]);
    expect(ld.uploadDate).toBe("2026-06-01T00:00:00Z");
    expect(ld.publisher).toMatchObject({ "@type": "Organization", name: "BigBike" });
  });

  it("video tải lên → contentUrl, thời lượng ISO 8601 và ngày đăng thật", () => {
    const ld = obj(buildVideoObjectsJsonLd([{
      id: "video-upload-1",
      url: "https://cdn/clip.mp4",
      title: "Clip",
      description: "Video quay cận cảnh sản phẩm.",
      thumbnail: { url: "https://cdn/clip.jpg" },
      durationSeconds: 125,
      uploadedOn: "2026-08-20",
    }], product)[0]);
    expect(ld.embedUrl).toBeUndefined();
    expect(ld.contentUrl).toBe("https://cdn/clip.mp4");
    expect(ld.thumbnailUrl).toEqual(["https://cdn/clip.jpg"]);
    expect(ld.duration).toBe("PT2M5S");
    expect(ld.uploadDate).toBe("2026-08-20");
  });

  it("bỏ qua video thiếu mã, mô tả hoặc ảnh đại diện đúng thay vì mượn ảnh/mô tả sản phẩm", () => {
    const bare = makeProduct({ image: undefined, gallery: [] });
    expect(buildVideoObjectsJsonLd([{ title: "Không URL" }], bare)).toEqual([]);
    expect(buildVideoObjectsJsonLd([{
      id: "missing-description",
      url: "https://cdn/x.mp4",
      title: "Thiếu mô tả",
      thumbnail: { url: "https://cdn/x.jpg" },
    }], bare)).toEqual([]);
    expect(buildVideoObjectsJsonLd([{
      id: "missing-thumbnail",
      url: "https://cdn/x.mp4",
      title: "Thiếu ảnh",
      description: "Có mô tả nhưng không có ảnh riêng.",
    }], product)).toEqual([]);
  });

  it("gộp video thật sự hiển thị ở dải ảnh và khối Video sản phẩm với mã riêng", () => {
    const ld = buildVideoObjectsJsonLd(makeProduct({
      gallery: [{
        id: "gallery-video-1",
        mediaType: "video",
        videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Video dải ảnh",
        description: "Mô tả ngay dưới video dải ảnh.",
      }],
      videos: [{
        id: "section-video-1",
        url: "https://cdn/video.mp4",
        title: "Video sản phẩm",
        description: "Mô tả trong cửa sổ xem video.",
        thumbnail: { url: "https://cdn/video.jpg" },
      }],
    }));
    expect(ld).toHaveLength(2);
    expect(ld.map((video) => video["@id"])).toEqual(expect.arrayContaining([
      expect.stringContaining("#video-gallery-video-1"),
      expect.stringContaining("#video-section-video-1"),
    ]));
  });
});

describe("buildLocalBusinessJsonLd", () => {
  const ADDRESS = "79/30/52 Âu Cơ, Phường Hoà Bình, TP. Hồ Chí Minh";

  it("tách địa chỉ một dòng thành PostalAddress có cấu trúc", () => {
    const ld = obj(buildLocalBusinessJsonLd("BigBike", "/logo.png", ADDRESS, "0906 902 404"));
    expect(obj(ld.address)).toEqual({
      "@type": "PostalAddress",
      addressCountry: "VN",
      streetAddress: "79/30/52 Âu Cơ, Phường Hoà Bình",
      addressLocality: "TP. Hồ Chí Minh",
    });
  });

  it("địa chỉ không có dấu phẩy thì giữ nguyên, không đoán tỉnh/thành", () => {
    const ld = obj(buildLocalBusinessJsonLd("BigBike", "/logo.png", "79 Âu Cơ", "0906"));
    expect(obj(ld.address).streetAddress).toBe("79 Âu Cơ");
    expect(obj(ld.address).addressLocality).toBeUndefined();
  });

  it("đổi giờ mở cửa dạng chữ sang OpeningHoursSpecification", () => {
    const ld = obj(
      buildLocalBusinessJsonLd("BigBike", "/logo.png", ADDRESS, "0906", {
        openingHours: ["T2 - T7: 09h00 - 21h00", "CN: 09h00 - 17h00"],
      }),
    );
    expect(arr(ld.openingHoursSpecification)).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "09:00",
        closes: "21:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Sunday"],
        opens: "09:00",
        closes: "17:00",
      },
    ]);
  });

  it("KHÔNG đọc nhầm ký hiệu thứ thành giờ (T7: phải không ra 07:00)", () => {
    const ld = obj(
      buildLocalBusinessJsonLd("BigBike", "/logo.png", ADDRESS, "0906", {
        openingHours: ["T2 - T7: 09h00 - 21h00"],
      }),
    );
    expect(arr(ld.openingHoursSpecification)[0].opens).toBe("09:00");
  });

  it("bỏ qua dòng không có giờ cụ thể thay vì đoán bừa", () => {
    const ld = obj(
      buildLocalBusinessJsonLd("BigBike", "/logo.png", ADDRESS, "0906", {
        openingHours: ["Lễ / Tết: nghỉ có thông báo", "", null, undefined],
      }),
    );
    expect(ld.openingHoursSpecification).toBeUndefined();
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
