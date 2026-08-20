package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ChatInteractionRequest(
        @NotNull UUID clientEventId,
        @NotNull UUID conversationId,
        @NotNull UUID assistantMessageId,
        @NotNull
        @Pattern(regexp = "^(LEAD_PROMPT_VIEWED|ACTION_CLICKED)$")
        String type,
        @Min(0) @Max(2) Integer leadPromptSequence,
        @Size(max = 48) String actionType
) {}
