package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;
import java.util.UUID;

public record ChatInteractionRequest(
        @NotNull UUID clientEventId,
        @NotNull UUID conversationId,
        @NotNull UUID assistantMessageId,
        @NotNull
        @Pattern(regexp = "^(LEAD_PROMPT_VIEWED|ACTION_CLICKED|PRODUCT_VIEWED)$")
        String type,
        @Min(0) @Max(2) Integer leadPromptSequence,
        @Size(max = 48) String actionType,
        @Size(max = 255) String productSlug,
        @Size(max = 128) String visitorToken
) {
    public ChatInteractionRequest(
            UUID clientEventId,
            UUID conversationId,
            UUID assistantMessageId,
            String type,
            Integer leadPromptSequence,
            String actionType,
            String productSlug
    ) {
        this(clientEventId, conversationId, assistantMessageId, type,
                leadPromptSequence, actionType, productSlug, null);
    }

    public ChatInteractionRequest(
            UUID clientEventId,
            UUID conversationId,
            UUID assistantMessageId,
            String type,
            Integer leadPromptSequence,
            String actionType
    ) {
        this(clientEventId, conversationId, assistantMessageId, type,
                leadPromptSequence, actionType, null, null);
    }

    @AssertTrue(message = "Dữ liệu tương tác không hợp lệ.")
    public boolean hasValidShape() {
        if ("PRODUCT_VIEWED".equals(type)) {
            return leadPromptSequence == null && actionType == null
                    && productSlug != null && !productSlug.isBlank();
        }
        return productSlug == null;
    }
}
