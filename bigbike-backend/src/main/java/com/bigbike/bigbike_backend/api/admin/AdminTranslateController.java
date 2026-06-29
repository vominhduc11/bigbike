package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.TranslateRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.integration.GeminiTranslationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Server-side VI→EN auto-translation proxy. The admin used to call Gemini directly with a
 * key baked into the browser bundle (exposed to anyone). Now the admin posts the fields it
 * wants translated here, and the backend forwards them to Gemini using a SERVER-SIDE key.
 *
 * <p>Used by every bilingual editor (products, categories, brands, articles), so it accepts
 * any content-write permission. A blank/failed translation returns an empty map — the admin
 * then keeps the existing English rather than wiping it.
 */
@Validated
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminTranslateController extends AdminControllerSupport {

    /** Any of these write permissions may use the shared translation utility. */
    private static final List<String> TRANSLATE_PERMISSIONS =
            List.of("products.update", "catalog.update", "content.update");

    private final GeminiTranslationService geminiTranslationService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping("/translate")
    public ApiDataResponse<Map<String, String>> translate(
            @Valid @RequestBody TranslateRequest payload,
            HttpServletRequest request) {
        requireAnyContentWrite(request);
        Map<String, String> result = geminiTranslationService.translate(payload.getTexts());
        return apiResponseFactory.data(result, request);
    }

    /** Passes when the caller holds at least one content-write permission; else 403. */
    private void requireAnyContentWrite(HttpServletRequest request) {
        for (String permission : TRANSLATE_PERMISSIONS) {
            try {
                devAdminAuthService.requirePermission(request, permission);
                return;
            } catch (ForbiddenException ignored) {
                // try the next candidate; UnauthorizedException (no admin) propagates.
            }
        }
        throw new ForbiddenException("Permission denied.");
    }
}
