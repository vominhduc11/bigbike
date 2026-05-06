package com.bigbike.bigbike_backend.service.auth;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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

    // PHPass base64 alphabet (different from standard base64)
    private static final String PHPASS_ITOA64 =
            "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    public String hash(String rawPassword) {
        return ENCODER.encode(rawPassword);
    }

    public boolean verify(String rawPassword, String encodedPassword) {
        if (isPhpassHash(encodedPassword)) {
            return verifyPhpass(rawPassword, encodedPassword);
        }
        return ENCODER.matches(rawPassword, encodedPassword);
    }

    /** Returns true if the stored hash is a legacy WordPress phpass hash that needs rehashing. */
    public boolean isLegacyHash(String encodedPassword) {
        return isPhpassHash(encodedPassword);
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

    // ── PHPass support ────────────────────────────────────────────────────────

    private static boolean isPhpassHash(String hash) {
        return hash != null && (hash.startsWith("$P$") || hash.startsWith("$H$"));
    }

    /**
     * Verifies a password against a WordPress phpass hash (portable hash format).
     * Format: $P$[count_char][8-char-salt][22-char-hash]
     */
    private static boolean verifyPhpass(String password, String hash) {
        try {
            if (hash.length() < 34) return false;

            int log2Count = PHPASS_ITOA64.indexOf(hash.charAt(3));
            if (log2Count < 0 || log2Count > 30) return false;
            int count = 1 << log2Count;

            String salt = hash.substring(4, 12);
            byte[] passwordBytes = password.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            byte[] saltBytes = salt.getBytes(java.nio.charset.StandardCharsets.UTF_8);

            MessageDigest md = MessageDigest.getInstance("MD5");

            // Initial digest: MD5(salt + password)
            md.update(saltBytes);
            byte[] digest = md.digest(passwordBytes);

            // Iterate: MD5(previous_digest + password), 'count' times
            for (int i = 0; i < count; i++) {
                md.reset();
                md.update(digest);
                digest = md.digest(passwordBytes);
            }

            String encoded = phpassBase64Encode(digest, digest.length);
            String expected = hash.substring(12);
            return MessageDigest.isEqual(encoded.getBytes(), expected.getBytes());
        } catch (NoSuchAlgorithmException e) {
            return false;
        }
    }

    private static String phpassBase64Encode(byte[] src, int count) {
        StringBuilder sb = new StringBuilder();
        int i = 0;
        do {
            int value = src[i++] & 0xff;
            sb.append(PHPASS_ITOA64.charAt(value & 0x3f));
            if (i < count) value |= (src[i] & 0xff) << 8;
            sb.append(PHPASS_ITOA64.charAt((value >> 6) & 0x3f));
            if (i++ >= count) break;
            if (i < count) value |= (src[i] & 0xff) << 16;
            sb.append(PHPASS_ITOA64.charAt((value >> 12) & 0x3f));
            if (i++ >= count) break;
            sb.append(PHPASS_ITOA64.charAt((value >> 18) & 0x3f));
        } while (i < count);
        return sb.toString();
    }
}
