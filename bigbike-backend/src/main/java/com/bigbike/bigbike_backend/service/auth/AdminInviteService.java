package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitScope;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitTier;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminInviteTokenEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminInviteTokenJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;

/**
 * Admin onboarding by email invite: a new admin is created without a password and
 * receives a tokenized set-password link. Mirrors {@code CustomerPasswordResetService}.
 */
@Service
@Slf4j
public class AdminInviteService {

    private static final int TOKEN_BYTES = 32;
    static final long TOKEN_TTL_HOURS = 48;

    private final AdminUserJpaRepository adminUserRepo;
    private final AdminInviteTokenJpaRepository tokenRepo;
    private final PasswordService passwordService;
    private final EmailDispatchService emailDispatch;
    private final RateLimitService rateLimitService;
    private final String inviteBaseUrl;

    public AdminInviteService(
            AdminUserJpaRepository adminUserRepo,
            AdminInviteTokenJpaRepository tokenRepo,
            PasswordService passwordService,
            EmailDispatchService emailDispatch,
            RateLimitService rateLimitService,
            @Value("${bigbike.mail.admin-invite-base-url:http://localhost:4000/accept-invite}") String inviteBaseUrl) {
        this.adminUserRepo = adminUserRepo;
        this.tokenRepo = tokenRepo;
        this.passwordService = passwordService;
        this.emailDispatch = emailDispatch;
        this.rateLimitService = rateLimitService;
        this.inviteBaseUrl = inviteBaseUrl;
    }

    /** Result of issuing an invite, returned so the caller can surface the link when mail is off. */
    public record InviteResult(String email, String inviteUrl, boolean emailSent, Instant expiresAt) {}

    /** Public info for the set-password page (no secrets). */
    public record InviteInfo(String email, Instant expiresAt) {}

    /**
     * Issues a fresh invite for the given user: replaces any prior token, persists a new one,
     * and sends the invite email (if SMTP is configured).
     */
    @Transactional
    public InviteResult issueInvite(AdminUserEntity user) {
        tokenRepo.deleteByAdminUserId(user.getId());

        String rawToken = generateRawToken();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(TOKEN_TTL_HOURS, ChronoUnit.HOURS);

        AdminInviteTokenEntity token = new AdminInviteTokenEntity();
        token.setAdminUserId(user.getId());
        token.setTokenHash(sha256Hex(rawToken));
        token.setExpiresAt(expiresAt);
        token.setCreatedAt(now);
        tokenRepo.save(token);

        String inviteUrl = inviteBaseUrl + "?token=" + rawToken;
        boolean emailSent = false;

        if (emailDispatch.isEnabled()) {
            Context ctx = new Context();
            ctx.setVariable("displayName", user.getDisplayName() != null ? user.getDisplayName() : user.getEmail());
            ctx.setVariable("inviteUrl", inviteUrl);
            ctx.setVariable("expiresHours", TOKEN_TTL_HOURS);
            emailDispatch.send(user.getEmail(), "Lời mời quản trị BigBike — đặt mật khẩu", "admin-invite", ctx);
            emailSent = true;
        } else {
            log.info("Mail not configured — admin invite email skipped; link must be delivered manually.");
        }

        return new InviteResult(user.getEmail(), inviteUrl, emailSent, expiresAt);
    }

    /** Resends an invite for an existing INVITED user. */
    @Transactional
    public InviteResult resendInvite(UUID adminUserId) {
        AdminUserEntity user = adminUserRepo.findById(adminUserId)
                .orElseThrow(() -> new NotFoundException("Admin user not found."));
        if (!"INVITED".equals(user.getStatus())) {
            throw new ConflictException("Only invited (pending) admin users can be re-invited.");
        }
        return issueInvite(user);
    }

    /** Validates a raw token and returns the invitee info for the set-password page. */
    @Transactional(readOnly = true)
    public InviteInfo validateToken(String rawToken) {
        rateLimitService.checkOrThrow(RateLimitTier.PASSWORD_RESET, RateLimitScope.IDENTITY, rawToken);
        AdminInviteTokenEntity token = requireValidToken(rawToken);
        AdminUserEntity user = adminUserRepo.findById(token.getAdminUserId())
                .orElseThrow(() -> new NotFoundException("Admin user not found."));
        return new InviteInfo(user.getEmail(), token.getExpiresAt());
    }

    /** Accepts an invite: sets the password and flips the account to ACTIVE, consuming the token. */
    @Transactional
    public void acceptInvite(String rawToken, String newPassword) {
        rateLimitService.checkOrThrow(RateLimitTier.PASSWORD_RESET, RateLimitScope.IDENTITY, rawToken);
        if (newPassword == null || newPassword.length() < 8) {
            throw ValidationException.fromField("password", "TOO_SHORT", "Mật khẩu phải có ít nhất 8 ký tự.");
        }
        AdminInviteTokenEntity token = requireValidToken(rawToken);

        AdminUserEntity user = adminUserRepo.findById(token.getAdminUserId())
                .orElseThrow(() -> new NotFoundException("Admin user not found."));

        Instant now = Instant.now();
        user.setPasswordHash(passwordService.hash(newPassword));
        user.setStatus("ACTIVE");
        user.setUpdatedAt(now);
        adminUserRepo.save(user);

        token.setUsedAt(now);
        tokenRepo.save(token);

        log.info("Admin invite accepted; account is now ACTIVE.");
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private AdminInviteTokenEntity requireValidToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ValidationException.fromField("token", "REQUIRED", "Invite token is required.");
        }
        AdminInviteTokenEntity token = tokenRepo.findByTokenHash(sha256Hex(rawToken))
                .orElseThrow(() -> ValidationException.fromField("token", "INVALID", "Lời mời không hợp lệ."));
        if (token.getUsedAt() != null) {
            throw ValidationException.fromField("token", "ALREADY_USED", "Lời mời đã được sử dụng.");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw ValidationException.fromField("token", "EXPIRED", "Lời mời đã hết hạn.");
        }
        return token;
    }

    private static String generateRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable on this JVM.", e);
        }
    }
}
