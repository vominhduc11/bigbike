package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactPageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.contact.SaveContactPageRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.content.ContactPageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Contact page builder (admin). Gated by {@code content.update} like the other CMS-page editors;
 * the service whitelists which {@code contact} settings the editor may write through, so no
 * {@code settings.write} is needed.
 */
@Validated
@RestController
@RequestMapping("/api/v1/admin/contact-page")
@RequiredArgsConstructor
public class AdminContactPageController extends AdminControllerSupport {

    private final ContactPageService contactPageService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<AdminContactPageResponse> getLayout(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "content.read");
        return apiResponseFactory.data(contactPageService.getForAdmin(), request);
    }

    @PutMapping
    public ApiDataResponse<AdminContactPageResponse> saveLayout(
            @Valid @RequestBody SaveContactPageRequest body,
            HttpServletRequest request
    ) {
        var profile = devAdminAuthService.requirePermission(request, "content.update");
        boolean superAdmin = profile.permissions().contains("*");
        return apiResponseFactory.data(
                contactPageService.save(body, resolveAdminId(), superAdmin), request);
    }
}
