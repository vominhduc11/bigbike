package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.home.AdminSaveHighlightsRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.HomeHighlightItemDto;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.home.HomeHighlightsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public ApiDataResponse<List<HomeHighlightItemDto>> getHighlights(
            @RequestParam(defaultValue = "vi")
            @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "home_highlights.read");
        // Tên SP/danh mục trả về theo ngôn ngữ nội dung (nút VI/EN ở admin).
        // Ở EN dùng chế độ strict: ẩn hẳn slot có SP chưa đặt tên tiếng Anh (không fallback).
        return apiResponseFactory.data(
                homeHighlightsService.listHighlights(lang, "en".equalsIgnoreCase(lang)), request);
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
