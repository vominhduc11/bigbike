package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Transcript needed by staff, deliberately without lead/contact or attribution analytics. */
public record AdminChatConversationDetailResponse(
        UUID id,
        UUID customerId,
        String locale,
        int turnCount,
        int aiCallCount,
        String endedReason,
        Instant startedAt,
        Instant lastMessageAt,
        List<AdminChatMessageResponse> messages,
        AdminChatHandoffResponse handoff
) {
    public AdminChatConversationDetailResponse {
        messages = messages == null ? List.of() : List.copyOf(messages);
    }
}
