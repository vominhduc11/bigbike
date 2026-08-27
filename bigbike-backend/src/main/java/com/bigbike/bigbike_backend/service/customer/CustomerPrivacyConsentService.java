package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerPrivacyConsentEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerPrivacyConsentJpaRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Records the server-owned evidence required by CUSTOMER_RULE_011. */
@Service
@RequiredArgsConstructor
public class CustomerPrivacyConsentService {

    public static final String POLICY_VERSION = "2026-08-27";

    private final CustomerPrivacyConsentJpaRepository consentRepo;

    public static boolean isSupportedLocale(String locale) {
        return "vi".equals(locale) || "en".equals(locale);
    }

    public void record(UUID customerId, String locale) {
        if (!isSupportedLocale(locale)) {
            throw ValidationException.fromField(
                    "privacyPolicyLocale", "INVALID", "Ngôn ngữ Chính sách bảo mật không hợp lệ.");
        }
        CustomerPrivacyConsentEntity consent = new CustomerPrivacyConsentEntity();
        consent.setCustomerId(customerId);
        consent.setPolicyVersion(POLICY_VERSION);
        consent.setLocale(locale);
        consent.setAcceptedAt(Instant.now());
        consentRepo.save(consent);
    }
}
