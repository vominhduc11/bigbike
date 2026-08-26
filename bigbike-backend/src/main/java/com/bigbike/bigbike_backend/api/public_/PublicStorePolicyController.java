package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.PublicStorePolicyResponse;
import com.bigbike.bigbike_backend.service.content.StorePolicyService;
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
@RequestMapping("/api/v1/policies")
@RequiredArgsConstructor
public class PublicStorePolicyController {

    private final StorePolicyService storePolicyService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/{topic}")
    public ApiDataResponse<PublicStorePolicyResponse> get(
            @PathVariable @Pattern(regexp = "^(warranty|return-exchange)$") String topic,
            @RequestParam(defaultValue = "vi")
            @Pattern(regexp = "^(vi|en)$", message = "Ngôn ngữ phải là vi hoặc en.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(storePolicyService.get(topic, lang), request);
    }
}
