package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ImportBrandLogoUrlRequest(
        @NotBlank(message = "URL logo không được để trống / logo URL must not be blank.")
        @Size(max = 2048, message = "URL logo tối đa 2048 ký tự / logo URL must be at most 2048 characters.")
        String url,
        @Size(max = 255, message = "Alt text tối đa 255 ký tự / alt text must be at most 255 characters.")
        String altText,
        UUID folderId
) {
}
