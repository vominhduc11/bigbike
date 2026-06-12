package com.bigbike.bigbike_backend.service.auth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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

    // WordPress 6.8+ user-password format (see docs/audits/wp-migration-audit.md §4.3).
    // Stored as "$wp" + bcrypt( base64( HMAC-SHA384(key="wp-sha384", trim(password)) ) ),
    // so a full hash looks like "$wp$2y$10$...". The SHA-384 pre-hash sidesteps bcrypt's
    // 72-byte limit (base64 of 48 bytes = 64 chars) and "wp-sha384" gives domain separation.
    private static final String WP_HASH_PREFIX = "$wp";
    private static final String WP_HMAC_ALGORITHM = "HmacSHA384";
    private static final String WP_HMAC_KEY = "wp-sha384";
    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder();

    public String hash(String rawPassword) {
        return ENCODER.encode(rawPassword);
    }

    public boolean verify(String rawPassword, String encodedPassword) {
        if (isPhpassHash(encodedPassword)) {
            return verifyPhpass(rawPassword, encodedPassword);
        }
        if (isWpBcryptHash(encodedPassword)) {
            return verifyWpBcrypt(rawPassword, encodedPassword);
        }
        return ENCODER.matches(rawPassword, encodedPassword);
    }

    /**
     * Returns true if the stored hash is a legacy WordPress hash (phpass or WP 6.8 bcrypt)
     * that should be rehashed to Argon2id on the next successful login.
     */
    public boolean isLegacyHash(String encodedPassword) {
        return isPhpassHash(encodedPassword) || isWpBcryptHash(encodedPassword);
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

    // ── WordPress 6.8 bcrypt support ────────────────────────────────────────────

    private static boolean isWpBcryptHash(String hash) {
        return hash != null && hash.startsWith(WP_HASH_PREFIX + "$");
    }

    /**
     * Verifies a password against a WordPress 6.8 "$wp$2y$…" hash by re-deriving the
     * SHA-384 pre-hash and bcrypt-matching it against the embedded bcrypt hash.
     */
    private static boolean verifyWpBcrypt(String password, String hash) {
        try {
            // Strip the "$wp" prefix → the plain bcrypt hash "$2y$…".
            String bcryptHash = hash.substring(WP_HASH_PREFIX.length());
            Mac mac = Mac.getInstance(WP_HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(WP_HMAC_KEY.getBytes(StandardCharsets.UTF_8), WP_HMAC_ALGORITHM));
            byte[] digest = mac.doFinal(phpTrim(password).getBytes(StandardCharsets.UTF_8));
            String preHash = Base64.getEncoder().encodeToString(digest);
            return BCRYPT.matches(preHash, bcryptHash);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return false;
        }
    }

    /** Mirrors PHP's default trim() (WordPress trims the password before hashing). */
    private static String phpTrim(String s) {
        int start = 0;
        int end = s.length();
        while (start < end && isPhpTrimChar(s.charAt(start))) start++;
        while (end > start && isPhpTrimChar(s.charAt(end - 1))) end--;
        return s.substring(start, end);
    }

    private static boolean isPhpTrimChar(char c) {
        return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\0' || c == 0x0B;
    }
}
