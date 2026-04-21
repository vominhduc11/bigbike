package com.bigbike.bigbike_backend.api.customer.dto;

public record CustomerAuthResponse(
        CustomerSummary customer,
        String csrfToken
) {}
