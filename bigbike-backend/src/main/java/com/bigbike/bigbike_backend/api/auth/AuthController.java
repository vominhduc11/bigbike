package com.bigbike.bigbike_backend.api.auth;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AuthController(DevAdminAuthService devAdminAuthService, ApiResponseFactory apiResponseFactory) {
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping("/me")
    public ApiDataResponse<AdminUserProfile> getCurrentAdminUser(HttpServletRequest request) {
        return apiResponseFactory.data(devAdminAuthService.currentAdminUser(request), request);
    }
}
