package com.bigbike.bigbike_backend.api.admin.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record AdminChatSendMessageRequest(
        @NotNull UUID requestId,
        @NotBlank @Size(max = 2000) String content
) {}
