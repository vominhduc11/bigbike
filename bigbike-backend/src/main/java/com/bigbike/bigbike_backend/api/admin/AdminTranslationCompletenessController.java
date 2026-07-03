package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.api.admin.dto.MissingRequiredEnglishResponse;
import com.bigbike.bigbike_backend.service.admin.TranslationCompletenessService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only helper for TRANSLATION_RULE_002: lists records still missing English content in a
 * now-required field (name/title/site_name), so admin can fix them proactively instead of
 * discovering the save-block one record at a time. Added alongside the V312 removal of Gemini
 * auto-translation.
 */
@RestController
@RequestMapping("/api/v1/admin/translations")
@RequiredArgsConstructor
public class AdminTranslationCompletenessController extends AdminControllerSupport {

    // Any content-read permission is enough — this is informational, not a write.
    private static final List<String> READ_PERMISSIONS =
            List.of("products.read", "catalog.read", "content.read", "settings.read");

    private final TranslationCompletenessService translationCompletenessService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/missing-required")
    public ApiDataResponse<MissingRequiredEnglishResponse> missingRequired(HttpServletRequest request) {
        requireAnyReadPermission(request);
        return apiResponseFactory.data(translationCompletenessService.findMissing(), request);
    }

    private void requireAnyReadPermission(HttpServletRequest request) {
        ForbiddenException lastError = null;
        for (String permission : READ_PERMISSIONS) {
            try {
                devAdminAuthService.requirePermission(request, permission);
                return;
            } catch (ForbiddenException e) {
                lastError = e;
            }
        }
        throw lastError;
    }
}
