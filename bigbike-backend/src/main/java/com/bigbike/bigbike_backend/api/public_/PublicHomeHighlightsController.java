package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.HomeHighlightItemDto;
import com.bigbike.bigbike_backend.service.home.HomeHighlightsService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PublicHomeHighlightsController {

    private static final CacheControl HIGHLIGHTS_CACHE = CacheControl
            .maxAge(Duration.ofMinutes(5))
            .cachePublic();

    private final HomeHighlightsService homeHighlightsService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/home/category-highlights")
    public ResponseEntity<ApiDataResponse<List<HomeHighlightItemDto>>> listHighlights(
            HttpServletRequest request
    ) {
        List<HomeHighlightItemDto> body = homeHighlightsService.listHighlights();
        return ResponseEntity.ok()
                .cacheControl(HIGHLIGHTS_CACHE)
                .body(apiResponseFactory.data(body, request));
    }
}
