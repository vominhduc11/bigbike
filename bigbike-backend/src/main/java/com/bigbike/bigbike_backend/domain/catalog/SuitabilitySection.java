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
 * "Phù hợp với ai" — danh sách thẻ tư vấn hiện thành section riêng, cố định trên PDP (V240, tách
 * khỏi {@code description_blocks} ở V327/V328 — trước đó là khối {@code suitability} đa hình trong
 * mảng, xem lịch sử ở {@code DescriptionBlock.java}). Bilingual dual-field: {@code titleEn}/
 * {@code htmlEn}.
 *
 * <p>{@code html}/{@code htmlEn} là nguồn render duy nhất, giống {@link SizeGuideSection}.
 * Tab "có cấu trúc" trong admin chỉ parse/merge tạm vào HTML.
 */
@JsonIgnoreProperties(ignoreUnknown = false)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public final class SuitabilitySection {

    // title/titleEn and html/htmlEn are bilingual pairs — ALWAYS so export doesn't drop either
    // side when blank.
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 500, message = "suitabilitySection.title must not exceed 500 characters.")
    private String title;

    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 500, message = "suitabilitySection.titleEn must not exceed 500 characters.")
    private String titleEn;

    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 20000, message = "suitabilitySection.html must not exceed 20 000 characters.")
    private String html;

    // Optional English translation — never required, length-checked only.
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 20000, message = "suitabilitySection.htmlEn must not exceed 20 000 characters.")
    private String htmlEn;

    private static String pick(String base, String en, String locale) {
        return "en".equals(locale) && en != null && !en.isBlank() ? en : base;
    }

    /** Locale-resolve: mọi field dịch trở thành {@code pick(base, en, locale)}, bỏ các field {@code *En}. */
    public static SuitabilitySection resolveForLocale(SuitabilitySection section, String locale) {
        if (section == null) return null;
        return SuitabilitySection.builder()
                .title(pick(section.getTitle(), section.getTitleEn(), locale))
                .html(pick(section.getHtml(), section.getHtmlEn(), locale))
                .build();
    }
}
