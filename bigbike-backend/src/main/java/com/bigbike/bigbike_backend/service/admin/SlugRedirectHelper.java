package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import java.time.Instant;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class SlugRedirectHelper {

    private final RedirectJpaRepository redirectRepo;

    public SlugRedirectHelper(ObjectProvider<RedirectJpaRepository> redirectRepoProvider) {
        this.redirectRepo = redirectRepoProvider.getIfAvailable();
    }

    /**
     * 301-redirect bookkeeping when the optional English slug changes
     * (PRODUCT/CATEGORY/BRAND_RULE_003). {@code pathPrefix} is e.g. {@code "/product/"}.
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

    public void autoCreateSlugRedirect(String source, String target) {
        if (redirectRepo == null) return;
        RedirectEntity redirect = redirectRepo.findBySourcePattern(source)
                .orElseGet(RedirectEntity::new);
        redirect.setSourcePattern(source);
        redirect.setTargetUrl(target);
        redirect.setRedirectType("PERMANENT");
        redirect.setStatusCode(301);
        redirect.setEnabled(true);
        redirect.setUpdatedAt(Instant.now());
        if (redirect.getId() == null) {
            redirect.setCreatedAt(Instant.now());
        }
        redirectRepo.save(redirect);
    }
}
