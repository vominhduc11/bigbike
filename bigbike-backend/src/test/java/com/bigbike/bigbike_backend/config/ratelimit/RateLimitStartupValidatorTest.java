package com.bigbike.bigbike_backend.config.ratelimit;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class RateLimitStartupValidatorTest {

    @Test
    void productionRejectsMissingHmacSecret() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setStore(RateLimitProperties.Store.REDIS);
        properties.setRedisUrl("redis://redis:6379/0");
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        assertThatIllegalStateException()
                .isThrownBy(() -> new RateLimitStartupValidator(properties, environment).validate())
                .withMessageContaining("BIGBIKE_RATE_LIMIT_HMAC_SECRET");
    }

    @Test
    void productionAcceptsPlaintextRedisOnlyWhenTheHostStaysInsideTheNetwork() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        for (String inNetworkUrl : new String[] {
                "redis://redis:6379/0", "redis://127.0.0.1:6379/0", "redis://172.20.0.4:6379/0"}) {
            RateLimitProperties properties = new RateLimitProperties();
            properties.setStore(RateLimitProperties.Store.REDIS);
            properties.setRedisUrl(inNetworkUrl);
            properties.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");

            assertThatCode(() -> new RateLimitStartupValidator(properties, environment).validate())
                    .doesNotThrowAnyException();
        }

        RateLimitProperties publicPlaintext = new RateLimitProperties();
        publicPlaintext.setStore(RateLimitProperties.Store.REDIS);
        publicPlaintext.setRedisUrl("redis://rate-limit.example.test:6379/0");
        publicPlaintext.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");

        assertThatIllegalStateException()
                .isThrownBy(() -> new RateLimitStartupValidator(publicPlaintext, environment).validate())
                .withMessageContaining("in-network host");
    }

    @Test
    void productionAcceptsManagedTlsRedisAndDedicatedHmacSecret() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setStore(RateLimitProperties.Store.REDIS);
        properties.setRedisUrl("rediss://rate-limit.example.test:6380/0");
        properties.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        assertThatCode(() -> new RateLimitStartupValidator(properties, environment).validate())
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsUnknownOrInvalidTierOverridesBeforeServingTraffic() {
        RateLimitProperties unknownTier = new RateLimitProperties();
        unknownTier.getTiers().put("typo", new RateLimitProperties.TierOverride());

        assertThatIllegalStateException()
                .isThrownBy(() -> new RateLimitStartupValidator(unknownTier, new MockEnvironment()).validate())
                .withMessageContaining("Unknown rate-limit tier override");

        RateLimitProperties invalidLimit = new RateLimitProperties();
        RateLimitProperties.TierOverride override = new RateLimitProperties.TierOverride();
        override.setLimit(0L);
        invalidLimit.getTiers().put(RateLimitTier.LOGIN.key(), override);

        assertThatIllegalStateException()
                .isThrownBy(() -> new RateLimitStartupValidator(invalidLimit, new MockEnvironment()).validate())
                .withMessageContaining("Invalid rate-limit policy");
    }

    @Test
    void rejectsMalformedEnvironmentTierOverrideBeforeServingTraffic() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setEnvironment(new MockEnvironment()
                .withProperty("BIGBIKE_RATE_LIMIT_TIERS_LOGIN_WINDOW", "not-a-duration"));

        assertThatIllegalStateException()
                .isThrownBy(() -> new RateLimitStartupValidator(properties, new MockEnvironment()).validate())
                .withMessageContaining("Invalid rate-limit window override");
    }
}
