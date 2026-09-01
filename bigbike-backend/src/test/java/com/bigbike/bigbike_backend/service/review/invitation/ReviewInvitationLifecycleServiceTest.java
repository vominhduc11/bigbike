package com.bigbike.bigbike_backend.service.review.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationCampaignEntity;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationCampaignJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDeliveryJpaRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReviewInvitationLifecycleServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-31T03:15:00Z");

    @Mock private ReviewInvitationCampaignJpaRepository campaignRepository;
    @Mock private ReviewInvitationDeliveryJpaRepository deliveryRepository;
    @Mock private ReviewInvitationSettings settings;

    @InjectMocks private ReviewInvitationLifecycleService service;

    @Test
    void firstEnabledSchedulerCallbackCreatesAFreshCutoffAtThatExactMoment() {
        when(campaignRepository.findActiveForUpdate()).thenReturn(Optional.empty());
        when(settings.get()).thenReturn(new ReviewInvitationSettings.Snapshot(true, 7, 20));

        service.synchronize(NOW);

        ArgumentCaptor<ReviewInvitationCampaignEntity> captor =
                ArgumentCaptor.forClass(ReviewInvitationCampaignEntity.class);
        verify(campaignRepository).save(captor.capture());
        assertThat(captor.getValue().getActivatedAt()).isEqualTo(NOW);
        assertThat(captor.getValue().getDeactivatedAt()).isNull();
    }

    @Test
    void disablingClosesTheCampaignAndSkipsEveryPendingInvitation() {
        ReviewInvitationCampaignEntity active = activeCampaign();
        when(campaignRepository.findActiveForUpdate()).thenReturn(Optional.of(active));
        when(settings.get()).thenReturn(new ReviewInvitationSettings.Snapshot(false, 7, 20));

        service.synchronize(NOW);

        assertThat(active.getDeactivatedAt()).isEqualTo(NOW);
        verify(campaignRepository).save(active);
        verify(deliveryRepository).skipPendingByCampaign(
                active.getId(), "CAMPAIGN_CLOSED", NOW);
    }

    @Test
    void enabledCallbackAfterClosureCreatesANewCampaignWithoutTouchingOldRows() {
        when(settings.get()).thenReturn(
                new ReviewInvitationSettings.Snapshot(false, 7, 20),
                new ReviewInvitationSettings.Snapshot(true, 7, 20));
        ReviewInvitationCampaignEntity active = activeCampaign();
        when(campaignRepository.findActiveForUpdate())
                .thenReturn(Optional.of(active), Optional.empty());

        service.synchronize(NOW);
        service.synchronize(NOW.plusSeconds(60));

        ArgumentCaptor<ReviewInvitationCampaignEntity> captor =
                ArgumentCaptor.forClass(ReviewInvitationCampaignEntity.class);
        verify(campaignRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues().get(1).getActivatedAt()).isEqualTo(NOW.plusSeconds(60));
        verify(deliveryRepository).skipPendingByCampaign(active.getId(), "CAMPAIGN_CLOSED", NOW);
    }

    private static ReviewInvitationCampaignEntity activeCampaign() {
        ReviewInvitationCampaignEntity active = new ReviewInvitationCampaignEntity();
        active.setId(UUID.randomUUID());
        active.setActivatedAt(NOW.minusSeconds(60));
        active.setCreatedAt(NOW.minusSeconds(60));
        active.setUpdatedAt(NOW.minusSeconds(60));
        return active;
    }
}
