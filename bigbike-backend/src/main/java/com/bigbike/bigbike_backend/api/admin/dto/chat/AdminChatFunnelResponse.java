package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;

public record AdminChatFunnelResponse(
        LocalDate from,
        LocalDate to,
        long conversations,
        long productViews,
        long cartAdds,
        long orders,
        BigDecimal revenue,
        BigDecimal conversationToViewRate,
        BigDecimal viewToCartRate,
        BigDecimal cartToOrderRate,
        Instant matureThrough,
        boolean complete
) {}
