package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CategoryPermanentDeleteImpactRequest(
        @NotEmpty(message = "categoryIds must not be empty.")
        @Size(max = 100, message = "categoryIds must contain at most 100 items.")
        List<@NotBlank(message = "category id must not be blank.")
                @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "Invalid category id.") String> categoryIds
) {
}
