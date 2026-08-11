package com.bigbike.bigbike_backend.api;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.bigbike.bigbike_backend.api.admin.AdminChatController;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminChatService;
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
}
