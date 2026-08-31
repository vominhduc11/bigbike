package com.bigbike.bigbike_backend.service.review.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReviewInvitationServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-08T02:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 8);

    @Mock private ReviewInvitationStore store;
    @Mock private ReviewInvitationEmailService emailService;
    @Mock private ReviewInvitationClock clock;

    @InjectMocks private ReviewInvitationService service;

    @Test
    void oneClaimProducesExactlyOneEmailAndIsNotRepeated() {
        ReviewInvitationDispatchClaim claim = claim();
        when(clock.now()).thenReturn(NOW);
        when(clock.todayInVietnam()).thenReturn(TODAY);
        when(store.claimNext(NOW, TODAY)).thenReturn(Optional.of(claim), Optional.empty());
        when(emailService.send(claim)).thenReturn(true);

        assertThat(service.dispatchOne()).isTrue();
        assertThat(service.dispatchOne()).isFalse();

        verify(emailService, times(1)).send(claim);
        verify(store, times(1)).completeAttempt(claim.deliveryId(), true, NOW);
    }

    @Test
    void failedSendIsRecordedOnceWithoutAnAutomaticRetry() {
        ReviewInvitationDispatchClaim claim = claim();
        when(clock.now()).thenReturn(NOW);
        when(clock.todayInVietnam()).thenReturn(TODAY);
        when(store.claimNext(NOW, TODAY)).thenReturn(Optional.of(claim), Optional.empty());
        when(emailService.send(claim)).thenReturn(false);

        assertThat(service.dispatchOne()).isTrue();
        assertThat(service.dispatchOne()).isFalse();

        verify(emailService, times(1)).send(claim);
        verify(store, times(1)).completeAttempt(claim.deliveryId(), false, NOW);
    }

    private static ReviewInvitationDispatchClaim claim() {
        return new ReviewInvitationDispatchClaim(
                UUID.randomUUID(),
                "rider@example.com",
                "Minh",
                "BB-1001",
                "vi",
                "unsubscribe-token",
                List.of(new ReviewInvitationDispatchClaim.ProductClaim(
                        "helmet-1", "Mũ bảo hiểm", "mu-bao-hiem", "review-token")));
    }
}
