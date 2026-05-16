package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.PublicHomeVideoResponse;
import com.bigbike.bigbike_backend.service.video.HomeVideoReadService;
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
public class PublicHomeVideoController {

    private static final CacheControl VIDEO_CACHE = CacheControl
            .maxAge(Duration.ofMinutes(5))
            .cachePublic();

    private final HomeVideoReadService homeVideoReadService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/home-videos")
    public ResponseEntity<ApiDataResponse<List<PublicHomeVideoResponse>>> listHomeVideos(
            HttpServletRequest request
    ) {
        List<PublicHomeVideoResponse> body = homeVideoReadService.listActive().stream()
                .map(PublicHomeVideoResponse::from)
                .toList();
        return ResponseEntity.ok()
                .cacheControl(VIDEO_CACHE)
                .body(apiResponseFactory.data(body, request));
    }
}
