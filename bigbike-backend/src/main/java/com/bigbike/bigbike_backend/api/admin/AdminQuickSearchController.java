package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminQuickSearchService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/quick-search")
@RequiredArgsConstructor
public class AdminQuickSearchController extends AdminControllerSupport {

    private final AdminQuickSearchService adminQuickSearchService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<AdminQuickSearchResponse> search(
            @RequestParam @NotBlank @Size(max = 100) String q,
            HttpServletRequest request
    ) {
        var profile = devAdminAuthService.requireAnyPermission(request, AdminQuickSearchService.SEARCH_PERMISSIONS);
        return apiResponseFactory.data(adminQuickSearchService.search(q, profile), request);
    }
}
