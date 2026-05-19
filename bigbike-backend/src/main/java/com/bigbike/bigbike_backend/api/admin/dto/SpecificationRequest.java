package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpecificationRequest {

    @Size(max = 255, message = "Specification name is too long.")
    private String name;

    @Size(max = 2000, message = "Specification value is too long.")
    private String value;

    @Size(max = 100, message = "Specification group name is too long.")
    private String groupName;

    private Integer sortOrder;

    // Optional English content (V136). Not required — English is optional per PRODUCT_RULE_001.
    @Size(max = 255, message = "Specification English name is too long.")
    private String nameEn;

    @Size(max = 2000, message = "Specification English value is too long.")
    private String valueEn;

    @Size(max = 100, message = "Specification English group name is too long.")
    private String groupNameEn;
}
