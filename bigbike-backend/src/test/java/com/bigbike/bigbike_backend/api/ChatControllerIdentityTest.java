package com.bigbike.bigbike_backend.api;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.bigbike.bigbike_backend.api.chat.ChatController;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.chat.ChatService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class ChatControllerIdentityTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void signedInChatIdentityComesOnlyFromCustomerPrincipal() {
        UUID customerId = UUID.randomUUID();
        CustomerPrincipal principal = new CustomerPrincipal(
                customerId, "must-not-be-forwarded@example.test", "0900000000", UUID.randomUUID());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        ChatService service = mock(ChatService.class);
        ChatController controller = new ChatController(service, mock(ApiResponseFactory.class));
        ChatMessageRequest request = ChatMessageRequest.builder()
                .message("Các đơn hàng gần đây của tôi")
                .lang("vi")
                .build();

        controller.send(request, mock(HttpServletRequest.class));

        verify(service).send(request, customerId);
    }

    @Test
    void guestChatPassesNoIdentityToTheService() {
        ChatService service = mock(ChatService.class);
        ChatController controller = new ChatController(service, mock(ApiResponseFactory.class));
        ChatMessageRequest request = ChatMessageRequest.builder()
                .message("Đơn hàng của tôi")
                .lang("vi")
                .build();

        controller.send(request, mock(HttpServletRequest.class));

        verify(service).send(request, null);
    }
}
