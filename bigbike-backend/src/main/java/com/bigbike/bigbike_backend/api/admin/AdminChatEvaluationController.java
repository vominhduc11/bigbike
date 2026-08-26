package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationDatasetResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationDraftResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationRunRequest;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationRunResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.chat.ChatEvaluationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/chat/evaluations")
@RequiredArgsConstructor
public class AdminChatEvaluationController extends AdminControllerSupport {

    private final ChatEvaluationService evaluationService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/datasets")
    public ApiDataResponse<List<AdminChatEvaluationDatasetResponse>> datasets(
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.data(evaluationService.datasets(), request);
    }

    @PostMapping("/runs")
    public ApiDataResponse<AdminChatEvaluationRunResponse> start(
            @Valid @RequestBody AdminChatEvaluationRunRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.write");
        return apiResponseFactory.data(evaluationService.start(body, resolveAdminId()), request);
    }

    @GetMapping("/runs")
    public ApiDataResponse<List<AdminChatEvaluationRunResponse>> runs(
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.data(evaluationService.runs(), request);
    }

    @GetMapping("/compare")
    public ApiDataResponse<List<AdminChatEvaluationRunResponse>> compare(
            @RequestParam List<UUID> runIds,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.data(evaluationService.compare(runIds), request);
    }

    @PostMapping("/dataset-draft")
    public ApiDataResponse<AdminChatEvaluationDraftResponse> sanitizedDraft(
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        devAdminAuthService.requirePermission(request, "settings.write");
        return apiResponseFactory.data(evaluationService.sanitizedDraft(), request);
    }
}
