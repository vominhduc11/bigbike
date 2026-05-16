package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerPasswordResetTokenEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerPasswordResetTokenJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;

@Service
@Slf4j
public class CustomerPasswordResetService {

    private static final int TOKEN_BYTES = 32;
    private static final long TOKEN_TTL_MINUTES = 60;

    private final CustomerJpaRepository customerRepo;
    private final CustomerPasswordResetTokenJpaRepository tokenRepo;
    private final PasswordService passwordService;
    private final CustomerSessionService sessionService;
    private final EmailDispatchService emailDispatch;
    private final String resetBaseUrl;

    public CustomerPasswordResetService(
            CustomerJpaRepository customerRepo,
            CustomerPasswordResetTokenJpaRepository tokenRepo,
            PasswordService passwordService,
            CustomerSessionService sessionService,
            EmailDispatchService emailDispatch,
            @Value("${bigbike.mail.reset-base-url:https://bigbike.vn/quen-mat-khau}") String resetBaseUrl) {
        this.customerRepo = customerRepo;
        this.tokenRepo = tokenRepo;
        this.passwordService = passwordService;
        this.sessionService = sessionService;
        this.emailDispatch = emailDispatch;
        this.resetBaseUrl = resetBaseUrl;
    }

    @Transactional
    public void requestPasswordReset(String login, String ipAddress, String userAgent) {
        if (login == null || login.isBlank()) {
            throw ValidationException.fromField("login", "REQUIRED", "Login is required.");
        }

        // Keep the request timing flatter even when the account does not exist.
        passwordService.dummyVerify(login);

        CustomerEntity customer = findByLogin(login.trim());
        if (customer == null || customer.getEmail() == null || customer.getEmail().isBlank()) {
            log.info("Password reset requested for login '{}' from {}. No mail was sent.", login, ipAddress);
            return;
        }

        tokenRepo.deleteByCustomerId(customer.getId());

        String rawToken = generateRawToken();
        Instant now = Instant.now();

        CustomerPasswordResetTokenEntity token = new CustomerPasswordResetTokenEntity();
        token.setCustomerId(customer.getId());
        token.setTokenHash(sha256Hex(rawToken));
        token.setExpiresAt(now.plus(TOKEN_TTL_MINUTES, ChronoUnit.MINUTES));
        token.setCreatedAt(now);
        tokenRepo.save(token);

        if (!emailDispatch.isEnabled()) {
            log.info("Mail not configured — password reset email skipped for customer {}", customer.getId());
            return;
        }

        Context ctx = new Context();
        ctx.setVariable("displayName", safeDisplayName(customer));
        ctx.setVariable("resetUrl", resetBaseUrl + "?token=" + rawToken);

        emailDispatch.send(
                customer.getEmail(),
                "Đặt lại mật khẩu BigBike",
                "password-reset",
                ctx);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword, String ipAddress, String userAgent) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ValidationException.fromField("token", "REQUIRED", "Reset token is required.");
        }
        if (newPassword == null || newPassword.length() < 8) {
            throw ValidationException.fromField("password", "TOO_SHORT", "Mật khẩu phải có ít nhất 8 ký tự.");
        }

        CustomerPasswordResetTokenEntity token = tokenRepo.findByTokenHash(sha256Hex(rawToken))
                .orElseThrow(() -> ValidationException.fromField("token", "INVALID", "Invalid reset token."));

        Instant now = Instant.now();
        if (token.getUsedAt() != null) {
            throw ValidationException.fromField("token", "ALREADY_USED", "Reset token has already been used.");
        }
        if (token.getExpiresAt().isBefore(now)) {
            throw ValidationException.fromField("token", "EXPIRED", "Reset token has expired.");
        }

        CustomerEntity customer = customerRepo.findById(token.getCustomerId())
                .orElseThrow(() -> new NotFoundException("Customer not found."));

        customer.setPasswordHash(passwordService.hash(newPassword));
        customer.setUpdatedAt(now);
        customerRepo.save(customer);

        token.setUsedAt(now);
        tokenRepo.save(token);
        sessionService.revokeAllSessions(customer.getId());

        log.info("Password reset completed for customer {} from {}", customer.getId(), ipAddress);

        sendPasswordChangeAlert(customer);
    }

    // ── Security alert ────────────────────────────────────────────────────────

    private void sendPasswordChangeAlert(CustomerEntity customer) {
        if (customer.getEmail() == null || customer.getEmail().isBlank()) return;
        if (!emailDispatch.isEnabled()) return;

        String accountLogin = customer.getEmail() != null ? customer.getEmail()
                : (customer.getPhone() != null ? customer.getPhone() : "—");

        Context ctx = new Context();
        ctx.setVariable("displayName", safeDisplayName(customer));
        ctx.setVariable("accountLogin", accountLogin);

        emailDispatch.send(
                customer.getEmail(),
                "[BigBike] Mật khẩu của bạn vừa được thay đổi",
                "password-change-alert",
                ctx);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CustomerEntity findByLogin(String login) {
        if (login == null || login.isBlank()) {
            return null;
        }
        if (login.contains("@")) {
            return customerRepo.findByEmail(login).orElse(null);
        }
        return customerRepo.findByPhone(login).orElse(null);
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
