package com.bigbike.bigbike_backend.service.review.invitation;

import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationCampaignEntity;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationCampaignJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDeliveryJpaRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewInvitationLifecycleService {

    private final ReviewInvitationCampaignJpaRepository campaignRepository;
    private final ReviewInvitationDeliveryJpaRepository deliveryRepository;

    @Transactional
    public void onSettingUpdated(String key, String oldValue, String newValue, Instant now) {
        if (ReviewInvitationSettings.ENABLED_KEY.equals(key)) {
            boolean wasEnabled = Boolean.parseBoolean(oldValue);
            boolean enabled = Boolean.parseBoolean(newValue);
            if (wasEnabled == enabled) {
                return;
            }
            if (enabled) {
                openFreshCampaign(now);
            } else {
                closeActiveCampaign(now);
            }
            return;
        }

        if (ReviewInvitationSettings.DELAY_DAYS_KEY.equals(key)
                && newValue != null && !newValue.equals(oldValue)) {
            int delayDays = Integer.parseInt(newValue.trim());
            campaignRepository.findActiveForUpdate().ifPresent(campaign ->
                    deliveryRepository.recalculatePendingDueDates(
                            campaign.getId(), delayDays, now));
        }
    }

    private void openFreshCampaign(Instant now) {
        campaignRepository.findActiveForUpdate().ifPresent(active -> {
            active.setDeactivatedAt(now);
            active.setUpdatedAt(now);
            campaignRepository.save(active);
            deliveryRepository.skipPendingByCampaign(active.getId(), "CAMPAIGN_CLOSED", now);
        });

        ReviewInvitationCampaignEntity campaign = new ReviewInvitationCampaignEntity();
        campaign.setActivatedAt(now);
        campaign.setCreatedAt(now);
        campaign.setUpdatedAt(now);
        campaignRepository.save(campaign);
    }

    private void closeActiveCampaign(Instant now) {
        campaignRepository.findActiveForUpdate().ifPresent(active -> {
            active.setDeactivatedAt(now);
            active.setUpdatedAt(now);
            campaignRepository.save(active);
            deliveryRepository.skipPendingByCampaign(active.getId(), "CAMPAIGN_CLOSED", now);
        });
    }
}
