package com.bigbike.bigbike_backend.service.customer;

/** Consent carried through the short-lived OAuth callback state for a new account only. */
public record OAuthRegistrationConsent(boolean privacyConsent, String privacyPolicyLocale) {

    public static OAuthRegistrationConsent none() {
        return new OAuthRegistrationConsent(false, null);
    }

    public static OAuthRegistrationConsent of(boolean privacyConsent, String privacyPolicyLocale) {
        String locale = CustomerPrivacyConsentService.isSupportedLocale(privacyPolicyLocale)
                ? privacyPolicyLocale
                : null;
        return new OAuthRegistrationConsent(privacyConsent, locale);
    }

    public boolean permitsNewCustomer() {
        return privacyConsent && CustomerPrivacyConsentService.isSupportedLocale(privacyPolicyLocale);
    }
}
