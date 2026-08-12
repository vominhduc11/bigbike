package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.config.ratelimit.RateLimitDecision;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitPolicyCatalog;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitResponseWriter;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitScope;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitTier;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Second limiter pass: customer session/guest session or admin account after authentication. */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuthenticatedRateLimitingFilter extends OncePerRequestFilter {

    private final RateLimitPolicyCatalog policyCatalog;
    private final RateLimitService rateLimitService;
    private final RateLimitResponseWriter responseWriter;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {
        RateLimitTier tier = policyCatalog.resolve(request).orElse(null);
        if (tier == null) {
            chain.doFilter(request, response);
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication == null ? null : authentication.getPrincipal();
        if (principal instanceof CustomerPrincipal customer && policyCatalog.acceptsCustomerIdentity(tier)) {
            if (!consumeOrRespond(request, response, tier, RateLimitScope.CUSTOMER_SESSION,
                    customer.sessionId().toString())) {
                return;
            }
        } else if (principal instanceof AdminPrincipal admin && policyCatalog.acceptsAdminIdentity(tier)) {
            if (!consumeOrRespond(request, response, tier, RateLimitScope.ADMIN_ACCOUNT, admin.id())) {
                return;
            }
        } else if (policyCatalog.acceptsCustomerIdentity(tier)) {
            String guestId = CustomerSessionFilter.extractCookie(request, CustomerAuthCookies.COOKIE_GUEST_ID);
            String refreshToken = CustomerSessionFilter.extractCookie(request, CustomerAuthCookies.COOKIE_REFRESH);
            String subject = guestId != null ? guestId : refreshToken;
            if (subject != null && !subject.isBlank()
                    && !consumeOrRespond(request, response, tier, RateLimitScope.CUSTOMER_SESSION, subject)) {
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private boolean consumeOrRespond(
            HttpServletRequest request,
            HttpServletResponse response,
            RateLimitTier tier,
            RateLimitScope scope,
            String subject
    ) throws IOException {
        RateLimitDecision decision = rateLimitService.check(tier, scope, subject);
        if (decision.allowed()) {
            return true;
        }
        log.warn("Rate limit rejected route={} tier={} scope={} store={}",
                policyCatalog.routeGroup(tier), tier.key(), scope.key(), decision.storeMode());
        responseWriter.write(request, response, decision);
        return false;
    }
}
