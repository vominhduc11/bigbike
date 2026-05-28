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

    @Transactional
    public TokenResponse login(String email, String rawPassword, HttpServletRequest request) {
        AdminUserEntity user = adminUserRepo.findByEmail(email).orElse(null);

        if (user == null) {
            // Constant-time dummy verify prevents timing-based user enumeration
            passwordService.dummyVerify(rawPassword);
            throw new UnauthorizedException("Invalid email or password.");
        }
        // Always verify password before checking status — avoids leaking account existence
        if (!passwordService.verify(rawPassword, user.getPasswordHash()) || !"ACTIVE".equals(user.getStatus())) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        user.setLastLoginAt(Instant.now());
        adminUserRepo.save(user);

        String accessToken = jwtService.generateAccessToken(user.getId().toString(), user.getEmail(), user.getRole());
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
