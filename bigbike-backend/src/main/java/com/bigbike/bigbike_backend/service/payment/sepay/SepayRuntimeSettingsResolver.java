package com.bigbike.bigbike_backend.service.payment.sepay;

import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Reads SePay config from site_settings (DB overrides env).
 * Uses a simple in-memory cache invalidated on write via evict().
 */
@Component
public class SepayRuntimeSettingsResolver {

    private final SiteSettingJpaRepository settingsRepo;
    private volatile SepayConfig cached;

    public SepayRuntimeSettingsResolver(SiteSettingJpaRepository settingsRepo) {
        this.settingsRepo = settingsRepo;
    }

    public SepayConfig get() {
        if (cached == null) {
            synchronized (this) {
                if (cached == null) cached = load();
            }
        }
        return cached;
    }

    public void evict() {
        cached = null;
    }

    private SepayConfig load() {
        Map<String, String> m = new ConcurrentHashMap<>();
        settingsRepo.findBySettingGroup("payment_sepay")
                .forEach(s -> m.put(s.getSettingKey(), s.getSettingValue()));

        return new SepayConfig(
                "true".equalsIgnoreCase(m.getOrDefault("payment_sepay.enabled", "false")),
                m.getOrDefault("payment_sepay.bank_name", ""),
                m.getOrDefault("payment_sepay.bank_bin", ""),
                m.getOrDefault("payment_sepay.account_number", ""),
                m.getOrDefault("payment_sepay.account_holder", ""),
                parseIntSafe(m.getOrDefault("payment_sepay.timeout_hours", "48"), 48)
        );
    }

    private int parseIntSafe(String val, int fallback) {
        try { return Integer.parseInt(val.trim()); } catch (Exception e) { return fallback; }
    }

    public record SepayConfig(
            boolean enabled,
            String bankName,
            String bankBin,
            String accountNumber,
            String accountHolder,
            int timeoutHours
    ) {
        public boolean isConfigured() {
            return !accountNumber.isBlank() && !accountHolder.isBlank();
        }
    }
}
