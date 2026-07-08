package com.bigbike.bigbike_backend.domain.catalog;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * {@code @JsonInclude(NON_NULL)}: list-view reads (see {@code CatalogReadSupport.toListView})
 * null out ~12 detail-only scalar/object fields (description, seo,
 * translations, ...) rather than fetching them — this keeps those keys out of every list
 * item's JSON instead of shipping repeated {@code "field":null} noise. Detail-only LIST
 * fields (gallery, faqs, ...) stay {@code List.of()} and are unaffected — NON_NULL
 * only drops null, not empty collections. The web/admin TypeScript {@code Product} contract
 * already declares these fields optional ({@code field?: T}), so an absent key and an
 * explicit null are handled identically by every consumer.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
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
        /** Product FAQ entries rendered in PDP section "05 Câu hỏi thường gặp". Detail-only. */
        List<ProductFaq> faqs,
        /** Per-product commitment rows rendered under the buy buttons (V232). Detail-only; empty in list. */
        List<ProductCommitment> commitments,
        /** Ưu/Nhược điểm (schema.org positiveNotes/negativeNotes) gộp 1 field lồng (2026-07-07). Detail-only; {@link ProductHighlights#EMPTY} in list. {@code contentEn} chỉ có trên admin reads. */
        ProductHighlights highlights,
        /** "Thương hiệu [nước]". Detail-only; null in list. */
        String originBrandCountry,
        /** Bảng size dạng HTML (rich-text). Detail-only; null in list. */
        String sizeGuide,
        /** "Phù hợp với ai" — JSON array các thẻ {@code [{audience, advice, linkLabel?, linkUrl?}]}
         *  (V237; format đổi ở V240). Opaque string, web parse JSON. Detail-only; null in list. */
        String suitabilityAdvisory,
        /** "Dán mã HTML" cho khối Thông số kỹ thuật (V255). HTML là nguồn render duy nhất.
         *  Detail-only; null in list. Resolved per-locale via {@code pick}. */
        String specificationsHtml,
        /** "Dán mã HTML" cho khối "Ô số liệu nổi bật" (V256). HTML là nguồn render duy nhất.
         *  Detail-only; null in list. */
        String specStatsHtml,
        /** "Dán mã HTML" cho khối "Dải tin cậy" (V257). HTML là nguồn render duy nhất.
         *  Detail-only; null in list. */
        String trustBadgesHtml,
        /** "Quick Answer" (trả lời nhanh, V300) — đoạn tóm tắt AIO 40-60 từ, blockquote ngay sau
         *  Specs Dashboard, trước "Tính năng chi tiết". Max 600 ký tự. Detail-only; null in list. */
        String quickAnswerSummary,
        /** Giới tính mục tiêu: "Nam" | "Nữ" | "Unisex". Null = chưa gắn. */
        String gender,
        /**
         * Admin-curated related products shown in the PDP "Sản phẩm liên quan" section.
         * List-view shape (no nested gallery/relatedProducts). Detail-only;
         * empty in list responses. Public reads include only PUBLISHED entries.
         */
        List<Product> relatedProducts,
        /**
         * Admin-curated accessory products ("Phụ kiện") — sản phẩm bán kèm chọn từ kho —
         * shown in the PDP "Phụ kiện" section. List-view shape (no nested gallery/
         * relatedProducts). Detail-only; empty in list responses. Public reads include
         * only PUBLISHED entries.
         */
        List<Product> accessoryProducts,
        /**
         * Structured description blocks (V139). Null for products authored via the legacy
         * RichTextEditor. Detail-only; null in list responses. Since V327/V328, only 4 block types
         * remain here (paragraph/image/feature×2) — suitability/sizeGuide moved to the 2 fields below.
         */
        List<DescriptionBlock> descriptionBlocks,
        /** "Phù hợp với ai" (V240, tách khỏi descriptionBlocks ở V327/V328). Detail-only; null in list. */
        SuitabilitySection suitabilitySection,
        /** "Bảng size" (V246, tách khỏi descriptionBlocks ở V327/V328). Detail-only; null in list. */
        SizeGuideSection sizeGuideSection,
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
