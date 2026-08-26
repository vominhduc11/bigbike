package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.UUID;

public record ChatFeedbackResponse(UUID id, String rating, String reason, boolean recorded) {}
