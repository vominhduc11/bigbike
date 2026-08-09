package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminChatConversationDetailResponse(
        UUID id,
        UUID customerId,
        String locale,
        int turnCount,
        int aiCallCount,
        String leadOfferStatus,
        String endedReason,
        Instant startedAt,
        Instant lastMessageAt,
        List<AdminChatMessageResponse> messages,
        AdminChatLeadResponse lead
) {}
