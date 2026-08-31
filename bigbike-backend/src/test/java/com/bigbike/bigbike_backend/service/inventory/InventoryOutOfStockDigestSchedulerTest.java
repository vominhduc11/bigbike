package com.bigbike.bigbike_backend.service.inventory;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InventoryOutOfStockDigestSchedulerTest {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock private SiteSettingJpaRepository settingRepository;
    @Mock private InventoryOutOfStockDigestService digestService;
    @Mock private InventoryOutOfStockDigestCoordinator coordinator;
    @Mock private InventoryOutOfStockDigestEmailService emailService;

    private InventoryOutOfStockDigestScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new InventoryOutOfStockDigestScheduler(
                settingRepository, digestService, coordinator, emailService);
    }

    @Test
    void disabledSettingProducesNoDigestAndNoEmail() {
        when(settingRepository.findBySettingKey(InventoryOutOfStockDigestScheduler.ENABLED_KEY))
                .thenReturn(Optional.of(setting("false")));

        scheduler.runAt(ZonedDateTime.of(2026, 8, 31, 9, 0, 0, 0, VIETNAM));

        verifyNoInteractions(digestService, coordinator, emailService);
    }

    @Test
    void emptyDigestRecordsTheDayButSendsNothing() {
        dueSettings();
        LocalDate date = LocalDate.of(2026, 8, 31);
        InventoryOutOfStockDigest empty = new InventoryOutOfStockDigest(
                1, date, Instant.parse("2026-08-31T01:00:00Z"),
                new InventoryOutOfStockDigest.Counts(0, 0, 0), List.of(), List.of());
        when(coordinator.hasRun(date)).thenReturn(false);
        when(digestService.build(any(), any())).thenReturn(empty);
        when(coordinator.claimPendingEmail(any(), any())).thenReturn(Optional.empty());

        scheduler.runAt(ZonedDateTime.of(2026, 8, 31, 8, 0, 0, 0, VIETNAM));

        verify(coordinator).record(empty);
        verify(emailService, never()).sendPayload(any());
    }

    @Test
    void oneClaimProducesOneAggregateEmailAttempt() {
        dueSettings();
        LocalDate date = LocalDate.of(2026, 8, 31);
        when(coordinator.hasRun(date)).thenReturn(true);
        when(coordinator.claimPendingEmail(any(), any())).thenReturn(Optional.of("{digest}"));
        when(emailService.sendPayload("{digest}")).thenReturn(true);

        scheduler.runAt(ZonedDateTime.of(2026, 8, 31, 10, 15, 0, 0, VIETNAM));

        verify(emailService).sendPayload("{digest}");
        verify(coordinator).recordEmailResult(date, true);
        verify(digestService, never()).build(any(), any());
    }

    @Test
    void configuredTimeIsRespected() {
        dueSettings();

        scheduler.runAt(ZonedDateTime.of(2026, 8, 31, 7, 59, 0, 0, VIETNAM));

        verifyNoInteractions(digestService, coordinator, emailService);
    }

    private void dueSettings() {
        when(settingRepository.findBySettingKey(InventoryOutOfStockDigestScheduler.ENABLED_KEY))
                .thenReturn(Optional.of(setting("true")));
        when(settingRepository.findBySettingKey(InventoryOutOfStockDigestScheduler.TIME_KEY))
                .thenReturn(Optional.of(setting("08:00")));
    }

    private static SiteSettingEntity setting(String value) {
        SiteSettingEntity setting = new SiteSettingEntity();
        setting.setSettingValue(value);
        return setting;
    }
}
