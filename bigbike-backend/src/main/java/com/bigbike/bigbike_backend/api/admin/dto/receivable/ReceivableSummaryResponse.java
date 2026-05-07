package com.bigbike.bigbike_backend.api.admin.dto.receivable;

import java.math.BigDecimal;

public record ReceivableSummaryResponse(
        BigDecimal totalOutstanding,
        BigDecimal overdueOutstanding,
        BigDecimal writtenOffTotal,
        long countOpen,
        long countOverdue
) {}
