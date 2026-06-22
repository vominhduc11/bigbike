package com.bigbike.bigbike_backend.domain.catalog;

import java.time.Instant;
import java.util.List;

public record Product(
        String id,
        String sku,
        String slug,
        /** Optional English URL slug (V214). Canonical {@code slug} stays vi; null when unset. */
        String slugEn,
        String name,
        String shortDescription,
        String description,
        BrandSummary brand,
        CategorySummary category,
        List<CategorySummary> categories,
        ImageAsset image,
        List<GalleryMedia> gallery,
        List<VideoAsset> videos,
        ProductPrice price,
        List<ProductVariant> variants,
        List<ProductSpecification> specifications,
        ProductStockState stockState,
        /** Best-effort on-hand count (product-level). Null if not tracked. */
        Integer stockQuantity,
        Boolean forceOutOfStock,
        PublishStatus publishStatus,
        /** Homepage placement slot — see {@link HomepageBlock}. Never null; NONE means not pinned. */
        HomepageBlock homepageBlock,
        /** Pin priority inside the homepage block. Lower = earlier; null = end. Ignored when homepageBlock == NONE. */
        Integer homepageOrder,
        /** Denormalized cache of the approved-review average used by product list/detail reads. */
        java.math.BigDecimal rating,
        /** Denormalized cache of the approved-review count used by product list/detail reads. */
        Integer ratingCount,
        /** Rich-HTML promotion copy rendered in the PDP "Khuyến mãi" tab. */
        String promotionContent,
        /** Rich-HTML installation guide rendered in PDP section "03 Hướng dẫn lắp đặt". Detail-only. */
        String installationGuide,
        /** Product FAQ entries rendered in PDP section "05 Câu hỏi thường gặp". Detail-only. */
        List<ProductFaq> faqs,
        /** Per-product commitment rows rendered under the buy buttons (V232). Detail-only; empty in list. */
        List<ProductCommitment> commitments,
        /** Per-product "Mua tại BigBike.vn" lines (V249). Detail-only; empty in list. {@code *En} chỉ có trên admin reads. */
        List<ProductPurchaseLine> purchaseLines,
        /** "Specs Dashboard" stat boxes under the buy area (V235), max 4. Detail-only; empty in list. {@code *En} chỉ có trên admin reads. */
        List<ProductSpecStat> specStats,
        /** Per-product trust badges rendered on the trust row above the title (V233). Detail-only; empty in list. {@code contentEn} chỉ có trên admin reads. */
        List<TrustBadge> trustBadges,
        /** Ưu điểm (schema.org positiveNotes). Detail-only; empty in list. {@code contentEn} chỉ có trên admin reads. */
        List<ProductHighlight> positiveNotes,
        /** Nhược điểm (schema.org negativeNotes). Detail-only; empty in list. {@code contentEn} chỉ có trên admin reads. */
        List<ProductHighlight> negativeNotes,
        /** "Thương hiệu [nước]". Detail-only; null in list. */
        String originBrandCountry,
        /** Bảng size dạng HTML (rich-text). Detail-only; null in list. */
        String sizeGuide,
        /** "Phù hợp với ai" — JSON array các thẻ {@code [{audience, advice, linkLabel?, linkUrl?}]}
         *  (V237; format đổi ở V240). Opaque string, web parse JSON. Detail-only; null in list. */
        String suitabilityAdvisory,
        /** "Dán mã HTML" cho khối Thông số kỹ thuật (V255). Khi non-blank, web render HTML này
         *  (sanitizeRichHtml, cho phép {@code <table>}) THAY cho bảng {@code specifications} có cấu
         *  trúc ("html thắng"). Detail-only; null in list. Resolved per-locale via {@code pick}. */
        String specificationsHtml,
        /** "Dán mã HTML" cho khối "Ô số liệu nổi bật" (specStats, V256). Khi non-blank, web render
         *  HTML này THAY cho lưới {@code specStats} có cấu trúc. Detail-only; null in list. */
        String specStatsHtml,
        /** "Dán mã HTML" cho khối "Dải tin cậy" (trustBadges, V257). Khi non-blank, web render HTML
         *  này THAY cho dải {@code trustBadges} có cấu trúc. Detail-only; null in list. */
        String trustBadgesHtml,
        /** Giới tính mục tiêu: "Nam" | "Nữ" | "Unisex". Null = chưa gắn. */
        String gender,
        /**
         * Admin-curated related products shown in the PDP "Sản phẩm liên quan" section.
         * List-view shape (no nested gallery/specs/relatedProducts). Detail-only;
         * empty in list responses. Public reads include only PUBLISHED entries.
         */
        List<Product> relatedProducts,
        /**
         * Admin-curated accessory products ("Phụ kiện") — sản phẩm bán kèm chọn từ kho —
         * shown in the PDP "Phụ kiện" section. List-view shape (no nested gallery/specs/
         * relatedProducts). Detail-only; empty in list responses. Public reads include
         * only PUBLISHED entries.
         */
        List<Product> accessoryProducts,
        /**
         * Structured description blocks (V139). Null for products authored via the legacy
         * RichTextEditor. Detail-only; null in list responses.
         */
        List<DescriptionBlock> descriptionBlocks,
        /**
         * Per-product PDP tab configuration (V231). Null/empty → web uses the default tab set.
         * Detail-only; null in list responses. Public reads carry locale-resolved label/blocks;
         * admin reads carry raw English in {@code labelEn}/{@code blocksEn}.
         */
        List<ProductTab> tabs,
        /**
         * "Hiển thị trên web" (V245) — opaque JSON string {sectionKey: boolean} cho phép admin bật/tắt
         * từng section PDP. Null = chưa cấu hình → web hiện theo nội dung (legacy). Detail-only; null in list.
         */
        String sectionVisibility,
        SeoMeta seo,
        /**
         * Raw English content (V136). Populated only on admin product detail reads
         * so the editor can show both languages; {@code null} on public reads.
         */
        ProductTranslations translations,
        Instant createdAt,
        Instant updatedAt
) {
}
