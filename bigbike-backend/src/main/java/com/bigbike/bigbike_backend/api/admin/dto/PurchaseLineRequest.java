package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A single "Mua tại BigBike.vn" line in an {@link UpsertProductRequest} (V249). */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseLineRequest {

    @Size(max = 40, message = "Purchase line icon key is too long.")
    private String icon;

    @Size(max = 200, message = "Purchase line label is too long.")
    private String label;

    @Size(max = 300, message = "Purchase line value is too long.")
    private String value;

    private Integer sortOrder;

    // Optional English content — English is optional per PRODUCT_RULE_001.
    @Size(max = 200, message = "Purchase line English label is too long.")
    private String labelEn;

    @Size(max = 300, message = "Purchase line English value is too long.")
    private String valueEn;
}
