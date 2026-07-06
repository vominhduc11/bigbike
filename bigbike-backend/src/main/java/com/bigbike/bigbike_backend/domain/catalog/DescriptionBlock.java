package com.bigbike.bigbike_backend.domain.catalog;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@JsonIgnoreProperties(ignoreUnknown = true)
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
        @JsonSubTypes.Type(value = DescriptionBlock.SuitabilityBlock.class, name = "suitability"),
        @JsonSubTypes.Type(value = DescriptionBlock.SizeGuideBlock.class,   name = "sizeGuide"),
})
public sealed interface DescriptionBlock
        permits DescriptionBlock.HeadingBlock, DescriptionBlock.ParagraphBlock,
                DescriptionBlock.ListBlock,    DescriptionBlock.ImageBlock,
                DescriptionBlock.VideoBlock,   DescriptionBlock.CalloutBlock,
                DescriptionBlock.DividerBlock, DescriptionBlock.FeatureBlock,
                DescriptionBlock.ProsConsBlock, DescriptionBlock.SuitabilityBlock,
                DescriptionBlock.SizeGuideBlock {

    String getType();

    /** { type: "heading", level: 2|3, text: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class HeadingBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "heading.level is required (2 or 3).")
        @Min(value = 2, message = "heading.level must be 2 or 3.")
        @Max(value = 3, message = "heading.level must be 2 or 3.")
        private Integer level;

        @NotBlank(message = "heading.text is required.")
        @Size(max = 500, message = "heading.text must not exceed 500 characters.")
        private String text;
    }

    /** { type: "paragraph", html: string } — inline HTML only: &lt;b&gt;&lt;i&gt;&lt;a&gt;&lt;br&gt; */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ParagraphBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "paragraph.html is required.")
        @Size(max = 50000, message = "paragraph.html must not exceed 50 000 characters.")
        private String html;
    }

    /** { type: "list", style: "bulleted"|"numbered", items: string[] } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ListBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "list.style is required.")
        @Pattern(regexp = "bulleted|numbered", message = "list.style must be 'bulleted' or 'numbered'.")
        private String style;

        @NotNull(message = "list.items is required.")
        @Size(min = 1, max = 200, message = "list.items must have 1–200 entries.")
        private List<@NotBlank(message = "List item must not be blank.")
                     @Size(max = 2000, message = "List item must not exceed 2 000 characters.") String> items;
    }

    /** { type: "image", url: string, alt?: string, caption?: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ImageBlock implements DescriptionBlock {
        private String type;

        @NotBlank(message = "image.url is required.")
        @Size(max = 2000, message = "image.url must not exceed 2 000 characters.")
        private String url;

        @Size(max = 500, message = "image.alt must not exceed 500 characters.")
        private String alt;

        @Size(max = 500, message = "image.caption must not exceed 500 characters.")
        private String caption;
    }

    /** { type: "video", provider: "youtube"|"upload", url: string, caption?: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class VideoBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "video.provider is required.")
        @Pattern(regexp = "youtube|upload", message = "video.provider must be 'youtube' or 'upload'.")
        private String provider;

        @NotBlank(message = "video.url is required.")
        @Size(max = 2000, message = "video.url must not exceed 2 000 characters.")
        private String url;

        @Size(max = 500, message = "video.caption must not exceed 500 characters.")
        private String caption;
    }

    /** { type: "callout", variant: "info"|"warning"|"note", html: string } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class CalloutBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "callout.variant is required.")
        @Pattern(regexp = "info|warning|note", message = "callout.variant must be 'info', 'warning', or 'note'.")
        private String variant;

        @NotNull(message = "callout.html is required.")
        @Size(max = 10000, message = "callout.html must not exceed 10 000 characters.")
        private String html;
    }

    /** { type: "divider" } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class DividerBlock implements DescriptionBlock {
        private String type;
    }

    /**
     * { type: "feature", side?: "auto"|"left"|"right", url?, alt?, caption?, subheading?, heading?, html?,
     *   listStyle?: "bulleted"|"numbered", items?: string[] }
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

        @Size(max = 500, message = "feature.alt must not exceed 500 characters.")
        private String alt;

        @Size(max = 500, message = "feature.caption must not exceed 500 characters.")
        private String caption;

        @Size(max = 500, message = "feature.subheading must not exceed 500 characters.")
        private String subheading;

        @Size(max = 500, message = "feature.heading must not exceed 500 characters.")
        private String heading;

        @Size(max = 50000, message = "feature.html must not exceed 50 000 characters.")
        private String html;

        @Pattern(regexp = "bulleted|numbered", message = "feature.listStyle must be 'bulleted' or 'numbered'.")
        private String listStyle;

        @Size(max = 200, message = "feature.items must not exceed 200 entries.")
        private List<@Size(max = 2000, message = "Feature list item must not exceed 2 000 characters.") String> items;
    }

    /**
     * { type: "prosCons", title?: string, positive: string[], negative: string[] }
     *
     * <p>Khối "Ưu điểm & Nhược điểm" nhúng trong mô tả. Là nguồn dữ liệu duy nhất cho rich result
     * schema.org positiveNotes/negativeNotes (V175) — backend suy ra khi trả API. Bản EN nằm ở khối
     * tương ứng trong {@code descriptionBlocksEn} (theo vị trí), như list/feature.
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

    /**
     * { type: "suitability", title?: string, cards: [{ audience, advice }], html?: string }
     *
     * <p>Khối "Phù hợp với ai" (V240) nhúng trong mô tả — danh sách thẻ tư vấn. Bản EN nằm ở khối
     * tương ứng trong {@code descriptionBlocksEn}.
     *
     * <p>Chế độ "dán HTML": khi {@code html} non-blank, render {@code html} THAY cho {@code cards}
     * (admin tự chọn chế độ ở UI). HTML được sanitize qua Safelist như sizeGuide.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class SuitabilityBlock implements DescriptionBlock {
        private String type;

        @Size(max = 500, message = "suitability.title must not exceed 500 characters.")
        private String title;

        @Size(max = 100, message = "suitability.cards must not exceed 100 entries.")
        private List<@jakarta.validation.Valid SuitabilityCard> cards;

        @Size(max = 20000, message = "suitability.html must not exceed 20 000 characters.")
        private String html;

        /** Một thẻ tư vấn: đối tượng + lời khuyên. */
        @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
        public static final class SuitabilityCard {
            @Size(max = 500, message = "suitability.card.audience must not exceed 500 characters.")
            private String audience;

            @Size(max = 2000, message = "suitability.card.advice must not exceed 2 000 characters.")
            private String advice;
        }
    }

    /**
     * { type: "sizeGuide", title?: string, html: string }
     *
     * <p>Khối "Bảng size" nhúng trong mô tả — HTML tự do (thường là bảng). Bản EN nằm ở khối tương ứng
     * trong {@code descriptionBlocksEn}.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class SizeGuideBlock implements DescriptionBlock {
        private String type;

        @Size(max = 500, message = "sizeGuide.title must not exceed 500 characters.")
        private String title;

        @Size(max = 20000, message = "sizeGuide.html must not exceed 20 000 characters.")
        private String html;
    }
}
