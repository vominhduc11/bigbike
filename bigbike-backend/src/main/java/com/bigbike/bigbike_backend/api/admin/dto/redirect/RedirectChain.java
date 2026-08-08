package com.bigbike.bigbike_backend.api.admin.dto.redirect;

/**
 * Result of walking a redirect chain forward from a target URL.
 *
 * <p>Serves two roles: the computed {@code chainHops}/{@code finalTarget} pair carried on
 * {@link AdminRedirectResponse}, and the body of {@code GET /admin/redirects/resolve} which the
 * admin form calls to warn before saving a rule that points at another rule's source.
 *
 * @param hops        number of redirect steps a visitor actually takes: {@code 1} = straight to
 *                    the destination, {@code >= 2} = the destination redirects onward again
 * @param finalTarget canonical destination after following the whole chain
 */
public record RedirectChain(
        int hops,
        String finalTarget
) {}
