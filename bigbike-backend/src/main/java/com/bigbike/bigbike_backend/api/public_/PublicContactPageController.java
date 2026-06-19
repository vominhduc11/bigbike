package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.PublicContactBlockResponse;
import com.bigbike.bigbike_backend.service.content.ContactPageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public contact-page layout for the storefront ({@code /lien-he}). Returns only enabled blocks with
 * labels/rich-text resolved to {@code lang}; the web merges bound channel values from the public
 * settings payload it already fetches.
 */
@Validated
@RestController
@RequestMapping("/api/v1/contact-page")
@RequiredArgsConstructor
public class PublicContactPageController {

    private final ContactPageService contactPageService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<List<PublicContactBlockResponse>> getLayout(
            @RequestParam(defaultValue = "vi")
            @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(contactPageService.listPublicBlocks(lang), request);
    }
}
