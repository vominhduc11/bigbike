package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.home.AdminSaveHighlightsRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.HomeHighlightItemDto;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.home.HomeHighlightsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/home/category-highlights")
@RequiredArgsConstructor
public class AdminHomeHighlightsController extends AdminControllerSupport {

    private final HomeHighlightsService homeHighlightsService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<List<HomeHighlightItemDto>> getHighlights(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "home_highlights.read");
        return apiResponseFactory.data(homeHighlightsService.listHighlights(), request);
    }

    @PutMapping
    public ApiDataResponse<List<HomeHighlightItemDto>> saveHighlights(
            @Valid @RequestBody AdminSaveHighlightsRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "home_highlights.write");
        return apiResponseFactory.data(homeHighlightsService.saveHighlights(body), request);
    }
}
