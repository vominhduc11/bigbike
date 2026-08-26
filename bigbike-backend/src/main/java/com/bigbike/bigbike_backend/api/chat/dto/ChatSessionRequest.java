package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ChatSessionRequest(
        @NotNull UUID visitorId,
        @Size(max = 128) String visitorToken,
        @Pattern(regexp = "^(vi|en)$") String locale,
        boolean memoryEnabled
) {}
