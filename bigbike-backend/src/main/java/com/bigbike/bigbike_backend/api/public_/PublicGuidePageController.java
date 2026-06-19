package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.PublicGuidePageResponse;
import com.bigbike.bigbike_backend.service.content.GuidePageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public guide landing layout for the storefront ({@code /huong-dan}). Returns the hero plus only
 * enabled cards with titles/descriptions resolved to {@code lang}; the web builds the grid, sidebar
 * and {@code pathSegment → pageSlug} map from it.
 */
@Validated
@RestController
@RequestMapping("/api/v1/guide-page")
@RequiredArgsConstructor
public class PublicGuidePageController {

    private final GuidePageService guidePageService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<PublicGuidePageResponse> getLayout(
            @RequestParam(defaultValue = "vi")
            @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(guidePageService.getPublic(lang), request);
    }
}
