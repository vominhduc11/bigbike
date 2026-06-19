package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.guide.AdminGuidePageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.guide.SaveGuidePageRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.content.GuidePageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Guide page builder (admin). Manages the hero + card grid of the public {@code /huong-dan} landing
 * page. Gated by {@code content.read}/{@code content.update} like the other CMS-page editors. Detail
 * bodies stay in the Content → Pages module (referenced by each card's {@code pageSlug}).
 */
@Validated
@RestController
@RequestMapping("/api/v1/admin/guide-page")
@RequiredArgsConstructor
public class AdminGuidePageController extends AdminControllerSupport {

    private final GuidePageService guidePageService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<AdminGuidePageResponse> getLayout(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "content.read");
        return apiResponseFactory.data(guidePageService.getForAdmin(), request);
    }

    @PutMapping
    public ApiDataResponse<AdminGuidePageResponse> saveLayout(
            @Valid @RequestBody SaveGuidePageRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(guidePageService.save(body), request);
    }
}
