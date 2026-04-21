package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerAuthResponse;

public record CustomerAuthResult(
        CustomerAuthResponse response,
        String rawSessionToken,
        String rawRefreshToken
) {}
