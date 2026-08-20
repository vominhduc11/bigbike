package com.bigbike.bigbike_backend.config.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class RateLimitPolicyCatalogTest {

    private final RateLimitPolicyCatalog catalog = new RateLimitPolicyCatalog();

    @Test
    void coversNewSideEffectingAndExpensiveSurfaces() {
        assertTier("POST", "/api/v1/chat/leads", RateLimitTier.CHAT);
        assertTier("POST", "/api/v1/chat/leads/decline", RateLimitTier.CHAT);
        assertTier("POST", "/api/v1/customer/me/avatar", RateLimitTier.CUSTOMER_MEDIA);
        assertTier("POST", "/api/v1/admin/media", RateLimitTier.ADMIN_MEDIA);
        assertTier("POST", "/api/v1/admin/products/import/validate", RateLimitTier.ADMIN_IMPORT_VALIDATE);
        assertTier("POST", "/api/v1/admin/products/import/commit", RateLimitTier.ADMIN_IMPORT_COMMIT);
        assertTier("GET", "/api/v1/admin/reports/orders/export", RateLimitTier.ADMIN_EXPORT);
        assertTier("GET", "/api/v1/auth/admin/invite", RateLimitTier.PASSWORD_RESET);
        assertTier("POST", "/api/internal/redirects/hit/abc", RateLimitTier.INTERNAL);
        assertTier("GET", "/ws", RateLimitTier.WEBSOCKET_HANDSHAKE);
    }

    @Test
    void trailingAndEncodedSeparatorsCannotSkipSensitivePolicy() {
        assertTier("POST", "/api/v1/customer/auth/login/", RateLimitTier.LOGIN);
        assertTier("POST", "/api/v1/chat%2Fleads", RateLimitTier.CHAT);
        assertTier("POST", "/api/v1/products/p/reviews/photos/", RateLimitTier.REVIEW_PHOTO);
    }

    @Test
    void methodAndNearPathDoNotOverMatch() {
        assertThat(catalog.resolve("GET", "/api/v1/chat/leads")).isEmpty();
        assertThat(catalog.resolve("POST", "/api/v1/cartoon/items")).isEmpty();
        assertThat(catalog.resolve("POST", "/api/v1/admin/media/abc/replace").orElse(null))
                .isNotEqualTo(RateLimitTier.ADMIN_MEDIA);
    }

    @Test
    void catalogTextSearchUsesSearchTierButOrdinaryCatalogReadRemainsNginxOnly() {
        MockHttpServletRequest search = new MockHttpServletRequest("GET", "/api/v1/products");
        search.setParameter("q", "mũ bảo hiểm");
        assertThat(catalog.resolve(search)).contains(RateLimitTier.SEARCH);

        MockHttpServletRequest browse = new MockHttpServletRequest("GET", "/api/v1/products");
        assertThat(catalog.resolve(browse)).isEmpty();
    }

    private void assertTier(String method, String path, RateLimitTier expected) {
        assertThat(catalog.resolve(method, path)).contains(expected);
    }
}
