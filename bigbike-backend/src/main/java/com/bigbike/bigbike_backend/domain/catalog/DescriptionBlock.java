package com.bigbike.bigbike_backend.domain.catalog;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.List;

/**
 * Sealed hierarchy for structured product description blocks (V139).
 * Jackson uses the "type" discriminator for polymorphic JSON deserialization.
 * Bean Validation constraints on each subtype enforce required fields.
 */
@JsonIgnoreProperties(ignoreUnknown = false)
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        property = "type",
        include = JsonTypeInfo.As.EXISTING_PROPERTY,
        visible = true
)
@JsonSubTypes({
        @JsonSubTypes.Type(value = DescriptionBlock.HeadingBlock.class,   name = "heading"),
        @JsonSubTypes.Type(value = DescriptionBlock.ParagraphBlock.class, name = "paragraph"),
        @JsonSubTypes.Type(value = DescriptionBlock.ListBlock.class,      name = "list"),
        @JsonSubTypes.Type(value = DescriptionBlock.ImageBlock.class,     name = "image"),
        @JsonSubTypes.Type(value = DescriptionBlock.VideoBlock.class,     name = "video"),
        @JsonSubTypes.Type(value = DescriptionBlock.CalloutBlock.class,   name = "callout"),
        @JsonSubTypes.Type(value = DescriptionBlock.DividerBlock.class,   name = "divider"),
        @JsonSubTypes.Type(value = DescriptionBlock.FeatureBlock.class,   name = "feature"),
        @JsonSubTypes.Type(value = DescriptionBlock.ProsConsBlock.class,    name = "prosCons"),
})
public sealed interface DescriptionBlock
        permits DescriptionBlock.HeadingBlock, DescriptionBlock.ParagraphBlock,
                DescriptionBlock.ListBlock,    DescriptionBlock.ImageBlock,
                DescriptionBlock.VideoBlock,   DescriptionBlock.CalloutBlock,
                DescriptionBlock.DividerBlock, DescriptionBlock.FeatureBlock,
                DescriptionBlock.ProsConsBlock {

    String getType();

    /**
     * Locale-resolve a bilingual-inline block list (V326): for each block, every translatable field
     * becomes {@code pick(base, en, locale)} and the {@code *En} sibling fields are dropped from the
     * result. Shared by the public read path ({@code JpaCatalogReadSupport}) and the write-side
     * legacy flat {@code description_en} HTML rendering ({@code AdminCatalogMutationService}), so
     * both places treat "no English for this field" as "fall back to Vietnamese" consistently with
     * every other bilingual field in the product (see {@code BUSINESS_RULES.md PRODUCT_RULE_002}).
     */
    static List<DescriptionBlock> resolveForLocale(List<DescriptionBlock> blocks, String locale) {
        if (blocks == null) return null;
        return blocks.stream().map(block -> resolveBlockForLocale(block, locale)).toList();
    }

    private static String pick(String base, String en, String locale) {
        return "en".equals(locale) && en != null && !en.isBlank() ? en : base;
    }

    private static <T> List<T> pickList(List<T> base, List<T> en, String locale) {
        return "en".equals(locale) && en != null && !en.isEmpty() ? en : base;
    }

    private static DescriptionBlock resolveBlockForLocale(DescriptionBlock block, String locale) {
        if (block instanceof HeadingBlock b) {
            return HeadingBlock.builder()
                    .type(b.getType())
                    .level(b.getLevel())
                    .text(pick(b.getText(), b.getTextEn(), locale))
                    .build();
        }
        if (block instanceof ParagraphBlock b) {
            return ParagraphBlock.builder()
                    .type(b.getType())
                    .html(pick(b.getHtml(), b.getHtmlEn(), locale))
                    .build();
        }
        if (block instanceof ListBlock b) {
            return ListBlock.builder()
                    .type(b.getType())
                    .style(b.getStyle())
                    .items(pickList(b.getItems(), b.getItemsEn(), locale))
                    .build();
        }
        if (block instanceof ImageBlock b) {
            return ImageBlock.builder()
                    .type(b.getType())
                    .url(b.getUrl())
                    .alt(pick(b.getAlt(), b.getAltEn(), locale))
                    .caption(pick(b.getCaption(), b.getCaptionEn(), locale))
                    .build();
        }
        if (block instanceof VideoBlock b) {
            return VideoBlock.builder()
                    .type(b.getType())
                    .provider(b.getProvider())
                    .url(b.getUrl())
                    .caption(pick(b.getCaption(), b.getCaptionEn(), locale))
                    .build();
        }
        if (block instanceof CalloutBlock b) {
            return CalloutBlock.builder()
                    .type(b.getType())
                    .variant(b.getVariant())
                    .html(pick(b.getHtml(), b.getHtmlEn(), locale))
                    .build();
        }
        if (block instanceof FeatureBlock b) {
            return FeatureBlock.builder()
                    .type(b.getType())
                    .side(b.getSide())
                    .url(b.getUrl())
                    .alt(pick(b.getAlt(), b.getAltEn(), locale))
                    .caption(pick(b.getCaption(), b.getCaptionEn(), locale))
                    .subheading(pick(b.getSubheading(), b.getSubheadingEn(), locale))
                    .heading(pick(b.getHeading(), b.getHeadingEn(), locale))
                    .html(pick(b.getHtml(), b.getHtmlEn(), locale))
                    .build();
        }
        // DividerBlock / ProsConsBlock (dormant): no *En fields to resolve — pass through unchanged.
        return block;
    }

    /** { type: "heading", level: 2|3, text: string, textEn?: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class HeadingBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "heading.level is required (2 or 3).")
        @Min(value = 2, message = "heading.level must be 2 or 3.")
        @Max(value = 3, message = "heading.level must be 2 or 3.")
        private Integer level;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @NotBlank(message = "heading.text is required.")
        @Size(max = 500, message = "heading.text must not exceed 500 characters.")
        private String text;

        // Optional English translation (V326 merge) — never required, length-checked only.
        // ALWAYS: bilingual pair with text — export must not drop textEn when blank.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "heading.textEn must not exceed 500 characters.")
        private String textEn;
    }

    /** { type: "paragraph", html: string, htmlEn?: string } — inline HTML only: &lt;b&gt;&lt;i&gt;&lt;a&gt;&lt;br&gt; */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ParagraphBlock implements DescriptionBlock {
        private String type;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @NotNull(message = "paragraph.html is required.")
        @Size(max = 50000, message = "paragraph.html must not exceed 50 000 characters.")
        private String html;

        // Optional English translation (V326 merge) — never required, length-checked only.
        // ALWAYS: bilingual pair with html — export must not drop htmlEn when blank.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 50000, message = "paragraph.htmlEn must not exceed 50 000 characters.")
        private String htmlEn;
    }

    /** { type: "list", style: "bulleted"|"numbered", items: string[], itemsEn?: string[] } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ListBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "list.style is required.")
        @Pattern(regexp = "bulleted|numbered", message = "list.style must be 'bulleted' or 'numbered'.")
        private String style;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @NotNull(message = "list.items is required.")
        @Size(min = 1, max = 200, message = "list.items must have 1–200 entries.")
        private List<@NotBlank(message = "List item must not be blank.")
                     @Size(max = 2000, message = "List item must not exceed 2 000 characters.") String> items;

        // Optional English translation (V326 merge) — parallel array kept in sync by the admin
        // editor (VI is structurally authoritative); never required, length-checked only.
        // ALWAYS: bilingual pair with items — export must not drop itemsEn when blank.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 200, message = "list.itemsEn must not exceed 200 entries.")
        private List<@Size(max = 2000, message = "List item (EN) must not exceed 2 000 characters.") String> itemsEn;
    }

    /** { type: "image", url: string, alt?: string, altEn?: string, caption?: string, captionEn?: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ImageBlock implements DescriptionBlock {
        private String type;

        @NotBlank(message = "image.url is required.")
        @Size(max = 2000, message = "image.url must not exceed 2 000 characters.")
        private String url;

        // alt/altEn and caption/captionEn are bilingual pairs — ALWAYS so export doesn't drop
        // either side when blank.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "image.alt must not exceed 500 characters.")
        private String alt;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "image.altEn must not exceed 500 characters.")
        private String altEn;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "image.caption must not exceed 500 characters.")
        private String caption;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "image.captionEn must not exceed 500 characters.")
        private String captionEn;
    }

    /** { type: "video", provider: "youtube"|"upload", url: string, caption?: string, captionEn?: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class VideoBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "video.provider is required.")
        @Pattern(
                regexp = "youtube|upload",
                message = "video.provider must be 'youtube' or 'upload'."
        )
        private String provider;

        @NotBlank(message = "video.url is required.")
        @Size(max = 2000, message = "video.url must not exceed 2 000 characters.")
        private String url;

        // caption/captionEn is the bilingual pair — ALWAYS so export doesn't drop either side.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "video.caption must not exceed 500 characters.")
        private String caption;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "video.captionEn must not exceed 500 characters.")
        private String captionEn;
    }

    /** { type: "callout", variant: "info"|"warning"|"note", html: string, htmlEn?: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class CalloutBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "callout.variant is required.")
        @Pattern(regexp = "info|warning|note", message = "callout.variant must be 'info', 'warning', or 'note'.")
        private String variant;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @NotNull(message = "callout.html is required.")
        @Size(max = 10000, message = "callout.html must not exceed 10 000 characters.")
        private String html;

        // Optional English translation (V326 merge) — never required, length-checked only.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 10000, message = "callout.htmlEn must not exceed 10 000 characters.")
        private String htmlEn;
    }

    /** { type: "divider" } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class DividerBlock implements DescriptionBlock {
        private String type;
    }

    /**
     * { type: "feature", side?: "auto"|"left"|"right", url?, alt?, caption?, subheading?, heading?, html? }
     *
     * <p>Một "hàng tính năng" gói chung 1 ảnh + tiêu đề phụ (eyebrow) + tiêu đề chính + đoạn mô tả +
     * danh sách, render thành khối 2 cột ảnh–chữ trên web (xen kẽ trái/phải khi {@code side} = "auto"
     * hoặc null). Không field nào bắt buộc riêng lẻ — khối chỉ bị coi là rỗng (và bị admin lọc bỏ trước
     * khi gửi) khi cả ảnh lẫn mọi phần chữ đều trống. Thiếu {@code url} → web render full-width chỉ chữ,
     * không chừa cột ảnh trống (xem {@code featureHasImage}/{@code featureHasText} ở bigbike-web).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class FeatureBlock implements DescriptionBlock {
        private String type;

        @Pattern(regexp = "auto|left|right", message = "feature.side must be 'auto', 'left', or 'right'.")
        private String side;

        @Size(max = 2000, message = "feature.url must not exceed 2 000 characters.")
        private String url;

        // Every base/*En pair below is a bilingual column — ALWAYS so export doesn't drop either
        // side when blank.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.alt must not exceed 500 characters.")
        private String alt;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.altEn must not exceed 500 characters.")
        private String altEn;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.caption must not exceed 500 characters.")
        private String caption;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.captionEn must not exceed 500 characters.")
        private String captionEn;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.subheading must not exceed 500 characters.")
        private String subheading;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.subheadingEn must not exceed 500 characters.")
        private String subheadingEn;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.heading must not exceed 500 characters.")
        private String heading;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 500, message = "feature.headingEn must not exceed 500 characters.")
        private String headingEn;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 50000, message = "feature.html must not exceed 50 000 characters.")
        private String html;

        // Optional English translation (V326 merge) — never required, length-checked only.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        @Size(max = 50000, message = "feature.htmlEn must not exceed 50 000 characters.")
        private String htmlEn;
    }

    /**
     * { type: "prosCons", title?: string, positive: string[], negative: string[] }
     *
     * <p>Dormant since V254__remove_proscons_blocks.sql — admin no longer creates this block type
     * (superseded by the standalone {@code positiveNotes}/{@code negativeNotes} product fields).
     * Kept only so legacy/unknown JSON deserializes without error; intentionally has no {@code *En}
     * fields (V326 merge did not touch this subtype).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ProsConsBlock implements DescriptionBlock {
        private String type;

        @Size(max = 500, message = "prosCons.title must not exceed 500 characters.")
        private String title;

        @Size(max = 200, message = "prosCons.positive must not exceed 200 entries.")
        private List<@NotBlank(message = "prosCons.positive item must not be blank.")
                     @Size(max = 2000, message = "prosCons.positive item must not exceed 2 000 characters.") String> positive;

        @Size(max = 200, message = "prosCons.negative must not exceed 200 entries.")
        private List<@NotBlank(message = "prosCons.negative item must not be blank.")
                     @Size(max = 2000, message = "prosCons.negative item must not exceed 2 000 characters.") String> negative;
    }

    // suitability/sizeGuide (V240/V246) tách khỏi sealed interface này ở V327/V328 — xem
    // SuitabilitySection.java/SizeGuideSection.java (Product-only, không còn đa hình trong mảng).
}
