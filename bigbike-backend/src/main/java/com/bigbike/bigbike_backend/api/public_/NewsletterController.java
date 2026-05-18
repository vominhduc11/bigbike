package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.NewsletterSubscribeRequest;
import com.bigbike.bigbike_backend.service.NewsletterService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/newsletter")
@RequiredArgsConstructor
public class NewsletterController {

    private final NewsletterService newsletterService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Void> subscribe(
            @Valid @RequestBody NewsletterSubscribeRequest req,
            HttpServletRequest request) {
        newsletterService.subscribe(req.email());
        return apiResponseFactory.data(null, request);
    }
}
