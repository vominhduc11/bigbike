package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffActionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatSendMessageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStaffMessageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStatsResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminChatService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.chat.ChatHandoffService;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Admin transcript, quota and staff-handoff API only. */
@Validated
@RestController
@RequestMapping("/api/v1/admin/chat")
public class AdminChatController extends AdminControllerSupport {

    private final AdminChatService adminChatService;
    private final ChatHandoffService chatHandoffService;
    private final ChatImageService chatImageService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @Autowired
    public AdminChatController(
            AdminChatService adminChatService,
            ChatHandoffService chatHandoffService,
            ChatImageService chatImageService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminChatService = adminChatService;
        this.chatHandoffService = chatHandoffService;
        this.chatImageService = chatImageService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    /** Focused read-permission test constructor. */
    public AdminChatController(
            AdminChatService adminChatService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this(adminChatService, null, null, devAdminAuthService, apiResponseFactory);
    }

    @GetMapping("/conversations")
    public ApiListResponse<AdminChatConversationResponse> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.list(adminChatService.list(page, size, from, to), request);
    }

    @GetMapping("/conversations/{id}")
    public ApiDataResponse<AdminChatConversationDetailResponse> get(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(adminChatService.get(id), request);
    }

    @GetMapping("/images/{id}/content")
    public ResponseEntity<byte[]> imageContent(@PathVariable UUID id, HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "chat.read");
        var content = chatImageService.adminContent(id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(content.mimeType()))
                .body(content.bytes());
    }

    @GetMapping("/stats")
    public ApiDataResponse<AdminChatStatsResponse> stats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest request
    ) {
        devAdminAuthService.requireAnyPermission(request, "chat.read", "settings.read");
        return apiResponseFactory.data(adminChatService.stats(date, from, to), request);
    }

    @GetMapping("/handoffs")
    public ApiDataResponse<AdminChatHandoffSummaryResponse> handoffs(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(chatHandoffService.listWaiting(), request);
    }

    @PostMapping("/handoffs/{id}/claim")
    public ApiDataResponse<AdminChatHandoffResponse> claim(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.reply");
        return apiResponseFactory.data(chatHandoffService.claim(id, resolveAdminId()), request);
    }

    @PostMapping("/conversations/{id}/messages")
    public ApiDataResponse<AdminChatStaffMessageResponse> sendMessage(
            @PathVariable UUID id,
            @Valid @RequestBody AdminChatSendMessageRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.reply");
        var message = chatHandoffService.sendStaffMessage(
                id, resolveAdminId(), body.requestId(), body.content());
        return apiResponseFactory.data(new AdminChatStaffMessageResponse(
                message.getId(), message.getConversationId(), message.getSequenceNo(),
                message.getRole(), message.getContent(), message.getStaffDisplayName(),
                message.getCreatedAt()), request);
    }

    @PostMapping("/handoffs/{id}/return-to-ai")
    public ApiDataResponse<AdminChatHandoffResponse> returnToAi(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) AdminChatHandoffActionRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.reply");
        return apiResponseFactory.data(chatHandoffService.returnToAi(
                id, resolveAdminId(), body == null ? "vi" : body.safeLocale()), request);
    }

    @PostMapping("/handoffs/{id}/close")
    public ApiDataResponse<AdminChatHandoffResponse> close(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) AdminChatHandoffActionRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.reply");
        return apiResponseFactory.data(chatHandoffService.close(
                id, resolveAdminId(), body == null ? "vi" : body.safeLocale()), request);
    }
}
