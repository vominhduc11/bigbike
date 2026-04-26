package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEmailVerificationTokenEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerEmailVerificationTokenJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;

/**
 * Issues and redeems email verification tokens. The raw token is only ever
 * transmitted inside the verification link that is emailed to the customer.
 * The database stores only the SHA-256 hash (see the token_hash column).
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final int TOKEN_BYTES = 32;
    private static final long TOKEN_TTL_HOURS = 24;

    private final CustomerEmailVerificationTokenJpaRepository tokenRepo;
    private final CustomerJpaRepository customerRepo;
    private final EmailDispatchService emailDispatch;
    private final String verifyBaseUrl;

    public EmailVerificationService(
            CustomerEmailVerificationTokenJpaRepository tokenRepo,
            CustomerJpaRepository customerRepo,
            EmailDispatchService emailDispatch,
            @Value("${bigbike.mail.verify-base-url:https://bigbike.vn/xac-nhan-email}") String verifyBaseUrl) {
        this.tokenRepo = tokenRepo;
        this.customerRepo = customerRepo;
        this.emailDispatch = emailDispatch;
        this.verifyBaseUrl = verifyBaseUrl;
    }

    /**
     * Issue a fresh verification token for the customer and email the link.
     * Any unexpired previous tokens are left in place (single-use on verify).
     * Mail delivery failure is logged but does NOT fail registration — the
     * customer can request another send later.
     */
    @Transactional
    public void issueAndSend(CustomerEntity customer) {
        if (customer.getEmail() == null || customer.getEmail().isBlank()) {
            return;
        }
        String rawToken = generateRawToken();
        CustomerEmailVerificationTokenEntity entity = new CustomerEmailVerificationTokenEntity();
        entity.setCustomerId(customer.getId());
        entity.setTokenHash(sha256Hex(rawToken));
        entity.setExpiresAt(Instant.now().plus(TOKEN_TTL_HOURS, ChronoUnit.HOURS));
        entity.setCreatedAt(Instant.now());
        tokenRepo.save(entity);

        if (!emailDispatch.isEnabled()) {
            log.info("Mail not configured — verification email skipped for customer {}", customer.getId());
            return;
        }

        String verifyUrl = verifyBaseUrl + "?token=" + rawToken;

        Context ctx = new Context();
        ctx.setVariable("displayName", safeDisplayName(customer));
        ctx.setVariable("verifyUrl", verifyUrl);

        emailDispatch.send(
                customer.getEmail(),
                "Xác nhận địa chỉ email của bạn — BigBike",
                "email-verification",
                ctx);
    }

    /**
     * Validate a raw token, mark the customer's email as verified, and
     * consume the token. Raises a ValidationException for expired / unknown
     * / already-used tokens so the caller can return a 400 with a clear code.
     */
    @Transactional
    public UUID verify(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ValidationException.fromField("token", "REQUIRED", "Verification token is required.");
        }
        CustomerEmailVerificationTokenEntity token = tokenRepo.findByTokenHash(sha256Hex(rawToken))
                .orElseThrow(() -> ValidationException.fromField("token", "INVALID", "Invalid verification token."));

        Instant now = Instant.now();
        if (token.getUsedAt() != null) {
            throw ValidationException.fromField("token", "ALREADY_USED", "Token has already been used.");
        }
        if (token.getExpiresAt().isBefore(now)) {
            throw ValidationException.fromField("token", "EXPIRED", "Token has expired.");
        }

        CustomerEntity customer = customerRepo.findById(token.getCustomerId())
                .orElseThrow(() -> new NotFoundException("Customer not found."));
        customer.setEmailVerifiedAt(now);
        customer.setUpdatedAt(now);
        customerRepo.save(customer);

        token.setUsedAt(now);
        tokenRepo.save(token);
        return customer.getId();
    }

    private static String safeDisplayName(CustomerEntity customer) {
        if (customer.getDisplayName() != null && !customer.getDisplayName().isBlank()) {
            return customer.getDisplayName();
        }
        if (customer.getEmail() != null && !customer.getEmail().isBlank()) {
            return customer.getEmail();
        }
        return "bạn";
    }

    private static String generateRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable on this JVM.", e);
        }
    }
}
