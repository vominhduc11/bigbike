package com.bigbike.bigbike_backend.api.admin.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminChatModelUpdateRequest(
        @NotBlank
        @Size(max = 120)
        @Pattern(regexp = "[a-z0-9][a-z0-9.-]*", message = "Model id is invalid.")
        String modelId
) {}
