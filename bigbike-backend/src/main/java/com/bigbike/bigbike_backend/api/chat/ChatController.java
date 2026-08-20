package com.bigbike.bigbike_backend.api.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatAvailabilityResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatInteractionRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatInteractionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitScope;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitTier;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.chat.ChatService;
import com.bigbike.bigbike_backend.service.chat.ChatInteractionService;
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
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.MediaType;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Validated
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class ChatController {

    private final ChatService chatService;
    private final ChatInteractionService chatInteractionService;
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
                chatInteractionService.record(body, currentCustomerId()), request);
    }

    @PostMapping("/leads")
    public ApiDataResponse<ChatLeadResponse> captureLead(
            @Valid @RequestBody ChatLeadRequest body,
            HttpServletRequest request
    ) {
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, body.getConversationId().toString());
        return apiResponseFactory.data(chatService.captureLead(body, currentCustomerId()), request);
    }

    @PostMapping("/leads/decline")
    public ApiDataResponse<ChatLeadDeclineResponse> declineLead(
            @Valid @RequestBody ChatLeadDeclineRequest body,
            HttpServletRequest request
    ) {
        rateLimitService.checkOrThrow(
                RateLimitTier.CHAT, RateLimitScope.CONVERSATION, body.conversationId().toString());
        return apiResponseFactory.data(chatService.declineLead(body.conversationId(), currentCustomerId()), request);
    }

    private static UUID currentCustomerId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof CustomerPrincipal principal
                ? principal.customerId() : null;
    }
}
