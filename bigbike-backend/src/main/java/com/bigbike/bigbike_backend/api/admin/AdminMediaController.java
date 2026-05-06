package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpdateMediaRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
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
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
@RequestMapping("/api/v1/admin/media")
public class AdminMediaController {

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

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<AdminMediaDetailResponse> uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "altText", required = false, defaultValue = "") String altText,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        return apiResponseFactory.data(
                adminMediaService.uploadMedia(file, altText, resolveAdminId()), request);
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
            @RequestParam(defaultValue = "false") boolean permanent,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        if (permanent) {
            adminMediaService.hardDeleteMedia(mediaId, resolveAdminId());
        } else {
            adminMediaService.deleteMedia(mediaId, resolveAdminId());
        }
    }

    @PostMapping("/{mediaId}/restore")
    public ApiDataResponse<AdminMediaDetailResponse> restoreMedia(
            @PathVariable UUID mediaId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        return apiResponseFactory.data(
                adminMediaService.restoreMedia(mediaId, resolveAdminId()), request);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        throw new UnauthorizedException("No authenticated admin principal.");
    }
}
