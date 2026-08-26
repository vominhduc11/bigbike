package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatFunnelResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatUnansweredResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatDataGapResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatSendMessageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffActionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStaffMessageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatFeedbackReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatTemplatePrefillResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminChatService;
import com.bigbike.bigbike_backend.service.chat.ChatHandoffService;
import com.bigbike.bigbike_backend.service.chat.ChatFeedbackService;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import com.bigbike.bigbike_backend.service.admin.AdminChatInsightsService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.UUID;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

@Validated
@RestController
@RequestMapping("/api/v1/admin/chat")
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class AdminChatController extends AdminControllerSupport {

    private final AdminChatService adminChatService;
    private final ChatHandoffService chatHandoffService;
    private final ChatFeedbackService chatFeedbackService;
    private final AdminChatInsightsService adminChatInsightsService;
    private final ChatImageService chatImageService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    /** Compatibility constructor for focused permission tests that do not call handoff routes. */
    public AdminChatController(
            AdminChatService adminChatService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminChatService = adminChatService;
        this.chatHandoffService = null;
        this.chatFeedbackService = null;
        this.adminChatInsightsService = null;
        this.chatImageService = null;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    /** Compatibility constructor for the live-chat permission tests. */
    public AdminChatController(
            AdminChatService adminChatService,
            ChatHandoffService chatHandoffService,
            ChatFeedbackService chatFeedbackService,
            AdminChatInsightsService adminChatInsightsService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminChatService = adminChatService;
        this.chatHandoffService = chatHandoffService;
        this.chatFeedbackService = chatFeedbackService;
        this.adminChatInsightsService = adminChatInsightsService;
        this.chatImageService = null;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

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

    @GetMapping("/images/{id}/content")
    public ResponseEntity<byte[]> imageContent(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        var content = chatImageService.adminContent(id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(content.mimeType()))
                .body(content.bytes());
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

    @GetMapping("/handoffs")
    public ApiDataResponse<AdminChatHandoffSummaryResponse> handoffs(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(chatHandoffService.listWaiting(), request);
    }

    @PostMapping("/handoffs/{id}/acknowledge")
    public ApiDataResponse<AdminChatHandoffResponse> acknowledge(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.reply");
        return apiResponseFactory.data(
                chatHandoffService.acknowledge(id, resolveAdminId()), request);
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
        String locale = body == null ? "vi" : body.safeLocale();
        return apiResponseFactory.data(
                chatHandoffService.returnToAi(id, resolveAdminId(), locale), request);
    }

    @PostMapping("/handoffs/{id}/close")
    public ApiDataResponse<AdminChatHandoffResponse> close(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) AdminChatHandoffActionRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.reply");
        String locale = body == null ? "vi" : body.safeLocale();
        return apiResponseFactory.data(
                chatHandoffService.close(id, resolveAdminId(), locale), request);
    }

    @GetMapping("/funnel")
    public ApiDataResponse<AdminChatFunnelResponse> funnel(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(adminChatInsightsService.funnel(from, to), request);
    }

    @GetMapping("/unanswered")
    public ApiDataResponse<List<AdminChatUnansweredResponse>> unanswered(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(adminChatInsightsService.unanswered(from, to), request);
    }

    @GetMapping("/data-gaps")
    public ApiDataResponse<AdminChatDataGapResponse> dataGaps(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "chat.read");
        devAdminAuthService.requirePermission(request, "products.read");
        return apiResponseFactory.data(adminChatInsightsService.dataGaps(), request);
    }

    @GetMapping("/feedback")
    public ApiDataResponse<AdminChatFeedbackReportResponse> feedback(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        return apiResponseFactory.data(chatFeedbackService.report(from, to), request);
    }

    @GetMapping("/feedback/{id}/template-prefill")
    public ApiDataResponse<AdminChatTemplatePrefillResponse> feedbackPrefill(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "chat.read");
        devAdminAuthService.requirePermission(request, "settings.write");
        return apiResponseFactory.data(chatFeedbackService.prefill(id), request);
    }
}
