package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ChatLeadDeclineRequest(@NotNull UUID conversationId) {}
