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
public class VariantOptionRequest {

    @Size(max = 100, message = "Option name is too long.")
    private String optionName;

    @Size(max = 255, message = "Option value is too long.")
    private String optionValue;

    /** When present, backend links FK directly by ID — bypasses text-based attribute lookup. */
    @Size(max = 36)
    private String attributeValueId;

    /** Direct swatch image — publicUrl or media UUID picked from the media library. */
    @Size(max = 512, message = "Swatch image ID is too long.")
    private String swatchImageId;
}
