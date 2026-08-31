package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Read-only transcript and image metadata for operational review. */
public record AdminChatConversationDetailResponse(
        UUID id,
        UUID customerId,
        String locale,
        int turnCount,
        int aiCallCount,
        String endedReason,
        Instant startedAt,
        Instant lastMessageAt,
        List<AdminChatMessageResponse> messages
) {
    public AdminChatConversationDetailResponse {
        messages = messages == null ? List.of() : List.copyOf(messages);
    }
}
