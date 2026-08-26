package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;

public record ChatRealtimeTokenResponse(String token, Instant expiresAt) {}
