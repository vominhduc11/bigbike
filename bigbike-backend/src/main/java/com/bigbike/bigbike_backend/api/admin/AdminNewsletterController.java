package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.newsletter.AdminNewsletterSubscriberItem;
import com.bigbike.bigbike_backend.service.NewsletterService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/admin/newsletter-subscribers")
@RequiredArgsConstructor
public class AdminNewsletterController {

    private final NewsletterService newsletterService;
    private final DevAdminAuthService devAdminAuthService;

    @GetMapping
    public PageResult<AdminNewsletterSubscriberItem> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "newsletter.read");
        return newsletterService.listSubscribers(page, size);
    }
}
