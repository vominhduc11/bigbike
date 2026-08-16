package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpsertSizeScaleValueRequest {

    @NotBlank
    @Size(max = 64)
    private String valueKey;

    @NotBlank
    @Size(max = 255)
    private String label;

    @NotBlank
    @Size(max = 255)
    private String labelEn;

    @Size(max = 64)
    private String subgroupKey;

    @Size(max = 255)
    private String subgroupLabel;

    @Size(max = 255)
    private String subgroupLabelEn;

    private Integer sortOrder;

    private Boolean active;
}
