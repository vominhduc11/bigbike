package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.public_.dto.PublicProductReviewsResponse;
import com.bigbike.bigbike_backend.api.public_.dto.SubmitReviewRequest;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.public_.PublicReviewService;
import com.bigbike.bigbike_backend.service.security.SafeMediaAssetUrlPolicy;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
@RequestMapping("/api/v1/products/{productId}/reviews")
@RequiredArgsConstructor
public class PublicReviewController {

    private static final int MAX_PHOTOS = 10;

    private final PublicReviewService publicReviewService;
    private final ApiResponseFactory apiResponseFactory;
    private final SafeMediaAssetUrlPolicy safeMediaAssetUrlPolicy;

    @GetMapping
    public ApiDataResponse<PublicProductReviewsResponse> getReviews(
            @PathVariable @Size(max = 64) String productId,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size,
            @RequestParam(required = false) @Min(1) @Max(5) Integer rating,
            @RequestParam(defaultValue = "newest") @Size(max = 16) String sort,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(
                publicReviewService.getProductReviews(productId, page, size, rating, sort), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Map<String, Object>> submitReview(
            @PathVariable @Size(max = 64) String productId,
            @Valid @RequestBody SubmitReviewRequest body,
            HttpServletRequest request
    ) {
        // Honeypot stealth: real users never see this field. If a bot fills it,
        // accept-and-drop silently — same response shape as a legitimate submit
        // so the bot can't distinguish success from rejection.
        if (body.website() != null && !body.website().trim().isEmpty()) {
            return apiResponseFactory.data(Map.of("success", true), request);
        }
        validatePhotos(body.photos());
        publicReviewService.submitReview(
                productId, body.authorName(), body.authorEmail(), body.rating(), body.comment(), body.photos(),
                optionalCustomerId());
        return apiResponseFactory.data(Map.of("success", true), request);
    }

    @PostMapping("/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Map<String, Object>> uploadPhoto(
            @PathVariable @Size(max = 64) String productId,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request
    ) {
        String url = publicReviewService.uploadReviewPhoto(productId, file);
        return apiResponseFactory.data(Map.of("url", url), request);
    }

    /** Photos must be internal MinIO URLs (/media/...) and capped at 10 \u2014 external/hotlink rejected. */
    private void validatePhotos(List<String> photos) {
        if (photos == null || photos.isEmpty()) {
            return;
        }
        if (photos.size() > MAX_PHOTOS) {
            throw ValidationException.fromField(
                    "photos",
                    "TOO_MANY",
                    "Ch\u1ec9 \u0111\u01b0\u1ee3c \u0111\u00ednh k\u00e8m t\u1ed1i \u0111a 10 \u1ea3nh.");
        }
        for (String url : photos) {
            if (url != null && !url.isBlank()) {
                // Reuse the media-URL whitelist (same gate as category menuIcon) \u2014 throws on external URLs.
                safeMediaAssetUrlPolicy.validateImageUrlOrThrow(url, "photos");
            }
        }
    }

    /**
     * Non-throwing read of the current customer's id, if any. Unlike {@code CustomerController}'s
     * {@code requireCustomer()}, this endpoint stays permitAll \u2014 a logged-in customer is a bonus
     * (lets the review link to their account so its avatar can be resolved later), not a requirement.
     * {@code CustomerSessionFilter} already populates the SecurityContext from the bb_session cookie
     * on this path even though it's public.
     */
    private UUID optionalCustomerId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof CustomerPrincipal principal
                ? principal.customerId()
                : null;
    }
}
