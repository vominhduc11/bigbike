package com.bigbike.bigbike_backend.api;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.bigbike.bigbike_backend.api.admin.AdminChatController;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatSendMessageRequest;
import com.bigbike.bigbike_backend.service.admin.AdminChatService;
import com.bigbike.bigbike_backend.service.admin.AdminChatInsightsService;
import com.bigbike.bigbike_backend.service.chat.ChatFeedbackService;
import com.bigbike.bigbike_backend.service.chat.ChatHandoffService;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminChatPermissionTest {

    @Test
    void everyAdminChatReadRequiresChatReadPermission() {
        AdminChatService service = mock(AdminChatService.class);
        DevAdminAuthService auth = mock(DevAdminAuthService.class);
        ApiResponseFactory responses = mock(ApiResponseFactory.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        AdminChatController controller = new AdminChatController(service, auth, responses);

        controller.list(1, 20, null, null, null, request);
        controller.get(UUID.randomUUID(), request);
        controller.stats(null, request);

        verify(auth, times(3)).requirePermission(request, "chat.read");
    }

    @Test
    void accountWithoutChatReadCannotViewAnyCustomerConversation() {
        AdminChatService service = mock(AdminChatService.class);
        DevAdminAuthService auth = mock(DevAdminAuthService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(auth.requirePermission(request, "chat.read"))
                .thenThrow(new ForbiddenException("Permission denied."));
        AdminChatController controller = new AdminChatController(
                service, auth, mock(ApiResponseFactory.class));

        assertThrows(ForbiddenException.class,
                () -> controller.get(UUID.randomUUID(), request));

        verify(service, never()).get(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void accountWithoutChatReplyCannotClaimOrSendToACustomer() {
        AdminChatService chat = mock(AdminChatService.class);
        ChatHandoffService handoffs = mock(ChatHandoffService.class);
        DevAdminAuthService auth = mock(DevAdminAuthService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(auth.requirePermission(request, "chat.reply"))
                .thenThrow(new ForbiddenException("Permission denied."));
        AdminChatController controller = new AdminChatController(
                chat,
                handoffs,
                mock(ChatFeedbackService.class),
                mock(AdminChatInsightsService.class),
                auth,
                mock(ApiResponseFactory.class));

        assertThrows(ForbiddenException.class,
                () -> controller.claim(UUID.randomUUID(), request));
        assertThrows(ForbiddenException.class,
                () -> controller.sendMessage(
                        UUID.randomUUID(),
                        new AdminChatSendMessageRequest(UUID.randomUUID(), "Xin chào anh/chị"),
                        request));

        verifyNoInteractions(handoffs);
    }

    @Test
    void accountWithoutChatReadCannotDownloadACustomerImageEvenWhenItKnowsTheId() {
        AdminChatService chat = mock(AdminChatService.class);
        ChatImageService images = mock(ChatImageService.class);
        DevAdminAuthService auth = mock(DevAdminAuthService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(auth.requirePermission(request, "chat.read"))
                .thenThrow(new ForbiddenException("Permission denied."));
        AdminChatController controller = new AdminChatController(
                chat,
                mock(ChatHandoffService.class),
                mock(ChatFeedbackService.class),
                mock(AdminChatInsightsService.class),
                images,
                auth,
                mock(ApiResponseFactory.class));

        assertThrows(ForbiddenException.class,
                () -> controller.imageContent(UUID.randomUUID(), request));

        verifyNoInteractions(images);
    }
}
