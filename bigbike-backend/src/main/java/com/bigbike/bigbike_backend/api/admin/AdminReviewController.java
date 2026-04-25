package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Map;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/v1/admin/reviews")
public class AdminReviewController {

    private final AdminReviewService adminReviewService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminReviewController(
            AdminReviewService adminReviewService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminReviewService = adminReviewService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<Map<String, Object>> listReviews(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.read");
        return apiResponseFactory.list(adminReviewService.listReviews(page, size, q, status), request);
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
        return apiResponseFactory.data(adminReviewService.updateStatus(id, body.getOrDefault("status", "PENDING")), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reviews.write");
        adminReviewService.deleteReview(id);
    }
}
