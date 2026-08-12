package com.bigbike.bigbike_backend.config.ratelimit;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Converts sensitive limiter subjects into stable, non-reversible storage keys. */
@Component
@Slf4j
public class RateLimitKeyFactory {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final byte[] secret;

    public RateLimitKeyFactory(RateLimitProperties properties, Environment environment) {
        String configuredSecret = properties.getHmacSecret();
        if (configuredSecret == null || configuredSecret.isBlank()) {
            this.secret = ephemeralSecret();
            if (!isProduction(environment)) {
                log.warn("Rate-limit HMAC secret is unset; using an ephemeral local-development key.");
            }
        } else {
            this.secret = configuredSecret.getBytes(StandardCharsets.UTF_8);
        }
    }

    public RateLimitKey create(RateLimitTier tier, RateLimitScope scope, String subject) {
        String normalizedSubject = subject == null || subject.isBlank() ? "anonymous" : subject.trim();
        String material = tier.key() + '\n' + scope.key() + '\n' + normalizedSubject;
        return new RateLimitKey(
                tier,
                scope,
                "bb:rl:v1:" + tier.key() + ':' + scope.key() + ':' + digest(material));
    }

    private String digest(String material) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(material.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to create a rate-limit key digest.", ex);
        }
    }

    private static byte[] ephemeralSecret() {
        byte[] generated = new byte[32];
        new SecureRandom().nextBytes(generated);
        return generated;
    }

    private static boolean isProduction(Environment environment) {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equals(profile)) {
                return true;
            }
        }
        return false;
    }
}
