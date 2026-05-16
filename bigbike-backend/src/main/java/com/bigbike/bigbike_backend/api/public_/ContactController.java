package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.ContactRequest;
import com.bigbike.bigbike_backend.service.ContactService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/contact")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Void> submit(@RequestBody ContactRequest req, HttpServletRequest request) {
        contactService.submit(req, request);
        return apiResponseFactory.data(null, request);
    }
}
