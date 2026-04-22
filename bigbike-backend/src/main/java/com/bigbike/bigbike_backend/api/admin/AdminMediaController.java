package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpdateMediaRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminMediaService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/media")
public class AdminMediaController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminMediaService adminMediaService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminMediaController(
            AdminMediaService adminMediaService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminMediaService = adminMediaService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<AdminMediaListItemResponse> listMedia(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String mimeType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String storageProvider,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.read");
        return apiResponseFactory.list(
                adminMediaService.listMedia(page, size, q, mimeType, status, storageProvider), request);
    }

    @GetMapping("/{mediaId}")
    public ApiDataResponse<AdminMediaDetailResponse> getMediaDetail(
            @PathVariable UUID mediaId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.read");
        return apiResponseFactory.data(adminMediaService.getMediaDetail(mediaId), request);
    }

    @PatchMapping("/{mediaId}")
    public ApiDataResponse<AdminMediaDetailResponse> updateMedia(
            @PathVariable UUID mediaId,
            @Valid @RequestBody UpdateMediaRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        return apiResponseFactory.data(
                adminMediaService.updateMedia(mediaId, resolveAdminId(), body), request);
    }

    @DeleteMapping("/{mediaId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMedia(
            @PathVariable UUID mediaId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        adminMediaService.deleteMedia(mediaId, resolveAdminId());
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
