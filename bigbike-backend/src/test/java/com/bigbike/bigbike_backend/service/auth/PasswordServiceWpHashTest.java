package com.bigbike.bigbike_backend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Verifies WordPress 6.8 ("$wp$2y$…") password support. PasswordService has no injected
 * dependencies, so this is a plain unit test (no Spring context needed).
 *
 * <p>{@code WP_HASH} is a real hash produced by the actual WordPress algorithm
 * ({@code wp_hash_password}): {@code '$wp' + bcrypt(base64(HMAC-SHA384('wp-sha384', trim(pw))))},
 * generated and self-verified with PHP {@code password_hash}/{@code password_verify}.
 */
class PasswordServiceWpHashTest {

    private final PasswordService passwordService = new PasswordService();

    private static final String WP_PASSWORD = "BigBike@2026";
    private static final String WP_HASH =
            "$wp$2y$10$qeleDSuDaeZO5fBsEqFReeWdlqaDnBDBzB16hFgsFnhN9qFBIihvm";

    @Test
    void verifiesWordPress68UserPasswordHash() {
        assertThat(passwordService.verify(WP_PASSWORD, WP_HASH)).isTrue();
    }

    @Test
    void rejectsWrongPasswordForWpHash() {
        assertThat(passwordService.verify("wrong-password", WP_HASH)).isFalse();
    }

    @Test
    void treatsWpHashAsLegacySoItRehashesToArgon2OnLogin() {
        assertThat(passwordService.isLegacyHash(WP_HASH)).isTrue();
    }
}
