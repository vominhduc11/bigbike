package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.MediaListQuery;
import com.bigbike.bigbike_backend.api.admin.dto.media.MediaReferenceItem;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpdateMediaRequest;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import com.bigbike.bigbike_backend.service.admin.MediaReferenceService;
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
    private final MediaReferenceService mediaReferenceService;
    private final com.bigbike.bigbike_backend.persistence.repository.media.MediaTagJdbc tagJdbc;

    public AdminMediaController(
            AdminMediaService adminMediaService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory,
            MediaReferenceService mediaReferenceService,
            com.bigbike.bigbike_backend.persistence.repository.media.MediaTagJdbc tagJdbc
    ) {
        this.adminMediaService = adminMediaService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
        this.mediaReferenceService = mediaReferenceService;
        this.tagJdbc = tagJdbc;
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
            @RequestParam(required = false) String usageFilter,
            @RequestParam(required = false) String uploadedFrom,
            @RequestParam(required = false) String uploadedTo,
            @RequestParam(required = false) Long minSize,
            @RequestParam(required = false) Long maxSize,
            @RequestParam(required = false) Integer minWidth,
            @RequestParam(required = false) Integer minHeight,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String dir,
            @RequestParam(required = false) String folderFilter,
            @RequestParam(required = false) String tag,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.read");
        MediaListQuery query = new MediaListQuery(
                page, size, q, mimeType, status, storageProvider, usageFilter,
                parseInstant(uploadedFrom), parseInstant(uploadedTo),
                minSize, maxSize, minWidth, minHeight, sort, dir,
                folderFilter, tag);
        return apiResponseFactory.list(adminMediaService.listMedia(query), request);
    }

    @GetMapping("/stats")
    public ApiDataResponse<AdminMediaStatsResponse> getStats(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String mimeType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String storageProvider,
            @RequestParam(required = false) String uploadedFrom,
            @RequestParam(required = false) String uploadedTo,
            @RequestParam(required = false) Long minSize,
            @RequestParam(required = false) Long maxSize,
            @RequestParam(required = false) Integer minWidth,
            @RequestParam(required = false) Integer minHeight,
            @RequestParam(required = false) String folderFilter,
            @RequestParam(required = false) String tag,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.read");
        MediaListQuery query = new MediaListQuery(
                1, 1, q, mimeType, status, storageProvider, null,
                parseInstant(uploadedFrom), parseInstant(uploadedTo),
                minSize, maxSize, minWidth, minHeight, null, null,
                folderFilter, tag);
        return apiResponseFactory.data(adminMediaService.getStats(query), request);
    }

    @GetMapping("/tags")
    public ApiDataResponse<List<String>> listTags(
            @RequestParam(required = false) String prefix,
            @RequestParam(defaultValue = "20") int limit,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.read");
        return apiResponseFactory.data(tagJdbc.findByPrefix(prefix, limit), request);
    }

    @PostMapping("/bulk-move")
    public ApiDataResponse<java.util.Map<String, Object>> bulkMove(
            @RequestBody BulkMoveRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        int affected = adminMediaService.bulkMoveToFolder(body.ids(), body.folderId(), resolveAdminId());
        return apiResponseFactory.data(java.util.Map.of("affected", affected), request);
    }

    public record BulkMoveRequest(List<UUID> ids, UUID folderId) {}

    @PostMapping("/bulk-delete")
    public ApiDataResponse<java.util.Map<String, Object>> bulkDelete(
            @RequestBody BulkIdsRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        int affected = adminMediaService.bulkSoftDelete(body.ids(), resolveAdminId());
        return apiResponseFactory.data(java.util.Map.of("affected", affected), request);
    }

    @PostMapping("/bulk-restore")
    public ApiDataResponse<java.util.Map<String, Object>> bulkRestore(
            @RequestBody BulkIdsRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        int affected = adminMediaService.bulkRestore(body.ids(), resolveAdminId());
        return apiResponseFactory.data(java.util.Map.of("affected", affected), request);
    }

    @PostMapping("/bulk-hard-delete")
    public ApiDataResponse<java.util.Map<String, Object>> bulkHardDelete(
            @RequestBody BulkIdsRequest body,
            HttpServletRequest request
    ) {
        // Hard delete is irreversible — gated to roles with the wildcard permission.
        devAdminAuthService.requirePermission(request, "*");
        AdminMediaService.BulkHardDeleteResult result =
                adminMediaService.bulkHardDelete(body.ids(), resolveAdminId());
        return apiResponseFactory.data(java.util.Map.of(
                "deleted", result.deleted(),
                "missing", result.missing(),
                "blocked", result.blocked()
        ), request);
    }

    public record BulkIdsRequest(List<UUID> ids) {}

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    @GetMapping("/{mediaId}/references")
    public ApiDataResponse<java.util.List<MediaReferenceItem>> getMediaReferences(
            @PathVariable UUID mediaId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.read");
        return apiResponseFactory.data(adminMediaService.getMediaReferences(mediaId), request);
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

    @PostMapping(value = "/{mediaId}/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiDataResponse<AdminMediaDetailResponse> replaceFile(
            @PathVariable UUID mediaId,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "media.write");
        return apiResponseFactory.data(
                adminMediaService.replaceFile(mediaId, file, resolveAdminId()), request);
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
