package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.util.List;

public record AdminChatHandoffSummaryResponse(
        long waitingCount,
        List<AdminChatHandoffResponse> items
) {}
