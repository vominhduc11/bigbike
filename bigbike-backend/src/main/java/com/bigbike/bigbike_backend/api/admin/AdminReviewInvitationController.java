package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewInvitationItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewInvitationOptOutResponse;
import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewInvitationSummaryResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminReviewInvitationService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminReviewInvitationController {

    private final AdminReviewInvitationService service;
    private final DevAdminAuthService adminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/review-invitations/summary")
    public ApiDataResponse<AdminReviewInvitationSummaryResponse> summary(HttpServletRequest request) {
        adminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.data(service.summary(), request);
    }

    @GetMapping("/review-invitations")
    public ApiListResponse<AdminReviewInvitationItemResponse> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            HttpServletRequest request) {
        adminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.list(service.list(page, size, status, q), request);
    }

    @PostMapping("/review-invitations/{id}/skip")
    public ApiDataResponse<Map<String, Boolean>> skip(
            @PathVariable UUID id,
            @Valid @RequestBody SkipRequest body,
            HttpServletRequest request) {
        adminAuthService.requirePermission(request, "settings.write");
        service.skipRefunded(id);
        return apiResponseFactory.data(Map.of("skipped", true), request);
    }

    @GetMapping("/review-invitation-opt-outs")
    public ApiListResponse<AdminReviewInvitationOptOutResponse> optOuts(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            HttpServletRequest request) {
        adminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.list(service.listOptOuts(page, size, q), request);
    }

    public record SkipRequest(
            @NotBlank
            @Pattern(regexp = "REFUNDED", message = "Lý do không gửi không hợp lệ.")
            String reason
    ) {}
}
