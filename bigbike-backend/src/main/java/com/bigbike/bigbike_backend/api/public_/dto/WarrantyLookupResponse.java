package com.bigbike.bigbike_backend.api.public_.dto;

/**
 * Response for GET /api/v1/warranties/lookup.
 * Field names are preserved from the previous Map<String,Object> response to keep
 * backward-compatibility with web/mobile clients.
 */
public record WarrantyLookupResponse(
        String serialNumber,
        String productName,
        String startDate,
        String endDate,
        String status,
        long daysLeft
) {}
