package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.config.JwtProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class ChatAttributionTokenService {

    public static final int WINDOW_HOURS = 168;
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String VERSION = "v1";

    private final byte[] secret;

    public ChatAttributionTokenService(JwtProperties jwtProperties) {
        this.secret = jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8);
    }

    public IssuedToken issue(
            UUID interactionId,
            UUID conversationId,
            String productSlug,
            UUID customerId,
            Instant issuedAt
    ) {
        Instant safeIssuedAt = issuedAt == null ? Instant.now() : issuedAt;
        String customer = customerId == null ? "guest" : customerId.toString();
        String payload = String.join("|",
                VERSION,
                interactionId.toString(),
                conversationId.toString(),
                encode(productSlug),
                customer,
                Long.toString(safeIssuedAt.getEpochSecond()));
        String token = encode(payload) + "." + encode(sign(payload));
        return new IssuedToken(token, safeIssuedAt.plus(WINDOW_HOURS, ChronoUnit.HOURS));
    }

    public Payload verify(String token, String expectedProductSlug, UUID customerId) {
        try {
            String[] parts = token == null ? new String[0] : token.split("\\.", -1);
            if (parts.length != 2) throw invalid();
            String payload = decode(parts[0]);
            byte[] supplied = decodeBytes(parts[1]);
            if (!MessageDigest.isEqual(sign(payload), supplied)) throw invalid();
            String[] values = payload.split("\\|", -1);
            if (values.length != 6 || !VERSION.equals(values[0])) throw invalid();
            UUID interactionId = UUID.fromString(values[1]);
            UUID conversationId = UUID.fromString(values[2]);
            String productSlug = decode(values[3]);
            String customer = values[4];
            Instant issuedAt = Instant.ofEpochSecond(Long.parseLong(values[5]));
            Instant expiresAt = issuedAt.plus(WINDOW_HOURS, ChronoUnit.HOURS);
            if (Instant.now().isAfter(expiresAt)) throw new ConflictException(
                    "Liên kết từ trợ lý đã quá thời hạn ghi nhận 7 ngày.");
            if (expectedProductSlug == null || !expectedProductSlug.equals(productSlug)) throw invalid();
            if (!"guest".equals(customer)
                    && (customerId == null || !customer.equals(customerId.toString()))) throw invalid();
            // A signed guest proof may follow the same browser into the signed-in cart. It does
            // not expose the conversation or customer data; it only proves the product view.
            // A proof issued to an identified customer remains bound to that exact customer.
            return new Payload(interactionId, conversationId, productSlug, issuedAt, expiresAt);
        } catch (ConflictException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw invalid();
        }
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể ký dữ liệu ghi nhận trợ lý.", exception);
        }
    }

    private static String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private static String decode(String value) {
        return new String(decodeBytes(value), StandardCharsets.UTF_8);
    }

    private static byte[] decodeBytes(String value) {
        return Base64.getUrlDecoder().decode(value);
    }

    private static ConflictException invalid() {
        return new ConflictException("Liên kết ghi nhận từ trợ lý không hợp lệ.");
    }

    public record IssuedToken(String token, Instant expiresAt) {}
    public record Payload(
            UUID interactionId,
            UUID conversationId,
            String productSlug,
            Instant issuedAt,
            Instant expiresAt
    ) {}
}
