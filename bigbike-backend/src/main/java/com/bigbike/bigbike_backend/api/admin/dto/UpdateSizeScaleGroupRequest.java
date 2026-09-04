package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Partial update payload for a size filter group.
 *
 * <p>Every field is optional so the active flag can be toggled without resending both labels
 * (presence-flag semantics, as used by {@code UpdateAttributeRequest}). {@code @NotBlank} is
 * therefore not usable here; blank-but-present labels are rejected in the service so the
 * distinction between "omitted" and "cleared" survives.
 *
 * <p>The group key is intentionally absent — it is immutable.
 */
@Getter
@Setter
@NoArgsConstructor
public class UpdateSizeScaleGroupRequest {

    @Size(max = 255)
    private String label;

    @Size(max = 255)
    private String labelEn;

    private Boolean active;
}
