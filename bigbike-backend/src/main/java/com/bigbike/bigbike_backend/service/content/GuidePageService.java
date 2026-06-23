package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.admin.dto.guide.AdminGuidePageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.guide.SaveGuidePageRequest;
import com.bigbike.bigbike_backend.api.public_.dto.PublicGuidePageResponse;
import com.bigbike.bigbike_backend.domain.content.GuideEntry;
import com.bigbike.bigbike_backend.persistence.entity.content.GuidePageLayoutEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.GuidePageLayoutJpaRepository;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-managed layout of the public guide landing page ({@code /huong-dan}).
 *
 * <p>The hero and the card grid live in the singleton {@code guide_page_layout} row. Detail bodies
 * are <em>not</em> stored here — each card points (via {@link GuideEntry#pageSlug()}) at a CMS page
 * whose body/SEO/EN content is managed in the existing Content → Pages module. Save replaces the
 * whole card array.
 */
@Service
@RequiredArgsConstructor
public class GuidePageService {

    private final GuidePageLayoutJpaRepository layoutRepo;
    private final WebRevalidationService webRevalidationService;

    // ── Admin read ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminGuidePageResponse getForAdmin() {
        GuidePageLayoutEntity entity = layoutRepo.findById(GuidePageLayoutEntity.SINGLETON_ID).orElse(null);
        if (entity == null) {
            return new AdminGuidePageResponse(null, null, null, List.of());
        }
        return new AdminGuidePageResponse(
                entity.getHeroTitleVi(),
                entity.getHeroTitleEn(),
                entity.getHeroImageUrl(),
                sortedEntries(entity.getEntries()));
    }

    // ── Public read ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PublicGuidePageResponse getPublic(String lang) {
        boolean en = "en".equalsIgnoreCase(lang);
        GuidePageLayoutEntity entity = layoutRepo.findById(GuidePageLayoutEntity.SINGLETON_ID).orElse(null);
        if (entity == null) {
            return new PublicGuidePageResponse(null, null, List.of());
        }
        List<PublicGuidePageResponse.Entry> entries = sortedEntries(entity.getEntries()).stream()
                .filter(GuideEntry::enabled)
                .map(e -> new PublicGuidePageResponse.Entry(
                        e.pathSegment(),
                        e.pageSlug(),
                        e.icon(),
                        pick(e.titleVi(), e.titleEn(), en),
                        pick(e.descriptionVi(), e.descriptionEn(), en),
                        e.sortOrder() == null ? 0 : e.sortOrder()))
                .toList();
        return new PublicGuidePageResponse(
                pick(entity.getHeroTitleVi(), entity.getHeroTitleEn(), en),
                entity.getHeroImageUrl(),
                entries);
    }

    // ── Save ────────────────────────────────────────────────────────────────────

    @Transactional
    public AdminGuidePageResponse save(SaveGuidePageRequest req) {
        GuidePageLayoutEntity entity = layoutRepo.findById(GuidePageLayoutEntity.SINGLETON_ID)
                .orElseGet(() -> {
                    GuidePageLayoutEntity fresh = new GuidePageLayoutEntity();
                    fresh.setId(GuidePageLayoutEntity.SINGLETON_ID);
                    return fresh;
                });
        entity.setHeroTitleVi(req.heroTitleVi());
        entity.setHeroTitleEn(req.heroTitleEn());
        entity.setHeroImageUrl(req.heroImageUrl());
        entity.setEntries(req.entries());
        entity.setUpdatedAt(Instant.now());
        layoutRepo.save(entity);

        // Refresh the storefront guide landing + its sub-pages after commit.
        webRevalidationService.revalidate("page:huong-dan");

        return getForAdmin();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private static List<GuideEntry> sortedEntries(List<GuideEntry> entries) {
        if (entries == null) return List.of();
        return entries.stream()
                .sorted(Comparator.comparingInt(e -> e.sortOrder() == null ? 0 : e.sortOrder()))
                .toList();
    }

    /** EN-with-Vietnamese-fallback, matching the storefront language rule used across settings/pages. */
    private static String pick(String vi, String en, boolean english) {
        return english && en != null && !en.isBlank() ? en : vi;
    }
}
