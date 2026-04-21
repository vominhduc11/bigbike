package com.bigbike.bigbike_backend.api.auth;

import com.bigbike.bigbike_backend.api.auth.dto.LoginRequest;
import com.bigbike.bigbike_backend.api.auth.dto.LogoutRequest;
import com.bigbike.bigbike_backend.api.auth.dto.RefreshRequest;
import com.bigbike.bigbike_backend.api.auth.dto.TokenResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.service.auth.AdminAuthService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AdminAuthService adminAuthService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AuthController(
            AdminAuthService adminAuthService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminAuthService = adminAuthService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @PostMapping("/login")
    public ApiDataResponse<TokenResponse> login(
            @Valid @RequestBody LoginRequest payload,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(
                adminAuthService.login(payload.getEmail(), payload.getPassword(), request),
                request
        );
    }

    @PostMapping("/refresh")
    public ApiDataResponse<TokenResponse> refresh(
            @Valid @RequestBody RefreshRequest payload,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(
                adminAuthService.refresh(payload.getRefreshToken(), request),
                request
        );
    }

    @PostMapping("/logout")
    public ApiDataResponse<Void> logout(
            @RequestBody(required = false) LogoutRequest payload,
            HttpServletRequest request
    ) {
        String rawToken = payload != null ? payload.getRefreshToken() : null;
        adminAuthService.logout(rawToken);
        return apiResponseFactory.data(null, request);
    }

    @GetMapping("/me")
    public ApiDataResponse<AdminUserProfile> me(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            // Real JWT auth path — load fresh user data from DB
            return apiResponseFactory.data(
                    adminAuthService.getProfile(UUID.fromString(principal.id())),
                    request
            );
        }
        // Dev/test fallback — only works in dev/mock profiles (DevAdminAuthService guards this)
        return apiResponseFactory.data(devAdminAuthService.currentAdminUser(request), request);
    }
}
