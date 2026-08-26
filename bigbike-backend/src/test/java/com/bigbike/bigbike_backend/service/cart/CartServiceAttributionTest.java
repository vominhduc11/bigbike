package com.bigbike.bigbike_backend.service.cart;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CartServiceAttributionTest {

    @Test
    @DisplayName("last eligible assistant touch is copied as one proof tuple when carts merge")
    void newerAttributionReplacesConversationInteractionAndTimestampTogether() {
        CartItemEntity customerLine = attributedAt(Instant.parse("2026-08-20T01:00:00Z"));
        UUID oldConversation = customerLine.getAssistantConversationId();
        CartItemEntity guestLine = attributedAt(Instant.parse("2026-08-21T01:00:00Z"));

        CartService.mergeAssistantAttribution(customerLine, guestLine);

        assertThat(customerLine.getAssistantConversationId())
                .isEqualTo(guestLine.getAssistantConversationId())
                .isNotEqualTo(oldConversation);
        assertThat(customerLine.getAssistantInteractionId())
                .isEqualTo(guestLine.getAssistantInteractionId());
        assertThat(customerLine.getAssistantAttributedAt())
                .isEqualTo(guestLine.getAssistantAttributedAt());
    }

    @Test
    @DisplayName("an older guest touch cannot replace a newer signed-in cart attribution")
    void olderAttributionDoesNotReplaceNewerProof() {
        CartItemEntity customerLine = attributedAt(Instant.parse("2026-08-21T01:00:00Z"));
        UUID conversation = customerLine.getAssistantConversationId();
        UUID interaction = customerLine.getAssistantInteractionId();
        Instant attributedAt = customerLine.getAssistantAttributedAt();

        CartService.mergeAssistantAttribution(
                customerLine, attributedAt(Instant.parse("2026-08-20T01:00:00Z")));

        assertThat(customerLine.getAssistantConversationId()).isEqualTo(conversation);
        assertThat(customerLine.getAssistantInteractionId()).isEqualTo(interaction);
        assertThat(customerLine.getAssistantAttributedAt()).isEqualTo(attributedAt);
    }

    private static CartItemEntity attributedAt(Instant time) {
        CartItemEntity item = new CartItemEntity();
        item.setAssistantConversationId(UUID.randomUUID());
        item.setAssistantInteractionId(UUID.randomUUID());
        item.setAssistantAttributedAt(time);
        return item;
    }
}
