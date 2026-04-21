package com.bigbike.bigbike_backend.domain.customer;

import java.util.UUID;

public record CustomerPrincipal(UUID customerId, String email, String phone, UUID sessionId) {}
