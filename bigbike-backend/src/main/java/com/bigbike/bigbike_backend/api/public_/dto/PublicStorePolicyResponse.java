package com.bigbike.bigbike_backend.api.public_.dto;

import java.time.Instant;

public record PublicStorePolicyResponse(
        String topic,
        String title,
        String bodyHtml,
        Instant updatedAt
) {}
