package com.bigbike.bigbike_backend.api.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatAvailabilityResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadOfferRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadOfferResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatInteractionRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatInteractionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatSessionRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatSessionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHistoryResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatDeleteHistoryResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatRealtimeTokenRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatRealtimeTokenResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatFeedbackRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatFeedbackResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatImageUploadResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitScope;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitTier;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.chat.ChatService;
import com.bigbike.bigbike_backend.service.chat.ChatInteractionService;
import com.bigbike.bigbike_backend.service.chat.ChatHandoffService;
import com.bigbike.bigbike_backend.service.chat.ChatVisitorService;
import com.bigbike.bigbike_backend.service.chat.ChatFeedbackService;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Validated
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class ChatController {

    private final ChatService chatService;
    private final ChatInteractionService chatInteractionService;
    private final ChatHandoffService chatHandoffService;
    private final ChatVisitorService chatVisitorService;
    private final ChatFeedbackService chatFeedbackService;
    private final ChatImageService chatImageService;
    private final ApiResponseFactory apiResponseFactory;
    private final RateLimitService rateLimitService;

    /** Compatibility constructor used by focused controller tests that do not call interactions. */
    public ChatController(
            ChatService chatService,
            ApiResponseFactory apiResponseFactory,
            RateLimitService rateLimitService
    ) {
        this.chatService = chatService;
        this.chatInteractionService = null;
        this.chatHandoffService = null;
        this.chatVisitorService = null;
        this.chatFeedbackService = null;
        this.chatImageService = null;
        this.apiResponseFactory = apiResponseFactory;
        this.rateLimitService = rateLimitService;
    }

    @GetMapping("/availability")
    public ApiDataResponse<ChatAvailabilityResponse> availability(
            @RequestParam(defaultValue = "vi")
            @Pattern(regexp = "^(vi|en)$", message = "Ngôn ngữ phải là vi hoặc en.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(chatService.availability(lang), request);
    }

    @PostMapping("/sessions")
    public ApiDataResponse<ChatSessionResponse> openSession(
            @Valid @RequestBody ChatSessionRequest body,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(chatVisitorService.open(body, currentCustomerId()), request);
    }

    @GetMapping("/conversations/{id}/messages")
    public ApiDataResponse<ChatHistoryResponse> history(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") @jakarta.validation.constraints.Min(0) long afterSequence,
            @RequestHeader(value = "X-Chat-Visitor-Token", required = false) String visitorToken,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(chatVisitorService.history(
                id, afterSequence, currentCustomerId(), visitorToken), request);
    }

    @DeleteMapping("/history")
    public ApiDataResponse<ChatDeleteHistoryResponse> deleteHistory(
            @RequestHeader(value = "X-Chat-Visitor-Token", required = false) String visitorToken,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(
                chatVisitorService.deleteHistory(currentCustomerId(), visitorToken), request);
    }

    @PostMapping("/realtime-token")
    public ApiDataResponse<ChatRealtimeTokenResponse> realtimeToken(
            @Valid @RequestBody ChatRealtimeTokenRequest body,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(chatVisitorService.realtimeToken(
                body.conversationId(), currentCustomerId(), body.visitorToken()), request);
    }

    @PostMapping("/messages/{messageId}/feedback")
    public ApiDataResponse<ChatFeedbackResponse> feedback(
            @PathVariable UUID messageId,
            @Valid @RequestBody ChatFeedbackRequest body,
            @RequestHeader(value = "X-Chat-Visitor-Token", required = false) String visitorToken,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(chatFeedbackService.record(
                messageId, body, currentCustomerId(), visitorToken), request);
    }

    @PostMapping("/messages")
    public ApiDataResponse<ChatMessageResponse> send(
            @Valid @RequestBody ChatMessageRequest body,
            HttpServletRequest request
    ) {
        if (body.getConversationId() != null) {
            rateLimitService.checkOrThrow(
                    RateLimitTier.CHAT, RateLimitScope.CONVERSATION, body.getConversationId().toString());
        }
        return apiResponseFactory.data(chatService.send(body, currentCustomerId()), request);
    }

    @PostMapping(path = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiDataResponse<ChatImageUploadResponse> uploadImage(
            @RequestPart("file") MultipartFile file,
            @RequestParam UUID requestId,
            @RequestParam(required = false) UUID conversationId,
            @RequestParam(defaultValue = "vi")
            @Pattern(regexp = "^(vi|en)$", message = "Ngôn ngữ phải là vi hoặc en.") String lang,
            @RequestHeader(value = "X-Chat-Visitor-Token", required = false) String visitorToken,
            HttpServletRequest request
    ) {
        UUID scopeId = conversationId == null ? requestId : conversationId;
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, scopeId.toString());
        return apiResponseFactory.data(chatImageService.upload(
                requestId, conversationId, lang, file, currentCustomerId(),
                resolveVisitorId(visitorToken)), request);
    }

    @GetMapping("/images/{id}/content")
    public ResponseEntity<byte[]> imageContent(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Chat-Visitor-Token", required = false) String visitorToken
    ) {
        var content = chatImageService.customerContent(
                id, currentCustomerId(), resolveVisitorId(visitorToken));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(content.mimeType()))
                .body(content.bytes());
    }

    @PostMapping(path = "/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(
            @Valid @RequestBody ChatMessageRequest body,
            HttpServletRequest request
    ) {
        if (body.getConversationId() != null) {
            rateLimitService.checkOrThrow(
                    RateLimitTier.CHAT, RateLimitScope.CONVERSATION,
                    body.getConversationId().toString());
        }
        UUID customerId = currentCustomerId();
        SseEmitter emitter = new SseEmitter(75_000L);
        CompletableFuture.runAsync(() -> {
            try {
                sendProgress(emitter, "UNDERSTANDING");
                sendProgress(emitter, "CHECKING_PRODUCTS");
                ChatMessageResponse result = chatService.send(body, customerId);
                sendProgress(emitter, "FINALIZING");
                emitter.send(SseEmitter.event().name("result").data(result));
                emitter.complete();
            } catch (Exception exception) {
                try {
                    emitter.send(SseEmitter.event().name("error").data(Map.of(
                            "code", "CHAT_UNAVAILABLE")));
                    emitter.complete();
                } catch (Exception ignored) {
                    emitter.completeWithError(exception);
                }
            }
        });
        return emitter;
    }

    private static void sendProgress(SseEmitter emitter, String code) throws java.io.IOException {
        emitter.send(SseEmitter.event().name("progress").data(Map.of("code", code)));
    }

    @PostMapping("/interactions")
    public ApiDataResponse<ChatInteractionResponse> recordInteraction(
            @Valid @RequestBody ChatInteractionRequest body,
            HttpServletRequest request
    ) {
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, body.conversationId().toString());
        return apiResponseFactory.data(
                chatInteractionService.record(
                        body, currentCustomerId(), resolveVisitorId(body.visitorToken())), request);
    }

    @PostMapping("/handoffs")
    public ApiDataResponse<ChatHandoffResponse> requestHandoff(
            @Valid @RequestBody ChatHandoffRequest body,
            HttpServletRequest request
    ) {
        UUID scopeId = body.conversationId() == null ? body.requestId() : body.conversationId();
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, scopeId.toString());
        UUID visitorId = resolveVisitorId(body.visitorToken());
        return apiResponseFactory.data(
                chatHandoffService.request(body, currentCustomerId(), visitorId), request);
    }

    @PostMapping("/leads")
    public ApiDataResponse<ChatLeadResponse> captureLead(
            @Valid @RequestBody ChatLeadRequest body,
            HttpServletRequest request
    ) {
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, body.getConversationId().toString());
        return apiResponseFactory.data(chatService.captureLead(
                body, currentCustomerId(), resolveVisitorId(body.getVisitorToken())), request);
    }

    @PostMapping("/leads/offer")
    public ApiDataResponse<ChatLeadOfferResponse> offerLead(
            @Valid @RequestBody ChatLeadOfferRequest body,
            HttpServletRequest request
    ) {
        UUID scopeId = body.conversationId() == null ? body.requestId() : body.conversationId();
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, scopeId.toString());
        return apiResponseFactory.data(chatService.offerLead(
                body, currentCustomerId(), resolveVisitorId(body.visitorToken())), request);
    }

    @PostMapping("/leads/decline")
    public ApiDataResponse<ChatLeadDeclineResponse> declineLead(
            @Valid @RequestBody ChatLeadDeclineRequest body,
            HttpServletRequest request
    ) {
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, body.conversationId().toString());
        return apiResponseFactory.data(chatService.declineLead(
                body.conversationId(), currentCustomerId(), resolveVisitorId(body.visitorToken())), request);
    }

    private UUID resolveVisitorId(String visitorToken) {
        return chatVisitorService == null || visitorToken == null || visitorToken.isBlank()
                ? null : chatVisitorService.resolveVisitorId(visitorToken);
    }

    private static UUID currentCustomerId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof CustomerPrincipal principal
                ? principal.customerId() : null;
    }
}
