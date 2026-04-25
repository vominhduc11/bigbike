package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.api.auth.dto.AdminUserSummary;
import com.bigbike.bigbike_backend.api.auth.dto.TokenResponse;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.config.JwtProperties;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRefreshTokenEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRefreshTokenJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuthService {

    private static final Map<String, List<String>> ROLE_PERMISSION_MAP = Map.of(
            "SUPER_ADMIN", List.of("*"),
            "ADMIN", List.of(
                    "products.read", "products.update",
                    "catalog.read", "catalog.update",
                    "content.read", "content.update",
                    "orders.read", "orders.update",
                    "customers.read", "customers.update",
                    "media.read", "media.update",
                    "coupons.read", "coupons.update",
                    "redirects.read", "redirects.update",
                    "menus.read", "menus.update",
                    "sliders.read", "sliders.write",
                    "shipping.read", "shipping.write",
                    "reviews.read", "reviews.write",
                    "admin-users.read", "admin-users.write",
                    "settings.read", "settings.update"),
            "SHOP_MANAGER", List.of("products.read", "catalog.read", "content.read",
                    "orders.read", "customers.read", "coupons.read"),
            "EDITOR", List.of("content.read", "content.update", "media.read"),
            "VIEWER", List.of("products.read", "catalog.read", "content.read")
    );

    private final AdminUserJpaRepository adminUserRepo;
    private final AdminRefreshTokenJpaRepository refreshTokenRepo;
    private final PasswordService passwordService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;

    public AdminAuthService(
            AdminUserJpaRepository adminUserRepo,
            AdminRefreshTokenJpaRepository refreshTokenRepo,
            PasswordService passwordService,
            JwtService jwtService,
            JwtProperties jwtProperties
    ) {
        this.adminUserRepo = adminUserRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.passwordService = passwordService;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
    }

    @Transactional
    public TokenResponse login(String email, String rawPassword, HttpServletRequest request) {
        AdminUserEntity user = adminUserRepo.findByEmail(email).orElse(null);

        if (user == null) {
            // Dummy verify to prevent timing-based user enumeration
            passwordService.dummyVerify(rawPassword);
            throw new UnauthorizedException("Invalid email or password.");
        }
        if (!passwordService.verify(rawPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password.");
        }
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new UnauthorizedException("Account is not active.");
        }

        user.setLastLoginAt(Instant.now());
        adminUserRepo.save(user);

        String accessToken = jwtService.generateAccessToken(user.getId().toString(), user.getEmail(), user.getRole());
        String rawRefreshToken = saveNewRefreshToken(user.getId(), request);

        return buildTokenResponse(accessToken, rawRefreshToken, user);
    }

    @Transactional
    public TokenResponse refresh(String rawRefreshToken, HttpServletRequest request) {
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

        String accessToken = jwtService.generateAccessToken(user.getId().toString(), user.getEmail(), user.getRole());
        String newRawRefreshToken = saveNewRefreshToken(user.getId(), request);

        return buildTokenResponse(accessToken, newRawRefreshToken, user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        String tokenHash = jwtService.hashToken(rawRefreshToken);
        refreshTokenRepo.findByTokenHash(tokenHash).ifPresent(token -> {
            token.setRevokedAt(Instant.now());
            refreshTokenRepo.save(token);
        });
    }

    public AdminUserProfile getProfile(UUID userId) {
        AdminUserEntity user = adminUserRepo.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("User not found."));
        return toProfile(user);
    }

    /** Static helper used by other services that need to map a role to its default permissions. */
    public static List<String> permissionsForRole(String role) {
        return ROLE_PERMISSION_MAP.getOrDefault(
                role == null ? "" : role.toUpperCase(Locale.ROOT), List.of());
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
            entity.setCreatedByIp(request.getRemoteAddr());
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
