package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ChatLeadOfferRequest(
        @NotNull(message = "Thiếu mã yêu cầu mở biểu mẫu liên hệ.")
        UUID requestId,
        UUID conversationId,
        @Pattern(regexp = "^(vi|en)$", message = "Ngôn ngữ phải là vi hoặc en.")
        String locale,
        @Size(max = 128) String visitorToken
) {
    public ChatLeadOfferRequest(UUID requestId, UUID conversationId, String locale) {
        this(requestId, conversationId, locale, null);
    }
}
