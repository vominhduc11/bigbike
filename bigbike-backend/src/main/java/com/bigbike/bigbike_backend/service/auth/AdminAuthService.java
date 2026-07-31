package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.api.auth.dto.AdminUserSummary;
import com.bigbike.bigbike_backend.api.auth.dto.TokenResponse;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.config.JwtProperties;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRefreshTokenEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRefreshTokenJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminAuthService {


    private final AdminUserJpaRepository adminUserRepo;
    private final AdminRefreshTokenJpaRepository refreshTokenRepo;
    private final PasswordService passwordService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final AdminPermissionService adminPermissionService;
    private final AdminLoginAttemptService loginAttemptService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final ClientIpResolver clientIpResolver;

    @Transactional
    public TokenResponse login(String email, String rawPassword, HttpServletRequest request) {
        String clientIp = request != null ? clientIpResolver.resolve(request) : null;
        String userAgent = request != null ? request.getHeader("User-Agent") : null;

        AdminUserEntity user = adminUserRepo.findByEmail(email).orElse(null);

        // Unknown account, or an INVITED account with no password yet: keep timing flat
        // (constant-time dummy verify) and return the same generic error to avoid enumeration.
        if (user == null || user.getPasswordHash() == null) {
            passwordService.dummyVerify(rawPassword);
            auditLogin(null, "ADMIN_LOGIN_FAILED", email, user == null ? "USER_NOT_FOUND" : "NO_PASSWORD",
                    clientIp, userAgent);
            throw new UnauthorizedException("Invalid email or password.");
        }

        // Account lockout: refuse while the cool-down window is active, without touching the password.
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            auditLogin(user.getId(), "ADMIN_LOGIN_FAILED", email, "ACCOUNT_LOCKED", clientIp, userAgent);
            throw new UnauthorizedException("ACCOUNT_LOCKED",
                    "Account is temporarily locked due to too many failed login attempts. Please try again later.");
        }

        if (!passwordService.verify(rawPassword, user.getPasswordHash())) {
            // Counter write runs in its own transaction so it survives this method throwing.
            boolean lockedNow = loginAttemptService.recordFailure(user.getId());
            auditLogin(user.getId(), "ADMIN_LOGIN_FAILED", email, "BAD_PASSWORD", clientIp, userAgent);
            if (lockedNow) {
                auditLogin(user.getId(), "ADMIN_ACCOUNT_LOCKED", email, "TOO_MANY_FAILED_ATTEMPTS",
                        clientIp, userAgent);
            }
            throw new UnauthorizedException("Invalid email or password.");
        }

        // Password correct but account not usable — same generic error, do not count as a brute-force miss.
        if (!"ACTIVE".equals(user.getStatus())) {
            auditLogin(user.getId(), "ADMIN_LOGIN_FAILED", email, "INACTIVE", clientIp, userAgent);
            throw new UnauthorizedException("Invalid email or password.");
        }

        // Success: clear any lockout state.
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        adminUserRepo.save(user);

        auditLogin(user.getId(), "ADMIN_LOGIN_SUCCESS", user.getEmail(), null, clientIp, userAgent);

        String accessToken = jwtService.generateAccessToken(
                user.getId().toString(), user.getEmail(), user.getRole(), user.getAccessVersion());
        String rawRefreshToken = saveNewRefreshToken(user.getId(), request);

        return buildTokenResponse(accessToken, rawRefreshToken, user);
    }

    @Transactional
    public TokenResponse refresh(String rawRefreshToken, HttpServletRequest request) {
        // No cookie and no body token → caller is unauthenticated, not a server fault.
        // Guard before hashing (hashToken(null) would NPE → 500); mirror logout()'s guard.
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException("Missing refresh token.");
        }
        String tokenHash = jwtService.hashToken(rawRefreshToken);
        AdminRefreshTokenEntity stored = refreshTokenRepo.findByTokenHash(tokenHash)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token."));

        if (stored.getRevokedAt() != null) {
            throw new UnauthorizedException("Refresh token has been revoked.");
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Refresh token has expired.");
        }

        AdminUserEntity user = adminUserRepo.findById(stored.getAdminUserId())
                .orElseThrow(() -> new UnauthorizedException("User not found."));
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new UnauthorizedException("Account is not active.");
        }

        // Rotate: revoke old token, issue new pair
        stored.setRevokedAt(Instant.now());
        refreshTokenRepo.save(stored);

        String accessToken = jwtService.generateAccessToken(
                user.getId().toString(), user.getEmail(), user.getRole(), user.getAccessVersion());
        String newRawRefreshToken = saveNewRefreshToken(user.getId(), request);

        return buildTokenResponse(accessToken, newRawRefreshToken, user);
    }

    @Transactional
    public void logout(String rawRefreshToken, HttpServletRequest request) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        String clientIp = request != null ? clientIpResolver.resolve(request) : null;
        String userAgent = request != null ? request.getHeader("User-Agent") : null;
        String tokenHash = jwtService.hashToken(rawRefreshToken);
        refreshTokenRepo.findByTokenHash(tokenHash).ifPresent(token -> {
            token.setRevokedAt(Instant.now());
            refreshTokenRepo.save(token);
            auditLogin(token.getAdminUserId(), "ADMIN_LOGOUT", null, null, clientIp, userAgent);
        });
    }

    private void auditLogin(UUID actorId, String action, String email, String reason,
            String clientIp, String userAgent) {
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN",
                actorId,
                action,
                "ADMIN_AUTH",
                null,
                null,
                authDetailJson(email, reason),
                clientIp,
                userAgent
        ));
    }

    private static String authDetailJson(String email, String reason) {
        StringBuilder sb = new StringBuilder("{");
        boolean hasEmail = email != null && !email.isBlank();
        if (hasEmail) {
            sb.append("\"email\":\"").append(jsonEscape(email)).append("\"");
        }
        if (reason != null) {
            if (hasEmail) {
                sb.append(",");
            }
            sb.append("\"reason\":\"").append(reason).append("\"");
        }
        return sb.append("}").toString();
    }

    private static String jsonEscape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public AdminUserProfile getProfile(UUID userId) {
        AdminUserEntity user = adminUserRepo.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("User not found."));
        return toProfile(user);
    }

    private List<String> permissionsForRole(String role) {
        return adminPermissionService.getPermissionsForRole(role);
    }

    private String saveNewRefreshToken(UUID adminUserId, HttpServletRequest request) {
        String rawToken = jwtService.generateRawRefreshToken();
        String tokenHash = jwtService.hashToken(rawToken);

        AdminRefreshTokenEntity entity = new AdminRefreshTokenEntity();
        entity.setAdminUserId(adminUserId);
        entity.setTokenHash(tokenHash);
        entity.setCreatedAt(Instant.now());
        entity.setExpiresAt(Instant.now().plusSeconds(jwtProperties.getRefreshTokenTtlSeconds()));
        if (request != null) {
            entity.setCreatedByIp(clientIpResolver.resolve(request));
            entity.setUserAgent(request.getHeader("User-Agent"));
        }
        refreshTokenRepo.save(entity);
        return rawToken;
    }

    private TokenResponse buildTokenResponse(String accessToken, String rawRefreshToken, AdminUserEntity user) {
        List<String> permissions = permissionsForRole(user.getRole());
        AdminUserSummary summary = new AdminUserSummary(
                user.getId().toString(), user.getEmail(), user.getDisplayName(), user.getRole(), permissions);
        return new TokenResponse(
                accessToken, rawRefreshToken, jwtProperties.getAccessTokenTtlSeconds(), "Bearer", summary);
    }

    private AdminUserProfile toProfile(AdminUserEntity user) {
        return new AdminUserProfile(
                user.getId().toString(),
                user.getDisplayName(),
                user.getEmail(),
                List.of(user.getRole()),
                permissionsForRole(user.getRole()),
                user.getStatus(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
