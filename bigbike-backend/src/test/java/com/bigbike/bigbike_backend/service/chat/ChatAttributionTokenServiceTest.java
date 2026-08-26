package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.config.JwtProperties;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;

class ChatAttributionTokenServiceTest {

    private ChatAttributionTokenService service;

    @BeforeEach
    void setUp() {
        JwtProperties properties = new JwtProperties(mock(Environment.class));
        properties.setSecret("phase-two-test-secret-that-is-long-enough-2026");
        service = new ChatAttributionTokenService(properties);
    }

    @Test
    @DisplayName("AC20: a guest product-view proof survives login but remains product-bound")
    void guestProofCanFollowBrowserIntoSignedInCart() {
        UUID interactionId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant issuedAt = Instant.now().minus(1, ChronoUnit.HOURS);
        var issued = service.issue(interactionId, conversationId, "mu-a", null, issuedAt);

        var verified = service.verify(issued.token(), "mu-a", UUID.randomUUID());

        assertThat(verified.interactionId()).isEqualTo(interactionId);
        assertThat(verified.conversationId()).isEqualTo(conversationId);
        assertThatThrownBy(() -> service.verify(issued.token(), "mu-b", UUID.randomUUID()))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("identified proof is usable only by the same signed-in customer")
    void identifiedProofCannotCrossAccounts() {
        UUID customerId = UUID.randomUUID();
        var issued = service.issue(
                UUID.randomUUID(), UUID.randomUUID(), "mu-a", customerId, Instant.now());

        assertThat(service.verify(issued.token(), "mu-a", customerId).productSlug())
                .isEqualTo("mu-a");
        assertThatThrownBy(() -> service.verify(issued.token(), "mu-a", UUID.randomUUID()))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.verify(issued.token(), "mu-a", null))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("expired or tampered proofs never attribute an order")
    void expiredAndTamperedProofsAreRejected() {
        var expired = service.issue(
                UUID.randomUUID(), UUID.randomUUID(), "mu-a", null,
                Instant.now().minus(169, ChronoUnit.HOURS));
        assertThatThrownBy(() -> service.verify(expired.token(), "mu-a", null))
                .isInstanceOf(ConflictException.class);

        var current = service.issue(
                UUID.randomUUID(), UUID.randomUUID(), "mu-a", null, Instant.now());
        String last = current.token().substring(current.token().length() - 1);
        String replacement = "A".equals(last) ? "B" : "A";
        String tampered = current.token().substring(0, current.token().length() - 1) + replacement;
        assertThatThrownBy(() -> service.verify(tampered, "mu-a", null))
                .isInstanceOf(ConflictException.class);
    }
}
