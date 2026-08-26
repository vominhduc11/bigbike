package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ChatFeedbackRequest(
        @NotBlank @Pattern(regexp = "^(HELPFUL|UNHELPFUL)$") String rating,
        @Pattern(regexp = "^(WRONG_ANSWER|MISUNDERSTOOD|MISSING_INFORMATION|OFF_TOPIC)$") String reason
) {}
