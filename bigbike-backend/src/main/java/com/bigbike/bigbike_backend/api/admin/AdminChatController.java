package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStatsResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminChatService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/chat")
@RequiredArgsConstructor
public class AdminChatController {

    private final AdminChatService adminChatService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/conversations")
    public ApiListResponse<AdminChatConversationResponse> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Boolean hasLead,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.list(adminChatService.list(page, size, from, to, hasLead), request);
    }

    @GetMapping("/conversations/{id}")
    public ApiDataResponse<AdminChatConversationDetailResponse> get(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(adminChatService.get(id), request);
    }

    @GetMapping("/stats")
    public ApiDataResponse<AdminChatStatsResponse> stats(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(adminChatService.stats(date), request);
    }
}
