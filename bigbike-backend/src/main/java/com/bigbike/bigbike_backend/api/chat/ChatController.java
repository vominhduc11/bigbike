package com.bigbike.bigbike_backend.api.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatAvailabilityResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitScope;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitTier;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.chat.ChatService;
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

@Validated
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ApiResponseFactory apiResponseFactory;
    private final RateLimitService rateLimitService;

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
