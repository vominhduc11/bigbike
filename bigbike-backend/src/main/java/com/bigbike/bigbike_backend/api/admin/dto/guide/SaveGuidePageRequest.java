package com.bigbike.bigbike_backend.api.admin.dto.guide;

import com.bigbike.bigbike_backend.domain.content.GuideEntry;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Payload for {@code PUT /api/v1/admin/guide-page}. The builder sends the hero plus the full card
 * list (whole array replaces the previous one). Detail bodies are not part of this payload — they
 * stay in the CMS {@code pages} referenced by each entry's {@code pageSlug}.
 *
 * @param heroTitleVi  Vietnamese hero title
 * @param heroTitleEn  English hero title (optional)
 * @param heroImageUrl hero banner image URL (media library / MinIO)
 * @param entries      ordered guide cards (max 40)
 */
public record SaveGuidePageRequest(
        @Size(max = 200, message = "heroTitleVi must not exceed 200 characters.")
        String heroTitleVi,

        @Size(max = 200, message = "heroTitleEn must not exceed 200 characters.")
        String heroTitleEn,

        @Size(max = 500, message = "heroImageUrl must not exceed 500 characters.")
        String heroImageUrl,

        @NotNull(message = "entries is required.")
        @Size(max = 40, message = "A guide page can have at most 40 cards.")
        List<@Valid GuideEntry> entries
) {}
