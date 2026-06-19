package com.bigbike.bigbike_backend.api.admin.dto.guide;

import com.bigbike.bigbike_backend.domain.content.GuideEntry;
import java.util.List;

/**
 * Admin read of the guide page builder: the hero (bilingual title + image) plus the full card list
 * (incl. disabled cards) so the screen can edit everything.
 *
 * @param heroTitleVi  Vietnamese hero title
 * @param heroTitleEn  English hero title (falls back to VI on the storefront)
 * @param heroImageUrl hero banner image URL (media library / MinIO)
 * @param entries      ordered guide cards (all, regardless of enabled)
 */
public record AdminGuidePageResponse(
        String heroTitleVi,
        String heroTitleEn,
        String heroImageUrl,
        List<GuideEntry> entries
) {}
