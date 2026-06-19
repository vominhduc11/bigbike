package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A single "Specs Dashboard" stat box in an {@link UpsertProductRequest} (V235). */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpecStatRequest {

    @Size(max = 60, message = "Spec stat value is too long.")
    private String value;

    @Size(max = 80, message = "Spec stat label is too long.")
    private String label;

    private Integer sortOrder;

    // Optional English content — English is optional per PRODUCT_RULE_001.
    @Size(max = 60, message = "Spec stat English value is too long.")
    private String valueEn;

    @Size(max = 80, message = "Spec stat English label is too long.")
    private String labelEn;
}
