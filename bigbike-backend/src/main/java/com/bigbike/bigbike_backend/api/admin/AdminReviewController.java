package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.UpdateReviewStatusRequest;
import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewSummaryResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
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
    private final ClientIpResolver clientIpResolver;

    @GetMapping
    public ApiListResponse<Map<String, Object>> listReviews(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DecimalMin("1.0") @DecimalMax("5.0") BigDecimal rating,
            @RequestParam(defaultValue = "vi") String lang,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.read");
        return apiResponseFactory.list(adminReviewService.listReviews(page, size, q, status, rating, lang), request);
    }

    @GetMapping("/summary")
    public ApiDataResponse<AdminReviewSummaryResponse> reviewSummary(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "reviews.read");
        return apiResponseFactory.data(adminReviewService.getSummary(), request);
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
            @Valid @RequestBody UpdateReviewStatusRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.write");
        return apiResponseFactory.data(
                adminReviewService.updateStatus(
                        resolveAdminId(),
                        id,
                        body.status(),
                        body.expectedVersion(),
                        clientIpResolver.resolve(request),
                        request.getHeader("User-Agent")
                ),
                request
        );
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(
            @PathVariable Long id,
            @RequestParam @Min(0) Long expectedVersion,
            HttpServletRequest request
    ) {
        requireSuperAdminWithReviewsWrite(request);
        adminReviewService.deleteReview(
                resolveAdminId(),
                id,
                expectedVersion,
                clientIpResolver.resolve(request),
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
        AdminReviewService.BulkReviewResult result = adminReviewService.bulkUpdateStatus(
                resolveAdminId(),
                body.items().stream()
                        .map(item -> new AdminReviewService.VersionedReviewId(
                                item.id(), item.expectedVersion()))
                        .toList(),
                body.status(),
                clientIpResolver.resolve(request),
                request.getHeader("User-Agent")
        );
        return apiResponseFactory.data(Map.of(
                "affected", result.affected(),
                "skipped", result.skipped()), request);
    }

    /** Bulk counterpart of {@link #deleteReview}. */
    @PostMapping("/bulk-delete")
    public ApiDataResponse<Map<String, Object>> bulkDeleteReviews(
            @Valid @RequestBody BulkIdsRequest body,
            HttpServletRequest request
    ) {
        requireSuperAdminWithReviewsWrite(request);
        AdminReviewService.BulkReviewResult result = adminReviewService.bulkDelete(
                resolveAdminId(),
                body.items().stream()
                        .map(item -> new AdminReviewService.VersionedReviewId(
                                item.id(), item.expectedVersion()))
                        .toList(),
                clientIpResolver.resolve(request),
                request.getHeader("User-Agent")
        );
        return apiResponseFactory.data(Map.of(
                "affected", result.affected(),
                "skipped", result.skipped()), request);
    }

    public record BulkStatusRequest(
            @NotEmpty @Size(max = 500) List<@NotNull @Valid VersionedReviewItem> items,
            @NotBlank
            @Pattern(
                    regexp = "(?i)APPROVED|PENDING|SPAM|TRASH",
                    message = "Trạng thái không hợp lệ.")
            String status
    ) {}

    public record BulkIdsRequest(
            @NotEmpty @Size(max = 500) List<@NotNull @Valid VersionedReviewItem> items
    ) {}

    public record VersionedReviewItem(
            @NotNull Long id,
            @NotNull @PositiveOrZero Long expectedVersion
    ) {}

    private void requireSuperAdminWithReviewsWrite(HttpServletRequest request) {
        var admin = devAdminAuthService.requirePermission(request, "reviews.write");
        if (admin.roles().stream().noneMatch("SUPER_ADMIN"::equals)) {
            throw new ForbiddenException(
                    "Chỉ Super Admin được xóa vĩnh viễn đánh giá.");
        }
    }
}
