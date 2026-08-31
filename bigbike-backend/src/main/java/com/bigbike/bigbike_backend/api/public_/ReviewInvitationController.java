package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.ReviewInvitationUnsubscribeRequest;
import com.bigbike.bigbike_backend.service.review.invitation.ReviewInvitationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/review-invitations")
@RequiredArgsConstructor
public class ReviewInvitationController {

    private final ReviewInvitationService reviewInvitationService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping("/unsubscribe")
    public ApiDataResponse<Map<String, Boolean>> unsubscribe(
            @Valid @RequestBody ReviewInvitationUnsubscribeRequest body,
            HttpServletRequest request) {
        reviewInvitationService.unsubscribe(body.token());
        return apiResponseFactory.data(Map.of("unsubscribed", true), request);
    }
}
