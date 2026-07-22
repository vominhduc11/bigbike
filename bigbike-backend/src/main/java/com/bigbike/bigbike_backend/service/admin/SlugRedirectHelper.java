package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class SlugRedirectHelper {

    private final RedirectJpaRepository redirectRepo;
    private final WebRevalidationService webRevalidationService;

    public SlugRedirectHelper(
            ObjectProvider<RedirectJpaRepository> redirectRepoProvider,
            WebRevalidationService webRevalidationService) {
        this.redirectRepo = redirectRepoProvider.getIfAvailable();
        this.webRevalidationService = webRevalidationService;
    }

    /**
     * 301-redirect bookkeeping when the optional English slug changes
     * (PRODUCT/CATEGORY_RULE_003). {@code pathPrefix} is e.g. {@code "/product/"}.
     * Changed → old-EN → new-EN; cleared → old-EN → vi URL. No-op when there was no
     * previous English slug or it is unchanged.
     */
    public void autoCreateSlugEnRedirect(String pathPrefix, String previousSlugEn, String newSlugEn, String viSlug) {
        if (previousSlugEn == null || previousSlugEn.equals(newSlugEn)) {
            return;
        }
        String target = newSlugEn != null ? pathPrefix + newSlugEn : pathPrefix + viSlug;
        autoCreateSlugRedirect(pathPrefix + previousSlugEn, target);
    }

    /**
     * Upserts an auto redirect old-URL → new-URL after a slug change, with the same loop
     * safety the manual admin redirect flow has (AUD-008):
     * <ul>
     *   <li>self-loop guard — no redirect from a path to itself;</li>
     *   <li>any existing redirect FROM the new URL is deleted: the page is live at that
     *       path again, so redirecting away from it is wrong and would form an A→B→A loop
     *       when a slug is changed back;</li>
     *   <li>the web redirect cache is revalidated so the new rule takes effect immediately
     *       (mirrors {@code AdminRedirectService}).</li>
     * </ul>
     */
    public void autoCreateSlugRedirect(String source, String target) {
        if (redirectRepo == null) return;
        String normalizedSource = canonicalizePath(source);
        String normalizedTarget = canonicalizePath(target);
        if (normalizedSource.isEmpty() || normalizedSource.equals(normalizedTarget)) {
            return;
        }

        // The target path is the entity's live URL again — drop any stale redirect from it.
        redirectRepo.findBySourcePattern(normalizedTarget).ifPresent(redirectRepo::delete);

        RedirectEntity redirect = redirectRepo.findBySourcePattern(normalizedSource)
                .orElseGet(RedirectEntity::new);
        redirect.setSourcePattern(normalizedSource);
        redirect.setTargetUrl(normalizedTarget);
        redirect.setRedirectType("PERMANENT");
        redirect.setStatusCode(301);
        redirect.setEnabled(true);
        redirect.setUpdatedAt(Instant.now());
        if (redirect.getId() == null) {
            redirect.setCreatedAt(Instant.now());
        }
        redirectRepo.save(redirect);
        webRevalidationService.revalidateRedirects();
    }

    /** Same canonical form as {@code AdminRedirectService}: trim + strip one trailing slash. */
    private static String canonicalizePath(String path) {
        if (path == null) return "";
        String trimmed = path.trim();
        if (trimmed.length() > 1 && trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
