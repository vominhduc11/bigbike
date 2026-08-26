package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** A quick-choice answer is accepted only when it matches the conversation's pending question. */
public record ChatClarificationSelectionRequest(
        @NotNull UUID clarificationId,
        @NotBlank
        @Size(max = 80)
        @Pattern(regexp = "^[a-z0-9]+(?:[-_][a-z0-9]+)*$")
        String optionId
) {}
