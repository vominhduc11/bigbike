package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
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

@Validated
@RestController
@RequestMapping("/api/v1/admin/reviews")
@RequiredArgsConstructor
public class AdminReviewController extends AdminControllerSupport {

    private final AdminReviewService adminReviewService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiListResponse<Map<String, Object>> listReviews(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "vi") String lang,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.read");
        return apiResponseFactory.list(adminReviewService.listReviews(page, size, q, status, lang), request);
    }

    @GetMapping("/{id}")
    public ApiDataResponse<Map<String, Object>> getReview(
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.read");
        return apiResponseFactory.data(adminReviewService.getReview(id), request);
    }

    @PatchMapping("/{id}/status")
    public ApiDataResponse<Map<String, Object>> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.write");
        return apiResponseFactory.data(
                adminReviewService.updateStatus(
                        resolveAdminId(),
                        id,
                        body.get("status"),
                        request.getRemoteAddr(),
                        request.getHeader("User-Agent")
                ),
                request
        );
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.write");
        adminReviewService.deleteReview(
                resolveAdminId(),
                id,
                request.getRemoteAddr(),
                request.getHeader("User-Agent")
        );
    }

    /**
     * Bulk moderation — lets the admin table's "duyệt/spam hàng loạt" action send one
     * request instead of N sequential PATCH calls (see ReviewListScreen.jsx runBulk).
     */
    @PostMapping("/bulk-status")
    public ApiDataResponse<Map<String, Object>> bulkUpdateStatus(
            @Valid @RequestBody BulkStatusRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.write");
        int affected = adminReviewService.bulkUpdateStatus(
                resolveAdminId(),
                body.ids(),
                body.status(),
                request.getRemoteAddr(),
                request.getHeader("User-Agent")
        );
        return apiResponseFactory.data(Map.of("affected", affected), request);
    }

    /** Bulk counterpart of {@link #deleteReview}. */
    @PostMapping("/bulk-delete")
    public ApiDataResponse<Map<String, Object>> bulkDeleteReviews(
            @Valid @RequestBody BulkIdsRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.write");
        int affected = adminReviewService.bulkDelete(
                resolveAdminId(),
                body.ids(),
                request.getRemoteAddr(),
                request.getHeader("User-Agent")
        );
        return apiResponseFactory.data(Map.of("affected", affected), request);
    }

    public record BulkStatusRequest(
            @NotEmpty @Size(max = 500) List<@NotNull Long> ids,
            @NotNull String status
    ) {}

    public record BulkIdsRequest(
            @NotEmpty @Size(max = 500) List<@NotNull Long> ids
    ) {}

}
