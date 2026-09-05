package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * CHAT_RULE_049 (owner decision 2026-09-05): no long-term memory window and no memory switch.
 * {@code activeConversationId} only ever refers to the conversation of the current session.
 */
public record ChatSessionResponse(
        String visitorToken,
        UUID activeConversationId
) {}
