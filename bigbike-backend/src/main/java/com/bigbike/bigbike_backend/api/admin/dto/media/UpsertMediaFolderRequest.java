package com.bigbike.bigbike_backend.api.admin.dto.media;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpsertMediaFolderRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 160) String slug,
        @Size(max = 2000) String description
) {}
