package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatModelCatalogResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatModelUpdateRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.admin.AdminSettingsService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.chat.GeminiModelCatalogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/chat")
@RequiredArgsConstructor
public class AdminChatModelController extends AdminControllerSupport {

    private final GeminiModelCatalogService modelCatalogService;
    private final AdminSettingsService adminSettingsService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/models")
    public ApiDataResponse<AdminChatModelCatalogResponse> models(
            @RequestParam(defaultValue = "false") boolean refresh,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.data(modelCatalogService.catalog(refresh), request);
    }

    @PutMapping("/model")
    public ApiDataResponse<AdminChatModelCatalogResponse> updateModel(
            @Valid @RequestBody AdminChatModelUpdateRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.write");
        String modelId = body.modelId().trim();
        if (!modelCatalogService.isSelectable(modelId, true)) {
            throw ValidationException.fromField(
                    "modelId", "MODEL_NOT_SELECTABLE",
                    "Model này không phải bản stable có giá đã xác minh và đang dùng được với tài khoản hiện tại.");
        }
        adminSettingsService.updateAssistantModel(modelId, resolveAdminId());
        return apiResponseFactory.data(modelCatalogService.catalog(false), request);
    }
}
