package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.PublicLegacyDiscontinuedProductResponse;
import com.bigbike.bigbike_backend.service.admin.LegacyDiscontinuedProductService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/legacy-discontinued-products")
@RequiredArgsConstructor
public class PublicLegacyDiscontinuedProductController {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    private final LegacyDiscontinuedProductService legacyService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/{slug}")
    public ApiDataResponse<PublicLegacyDiscontinuedProductResponse> get(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid legacy slug.") String slug,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(legacyService.getPublic(slug, lang), request);
    }
}
