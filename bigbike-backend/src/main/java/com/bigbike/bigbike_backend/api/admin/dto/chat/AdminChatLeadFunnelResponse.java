package com.bigbike.bigbike_backend.api.admin.dto.chat;

public record AdminChatLeadFunnelResponse(
        long sequence1Viewed,
        long sequence2Viewed,
        long accepted,
        long declined
) {}
