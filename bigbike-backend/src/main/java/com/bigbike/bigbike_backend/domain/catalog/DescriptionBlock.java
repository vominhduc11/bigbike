package com.bigbike.bigbike_backend.domain.catalog;

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
})
public sealed interface DescriptionBlock
        permits DescriptionBlock.HeadingBlock, DescriptionBlock.ParagraphBlock,
                DescriptionBlock.ListBlock,    DescriptionBlock.ImageBlock,
                DescriptionBlock.VideoBlock,   DescriptionBlock.CalloutBlock,
                DescriptionBlock.DividerBlock {

    String getType();

    /** { type: "heading", level: 2|3, text: string } */
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
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class ParagraphBlock implements DescriptionBlock {
        private String type;

        @NotNull(message = "paragraph.html is required.")
        @Size(max = 50000, message = "paragraph.html must not exceed 50 000 characters.")
        private String html;
    }

    /** { type: "list", style: "bulleted"|"numbered", items: string[] } */
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
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    final class DividerBlock implements DescriptionBlock {
        private String type;
    }
}
