package com.bigbike.bigbike_backend.api.admin.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A single product commitment row in an {@link UpsertProductRequest} (V232). */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommitmentRequest {

    @Size(max = 40, message = "Commitment icon key is too long.")
    private String icon;

    // title/titleEn and subtitle/subtitleEn are bilingual pairs — ALWAYS so export (EXPORT_MAPPER
    // is NON_NULL by default) still emits both sides, null-filling whichever is blank.
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 200, message = "Commitment title is too long.")
    private String title;

    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 300, message = "Commitment subtitle is too long.")
    private String subtitle;

    private Integer sortOrder;

    // Optional English content — English is optional per PRODUCT_RULE_001.
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 200, message = "Commitment English title is too long.")
    private String titleEn;

    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 300, message = "Commitment English subtitle is too long.")
    private String subtitleEn;
}
