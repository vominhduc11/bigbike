package com.bigbike.bigbike_backend.service.review.invitation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ReviewInvitationSettingsTest {

    @Test
    void enabledByDefaultConfigurationUsesFixedOperationalValues() {
        ReviewInvitationSettings settings = new ReviewInvitationSettings(true);

        assertThat(settings.get()).isEqualTo(
                new ReviewInvitationSettings.Snapshot(true, 7, 20));
    }

    @Test
    void emergencyConfigurationDisablesOnlyTheWorkflowSwitch() {
        ReviewInvitationSettings settings = new ReviewInvitationSettings(false);

        assertThat(settings.get()).isEqualTo(
                new ReviewInvitationSettings.Snapshot(false, 7, 20));
    }
}
