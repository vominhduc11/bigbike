package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Create payload for a public size filter group.
 *
 * <p>Only the two display labels are writable. The group key, sort order and active flag are
 * server-derived: the key becomes each scale's public filter namespace and must never move
 * once assigned (see {@code CATALOG_RULE_012}).
 */
@Getter
@Setter
@NoArgsConstructor
public class CreateSizeScaleGroupRequest {

    @NotBlank
    @Size(max = 255)
    private String label;

    @NotBlank
    @Size(max = 255)
    private String labelEn;
}
