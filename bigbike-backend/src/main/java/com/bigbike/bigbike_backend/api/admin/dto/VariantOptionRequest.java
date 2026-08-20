package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
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
public class VariantOptionRequest {

    @Size(max = 100, message = "Option name is too long.")
    private String optionName;

    @Size(max = 255, message = "Option value is too long.")
    private String optionValue;

    /**
     * When present, backend links FK directly by ID — bypasses text-based attribute lookup.
     * Ids are prefixed public ids ("attr-value-" + UUID = 47 chars), stored in the
     * varchar(64) column attribute_values.id — so the bound must match the column, not a
     * bare 36-char UUID (the old max=36 rejected every real id with HTTP 400).
     */
    @NotBlank(message = "Phải chọn giá trị thuộc tính cho biến thể.")
    @Size(max = 64, message = "Mã giá trị thuộc tính quá dài.")
    private String attributeValueId;
}
