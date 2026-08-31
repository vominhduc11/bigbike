package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class InventoryOutOfStockDigestScheduler {

    static final String ENABLED_KEY = "inventory_out_of_stock_digest_enabled";
    static final String TIME_KEY = "inventory_out_of_stock_digest_time";
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private final SiteSettingJpaRepository settingRepository;
    private final InventoryOutOfStockDigestService digestService;
    private final InventoryOutOfStockDigestCoordinator coordinator;
    private final InventoryOutOfStockDigestEmailService emailService;

    @Scheduled(cron = "0 * * * * *", zone = "Asia/Ho_Chi_Minh")
    public void runScheduled() {
        try {
            runAt(ZonedDateTime.now(InventoryOutOfStockDigestService.VIETNAM_ZONE));
        } catch (Exception exception) {
            log.error("Daily out-of-stock digest failed; the scheduler will try again safely.", exception);
        }
    }

    public void runAt(ZonedDateTime timestamp) {
        ZonedDateTime vietnamNow = timestamp.withZoneSameInstant(InventoryOutOfStockDigestService.VIETNAM_ZONE);
        if (!Boolean.parseBoolean(setting(ENABLED_KEY, "true"))) {
            return;
        }

        LocalTime configuredTime;
        try {
            configuredTime = LocalTime.parse(setting(TIME_KEY, "08:00"), TIME_FORMAT);
        } catch (RuntimeException exception) {
            log.error("Out-of-stock digest time is invalid; expected HH:mm.");
            return;
        }
        if (vietnamNow.toLocalTime().isBefore(configuredTime)) {
            return;
        }

        var digestDate = vietnamNow.toLocalDate();
        if (!coordinator.hasRun(digestDate)) {
            coordinator.record(digestService.build(digestDate, vietnamNow.toInstant()));
        }

        coordinator.claimPendingEmail(digestDate, vietnamNow.toInstant()).ifPresent(payload -> {
            boolean accepted = emailService.sendPayload(payload);
            coordinator.recordEmailResult(digestDate, accepted);
        });
    }

    private String setting(String key, String fallback) {
        return settingRepository.findBySettingKey(key)
                .map(setting -> setting.getSettingValue())
                .filter(value -> value != null && !value.isBlank())
                .orElse(fallback);
    }
}
