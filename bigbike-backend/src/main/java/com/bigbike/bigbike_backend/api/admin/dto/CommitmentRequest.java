package com.bigbike.bigbike_backend.api.admin.dto;

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

    @Size(max = 200, message = "Commitment title is too long.")
    private String title;

    @Size(max = 300, message = "Commitment subtitle is too long.")
    private String subtitle;

    private Integer sortOrder;

    // Optional English content — English is optional per PRODUCT_RULE_001.
    @Size(max = 200, message = "Commitment English title is too long.")
    private String titleEn;

    @Size(max = 300, message = "Commitment English subtitle is too long.")
    private String subtitleEn;
}
