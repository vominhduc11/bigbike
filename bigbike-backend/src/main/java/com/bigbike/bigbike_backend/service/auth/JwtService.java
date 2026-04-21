package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.Set;
import javax.crypto.SecretKey;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private static final int MIN_PROD_SECRET_LENGTH = 32;
    private static final Set<String> PROD_PROFILES = Set.of("prod", "production");
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JwtProperties jwtProperties;
    private final Environment environment;
    private SecretKey signingKey;

    public JwtService(JwtProperties jwtProperties, Environment environment) {
        this.jwtProperties = jwtProperties;
        this.environment = environment;
    }

    @PostConstruct
    void init() {
        String secret = jwtProperties.getSecret();
        // Fail fast in production if the secret is weak or still the default dev value.
        for (String profile : environment.getActiveProfiles()) {
            if (PROD_PROFILES.contains(profile.toLowerCase())) {
                if (secret.startsWith("dev-") || secret.length() < MIN_PROD_SECRET_LENGTH) {
                    throw new IllegalStateException(
                            "BIGBIKE_JWT_SECRET is too weak or is the default dev value. "
                            + "Set a strong secret (≥32 chars) for production.");
                }
                break;
            }
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(String userId, String email, String role) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(jwtProperties.getAccessTokenTtlSeconds());
        return Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Parses and validates an access token. Throws {@link JwtException} for
     * invalid, expired, or malformed tokens.
     */
    public Claims parseAccessToken(String token) throws JwtException {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** Generates a cryptographically random opaque refresh token (URL-safe Base64, 32 bytes). */
    public String generateRawRefreshToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Returns the SHA-256 hex digest of a raw token for storage. */
    public String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
