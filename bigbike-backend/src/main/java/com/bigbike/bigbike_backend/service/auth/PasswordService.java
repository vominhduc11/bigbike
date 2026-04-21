package com.bigbike.bigbike_backend.service.auth;

import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class PasswordService {

    // Argon2id with OWASP-recommended parameters (memory=65536KB, iterations=3, parallelism=4)
    private static final Argon2PasswordEncoder ENCODER =
            Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();

    // Dummy hash for timing-safe "user not found" checks — prevents user enumeration.
    private static final String TIMING_DUMMY_HASH =
            "$argon2id$v=19$m=65536,t=3,p=4$dummysaltdummysalt$dummyhashvaluedummyhashvaluedummy";

    public String hash(String rawPassword) {
        return ENCODER.encode(rawPassword);
    }

    public boolean verify(String rawPassword, String encodedPassword) {
        return ENCODER.matches(rawPassword, encodedPassword);
    }

    /**
     * Performs a dummy verification to keep timing consistent when a user is not found,
     * preventing user enumeration attacks.
     */
    public void dummyVerify(String rawPassword) {
        try {
            ENCODER.matches(rawPassword, TIMING_DUMMY_HASH);
        } catch (Exception ignored) {
            // dummy hash is intentionally invalid — we only care about timing
        }
    }
}
