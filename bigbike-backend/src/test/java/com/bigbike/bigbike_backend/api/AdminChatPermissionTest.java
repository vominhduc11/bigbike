package com.bigbike.bigbike_backend.api;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.bigbike.bigbike_backend.api.admin.AdminChatController;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.service.admin.AdminChatService;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminChatPermissionTest {

    @Test
    void transcriptEndpointsKeepChatReadWhileStatsAllowsSettingsRead() {
        AdminChatService service = mock(AdminChatService.class);
        DevAdminAuthService auth = mock(DevAdminAuthService.class);
        ApiResponseFactory responses = mock(ApiResponseFactory.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        AdminChatController controller = new AdminChatController(service, auth, responses);

        controller.list(1, 20, null, null, request);
        controller.get(UUID.randomUUID(), request);
        controller.stats(null, null, null, request);

        verify(auth, times(2)).requirePermission(request, "chat.read");
        verify(auth).requireAnyPermission(request, "chat.read", "settings.read");
        verify(service).stats(null, null, null);
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
    void customerChatHasNoStaffReplyOrHandoffEndpoints() {
        assertThat(AdminChatController.class.getDeclaredMethods())
                .noneMatch(method -> method.getName().equals("claim")
                        || method.getName().equals("sendMessage")
                        || method.getName().equals("returnToAi")
                        || method.getName().equals("close"));
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
                images,
                auth,
                mock(ApiResponseFactory.class));

        assertThrows(ForbiddenException.class,
                () -> controller.imageContent(UUID.randomUUID(), request));

        verifyNoInteractions(images);
    }
}
