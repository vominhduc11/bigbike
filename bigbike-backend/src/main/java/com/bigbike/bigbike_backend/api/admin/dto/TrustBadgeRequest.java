package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A single trust badge row in an {@link UpsertProductRequest} (V233). */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrustBadgeRequest {

    @Size(max = 200, message = "Trust badge content is too long.")
    private String content;

    private Integer sortOrder;

    // Optional English content — English is optional per PRODUCT_RULE_001.
    @Size(max = 200, message = "Trust badge English content is too long.")
    private String contentEn;
}
