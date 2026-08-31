package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.OptionalInt;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderOperationsSettings {

    public static final String OVERDUE_DAYS_KEY = "order_overdue_days";

    private final SiteSettingJpaRepository settingRepository;

    @Transactional(readOnly = true)
    public OptionalInt overdueDays() {
        return settingRepository.findBySettingKey(OVERDUE_DAYS_KEY)
                .flatMap(setting -> {
                    try {
                        int value = Integer.parseInt(setting.getSettingValue().trim());
                        if (value >= 1) return java.util.Optional.of(value);
                    } catch (RuntimeException ignored) {
                        // Logged once below with no raw value to avoid leaking configuration.
                    }
                    return java.util.Optional.empty();
                })
                .map(OptionalInt::of)
                .orElseGet(() -> {
                    log.error("Order overdue reminder disabled: setting {} is missing or invalid.", OVERDUE_DAYS_KEY);
                    return OptionalInt.empty();
                });
    }
}
