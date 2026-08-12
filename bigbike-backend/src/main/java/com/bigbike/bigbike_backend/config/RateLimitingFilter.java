package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.config.ratelimit.RateLimitDecision;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitPolicyCatalog;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitResponseWriter;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitScope;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitTier;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** First limiter pass: canonical client IP plus public opaque identifiers, before auth work. */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    private final ClientIpResolver clientIpResolver;
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

        if (!consumeOrRespond(request, response, tier, RateLimitScope.IP, clientIpResolver.resolve(request))) {
            return;
        }
        if (tier == RateLimitTier.INTERNAL) {
            if (!consumeOrRespond(request, response, tier, RateLimitScope.INTERNAL_TOKEN,
                    request.getHeader("X-Internal-Token"))) {
                return;
            }
        }
        if (tier == RateLimitTier.ORDER_LOOKUP) {
            String lookup = request.getParameter("orderNumber") + "\n" + request.getParameter("orderKey");
            if (!consumeOrRespond(request, response, tier, RateLimitScope.IDENTITY, lookup)) {
                return;
            }
        }
        if (tier == RateLimitTier.OAUTH) {
            String state = request.getParameter("state");
            if (state != null && !state.isBlank()
                    && !consumeOrRespond(request, response, tier, RateLimitScope.IDENTITY, state)) {
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
