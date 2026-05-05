package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.public_.dto.PublicProductReviewsResponse;
import com.bigbike.bigbike_backend.api.public_.dto.SubmitReviewRequest;
import com.bigbike.bigbike_backend.service.public_.PublicReviewService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/products/{productId}/reviews")
public class PublicReviewController {

    private final PublicReviewService publicReviewService;
    private final ApiResponseFactory apiResponseFactory;

    public PublicReviewController(PublicReviewService publicReviewService, ApiResponseFactory apiResponseFactory) {
        this.publicReviewService = publicReviewService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiDataResponse<PublicProductReviewsResponse> getReviews(
            @PathVariable String productId,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(publicReviewService.getProductReviews(productId, page, size), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Map<String, Object>> submitReview(
            @PathVariable String productId,
            @RequestBody SubmitReviewRequest body,
            HttpServletRequest request
    ) {
        validate(body);
        publicReviewService.submitReview(productId, body.authorName(), body.rating(), body.comment());
        return apiResponseFactory.data(Map.of("success", true), request);
    }

    private void validate(SubmitReviewRequest body) {
        if (body.authorName() == null || body.authorName().isBlank()) {
            throw ValidationException.fromField("authorName", "REQUIRED", "Vui lòng nhập tên.");
        }
        if (body.authorName().trim().length() > 80) {
            throw ValidationException.fromField("authorName", "TOO_LONG", "Tên không được vượt quá 80 ký tự.");
        }
        if (body.rating() == null || body.rating() < 1 || body.rating() > 5) {
            throw ValidationException.fromField("rating", "INVALID", "Đánh giá phải từ 1 đến 5 sao.");
        }
        if (body.comment() != null && body.comment().length() > 1000) {
            throw ValidationException.fromField("comment", "TOO_LONG", "Nhận xét không được vượt quá 1000 ký tự.");
        }
    }
}
