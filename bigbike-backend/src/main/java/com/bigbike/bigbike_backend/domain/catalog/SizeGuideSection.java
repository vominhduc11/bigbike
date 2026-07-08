package com.bigbike.bigbike_backend.domain.catalog;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * "Bảng size" — HTML tự do (thường là bảng), hiện thành section riêng, cố định trên PDP (V246, tách
 * khỏi {@code description_blocks} ở V327/V328 — trước đó là khối {@code sizeGuide} đa hình trong
 * mảng, xem lịch sử ở {@code DescriptionBlock.java}). Bilingual dual-field: {@code titleEn}/
 * {@code htmlEn}.
 */
@JsonIgnoreProperties(ignoreUnknown = false)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.ALWAYS)
public final class SizeGuideSection {

    @Size(max = 500, message = "sizeGuideSection.title must not exceed 500 characters.")
    private String title;

    @Size(max = 500, message = "sizeGuideSection.titleEn must not exceed 500 characters.")
    private String titleEn;

    @Size(max = 20000, message = "sizeGuideSection.html must not exceed 20 000 characters.")
    private String html;

    // Optional English translation — never required, length-checked only.
    @Size(max = 20000, message = "sizeGuideSection.htmlEn must not exceed 20 000 characters.")
    private String htmlEn;

    private static String pick(String base, String en, String locale) {
        return "en".equals(locale) && en != null && !en.isBlank() ? en : base;
    }

    /** Locale-resolve: mọi field dịch trở thành {@code pick(base, en, locale)}, bỏ các field {@code *En}. */
    public static SizeGuideSection resolveForLocale(SizeGuideSection section, String locale) {
        if (section == null) return null;
        return SizeGuideSection.builder()
                .title(pick(section.getTitle(), section.getTitleEn(), locale))
                .html(pick(section.getHtml(), section.getHtmlEn(), locale))
                .build();
    }
}
