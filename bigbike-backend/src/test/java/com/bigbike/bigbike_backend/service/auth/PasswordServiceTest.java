package com.bigbike.bigbike_backend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class PasswordServiceTest {

    @Autowired
    private PasswordService passwordService;

    @Test
    void hashShouldNotEqualPlainText() {
        String raw = "MySecurePass@123";
        String hash = passwordService.hash(raw);
        assertThat(hash).isNotEqualTo(raw);
        assertThat(hash).startsWith("$argon2id");
    }

    @Test
    void verifyCorrectPasswordReturnsTrue() {
        String raw = "MySecurePass@123";
        String hash = passwordService.hash(raw);
        assertThat(passwordService.verify(raw, hash)).isTrue();
    }

    @Test
    void verifyWrongPasswordReturnsFalse() {
        String hash = passwordService.hash("MySecurePass@123");
        assertThat(passwordService.verify("WrongPassword!", hash)).isFalse();
    }

    @Test
    void twoHashesOfSamePasswordAreDifferent() {
        String raw = "MySecurePass@123";
        String hash1 = passwordService.hash(raw);
        String hash2 = passwordService.hash(raw);
        // Argon2id uses a random salt — same input yields different stored hashes
        assertThat(hash1).isNotEqualTo(hash2);
        assertThat(passwordService.verify(raw, hash1)).isTrue();
        assertThat(passwordService.verify(raw, hash2)).isTrue();
    }
}
