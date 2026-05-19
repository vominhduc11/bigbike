package com.bigbike.bigbike_backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Relaxes the {@code Cache-Control} header for fully public, non-personalised
 * catalog/content GET endpoints so browsers and a CDN may cache them briefly.
 *
 * <p>Spring Security applies {@code Cache-Control: no-cache, no-store, ...} to
 * every response by default. That is the right default for authenticated and
 * user-specific responses, but it also blocks any caching of the public
 * storefront catalog — which is identical for every visitor and changes only
 * when an admin edits it.
 *
 * <p>This filter overwrites the header to {@code public, max-age=...} <em>only</em>
 * for GET requests whose path is on an explicit allowlist of public read
 * endpoints. The allowlist is intentionally conservative: cart, checkout,
 * customer, order, admin and any other cookie/auth-bearing route is never
 * matched, so no personalised response can leak into a shared cache.
 *
 * <p>It runs inside the Spring Security filter chain after the default header
 * writer, so the overwrite takes effect before the controller commits the
 * response. {@code admin}/{@code internal} segments are excluded defensively in
 * case a future endpoint is added under an otherwise-public prefix.
 */
@Component
public class PublicCacheHeaderFilter extends OncePerRequestFilter {

    /** Browser/CDN max-age for public catalog reads. Short — admin edits should surface quickly. */
    private static final String PUBLIC_CACHE_VALUE = "public, max-age=60";

    /**
     * Exact paths and path prefixes that serve only public, non-personalised data.
     * Mirrors the {@code permitAll()} GET entries in {@link SecurityConfig} that
     * return catalog/content — deliberately excluding cart and settings beyond
     * {@code /settings/public}.
     */
    private static final String[] PUBLIC_PREFIXES = {
            "/api/v1/products/",
            "/api/v1/categories/",
            "/api/v1/brands/",
            "/api/v1/catalog/",
            "/api/v1/articles/",
            "/api/v1/pages/",
            "/api/v1/menus/",
    };

    private static final String[] PUBLIC_EXACT = {
            "/api/v1/products",
            "/api/v1/categories",
            "/api/v1/brands",
            "/api/v1/articles",
            "/api/v1/pages",
            "/api/v1/sliders",
            "/api/v1/home-videos",
            "/api/v1/content-categories",
            "/api/v1/settings/public",
    };

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {
        if (isCacheablePublicGet(request)) {
            // Overwrite Spring Security's default no-store before the controller runs.
            // Only Cache-Control is changed: HTTP/1.1+ browsers and CDNs honour it
            // over the paired Pragma/Expires that Security also sets, and those two
            // cannot be cleanly removed from a servlet response. The stray
            // Pragma: no-cache is inert on every cache that matters today.
            response.setHeader("Cache-Control", PUBLIC_CACHE_VALUE);
        }
        chain.doFilter(request, response);
    }

    private static boolean isCacheablePublicGet(HttpServletRequest request) {
        if (!HttpMethod.GET.matches(request.getMethod())) {
            return false;
        }
        String path = request.getRequestURI();
        if (path == null) {
            return false;
        }
        // Defensive: never relax caching for admin/internal even if nested under a public prefix.
        if (path.contains("/admin/") || path.contains("/internal/")) {
            return false;
        }
        for (String exact : PUBLIC_EXACT) {
            if (path.equals(exact)) {
                return true;
            }
        }
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
