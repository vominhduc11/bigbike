package com.bigbike.bigbike_backend.api.admin.dto.order;

import java.time.Instant;

public record OrderHistoryClassificationResponse(
        String batchKey,
        String labelVi,
        String labelEn,
        String reasonVi,
        String reasonEn,
        Instant classifiedAt
) {}
