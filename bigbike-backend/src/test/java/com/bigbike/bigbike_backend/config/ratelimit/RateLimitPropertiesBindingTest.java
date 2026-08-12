package com.bigbike.bigbike_backend.config.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class RateLimitPropertiesBindingTest {

    @Test
    void systemEnvironmentTierOverridesBindToCanonicalTierKeys() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("BIGBIKE_RATE_LIMIT_TIERS_LOGIN_LIMIT", "7")
                .withProperty("BIGBIKE_RATE_LIMIT_TIERS_LOGIN_WINDOW", "2m")
                .withProperty("BIGBIKE_RATE_LIMIT_TIERS_PASSWORD_RESET_LIMIT", "4")
                .withProperty("BIGBIKE_RATE_LIMIT_TIERS_PASSWORD_RESET_WINDOW", "30s");
        RateLimitProperties properties = new RateLimitProperties();
        properties.setEnvironment(environment);

        assertThat(properties.policyFor(RateLimitTier.LOGIN).limit()).isEqualTo(7);
        assertThat(properties.policyFor(RateLimitTier.LOGIN).window()).isEqualTo(Duration.ofMinutes(2));
        assertThat(properties.policyFor(RateLimitTier.PASSWORD_RESET).limit()).isEqualTo(4);
        assertThat(properties.policyFor(RateLimitTier.PASSWORD_RESET).window()).isEqualTo(Duration.ofSeconds(30));
    }
}
