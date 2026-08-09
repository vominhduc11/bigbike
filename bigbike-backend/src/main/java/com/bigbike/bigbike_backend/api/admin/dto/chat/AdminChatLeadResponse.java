package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;

public record AdminChatLeadResponse(
        UUID id,
        String name,
        String phone,
        String note,
        Instant consentedAt
) {}
