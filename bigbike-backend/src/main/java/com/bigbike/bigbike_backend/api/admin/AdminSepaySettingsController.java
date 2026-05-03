package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.payment.sepay.SepayRuntimeSettingsResolver;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;

import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/settings/sepay")
public class AdminSepaySettingsController {

    public record BankTransferSettingsRequest(
            Boolean enabled,
            String bankName,
            String bankBin,
            String accountNumber,
            String accountHolder,
            Integer timeoutHours
    ) {}

    public record BankTransferSettingsResponse(
            boolean enabled,
            String bankName,
            String bankBin,
            String accountNumber,
            String accountHolder,
            int timeoutHours
    ) {}

    private final SiteSettingJpaRepository settingsRepo;
    private final SepayRuntimeSettingsResolver settingsResolver;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminSepaySettingsController(
            SiteSettingJpaRepository settingsRepo,
            SepayRuntimeSettingsResolver settingsResolver,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.settingsRepo = settingsRepo;
        this.settingsResolver = settingsResolver;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiDataResponse<BankTransferSettingsResponse> getSettings(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "settings.read");
        var cfg = settingsResolver.get();
        return apiResponseFactory.data(new BankTransferSettingsResponse(
                cfg.enabled(), cfg.bankName(), cfg.bankBin(),
                cfg.accountNumber(), cfg.accountHolder(), cfg.timeoutHours()
        ), request);
    }

    @PutMapping
    public ApiDataResponse<BankTransferSettingsResponse> updateSettings(
            @RequestBody BankTransferSettingsRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.update");
        if (req.enabled() != null) updateKey("payment_sepay.enabled", req.enabled().toString());
        if (req.bankName() != null) updateKey("payment_sepay.bank_name", req.bankName());
        if (req.bankBin() != null) updateKey("payment_sepay.bank_bin", req.bankBin());
        if (req.accountNumber() != null) updateKey("payment_sepay.account_number", req.accountNumber());
        if (req.accountHolder() != null) updateKey("payment_sepay.account_holder", req.accountHolder());
        if (req.timeoutHours() != null) updateKey("payment_sepay.timeout_hours", req.timeoutHours().toString());
        settingsResolver.evict();
        return getSettings(request);
    }

    private void updateKey(String key, String value) {
        Instant now = Instant.now();
        settingsRepo.findBySettingKey(key).ifPresentOrElse(
                s -> { s.setSettingValue(value); s.setUpdatedAt(now); settingsRepo.save(s); },
                () -> { /* key missing — seeded by migration */ }
        );
    }
}
