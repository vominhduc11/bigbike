package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.TranslationBackfillResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.TranslationBackfillService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * One-time operational tool: VI→EN backfill of the English ({@code *_en}) columns for every
 * product / category / brand / article still missing them (Phase 2 of bilingual rollout).
 * Reuses {@link TranslationBackfillService} (which reuses {@code GeminiTranslationService}).
 *
 * <p><b>SUPER_ADMIN only</b> — gated on the wildcard {@code *} permission. Always run
 * {@code dryRun=true} first to review counts + sample translations, then {@code dryRun=false}
 * in batches of {@code limit} (resumable: re-running skips records that already have English).
 *
 * <p>See {@code API_CONTRACT.md} §"VI→EN backfill" and {@code BUSINESS_RULES.md} TRANSLATION_RULE_001.
 */
@RestController
@RequestMapping("/api/v1/admin/translate")
@RequiredArgsConstructor
public class TranslationBackfillController extends AdminControllerSupport {

    private final TranslationBackfillService backfillService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    /**
     * @param type          {@code product|category|brand|article|all} (default {@code all})
     * @param dryRun        when true (default) translates a small sample but writes NOTHING
     * @param limit         max records to process this call when {@code dryRun=false} (default 20)
     * @param sampleSize    max sample translations to return when {@code dryRun=true} (default 3)
     * @param includeTrashed include {@code publish_status=TRASH} products (default false)
     */
    @PostMapping("/backfill")
    public ApiDataResponse<TranslationBackfillResponse> backfill(
            @RequestParam(defaultValue = "all") String type,
            @RequestParam(defaultValue = "true") boolean dryRun,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "3") int sampleSize,
            @RequestParam(defaultValue = "false") boolean includeTrashed,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "*"); // SUPER_ADMIN (wildcard) only
        TranslationBackfillResponse result =
                backfillService.run(type, dryRun, limit, sampleSize, includeTrashed);
        return apiResponseFactory.data(result, request);
    }
}
