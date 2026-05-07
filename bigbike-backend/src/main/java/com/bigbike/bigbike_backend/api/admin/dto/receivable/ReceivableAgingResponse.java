package com.bigbike.bigbike_backend.api.admin.dto.receivable;

import java.math.BigDecimal;

public record ReceivableAgingResponse(
        BigDecimal notDue,
        BigDecimal days0To30,
        BigDecimal days31To60,
        BigDecimal days61To90,
        BigDecimal over90
) {}
