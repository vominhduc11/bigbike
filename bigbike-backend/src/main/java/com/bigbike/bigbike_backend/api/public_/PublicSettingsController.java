package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.admin.dto.settings.PublicSiteSettingResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class PublicSettingsController {

    private final AdminSettingsService adminSettingsService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/public")
    public ApiDataResponse<List<PublicSiteSettingResponse>> getPublicSettings(
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(adminSettingsService.listPublicSettings(), request);
    }
}
