package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChatPageContextRequest(
        @NotBlank
        @Pattern(regexp = "^PRODUCT$", message = "Ngữ cảnh trang không hợp lệ.")
        String type,
        @NotBlank
        @Size(max = 160)
        String productSlug
) {}
