package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.PublicSliderResponse;
import com.bigbike.bigbike_backend.service.slider.SliderReadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1")
public class PublicSliderController {

    private static final String LOCATION_REGEX = "^[a-z0-9_-]+$";
    private static final CacheControl SLIDER_CACHE = CacheControl
            .maxAge(Duration.ofMinutes(5))
            .cachePublic();

    private final SliderReadService sliderReadService;
    private final ApiResponseFactory apiResponseFactory;

    public PublicSliderController(SliderReadService sliderReadService, ApiResponseFactory apiResponseFactory) {
        this.sliderReadService = sliderReadService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping("/sliders")
    public ResponseEntity<ApiDataResponse<List<PublicSliderResponse>>> listSliders(
            @RequestParam(defaultValue = "home") @Pattern(regexp = LOCATION_REGEX, message = "Invalid location.") String location,
            HttpServletRequest request
    ) {
        List<PublicSliderResponse> body = sliderReadService.listActiveByLocation(location).stream()
                .map(PublicSliderResponse::from)
                .toList();
        return ResponseEntity.ok()
                .cacheControl(SLIDER_CACHE)
                .body(apiResponseFactory.data(body, request));
    }
}
