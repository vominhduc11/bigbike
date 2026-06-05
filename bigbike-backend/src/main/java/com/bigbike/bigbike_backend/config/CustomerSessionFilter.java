package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerSessionEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.customer.CustomerSessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class CustomerSessionFilter extends OncePerRequestFilter {

    public static final String SESSION_COOKIE = "bb_session";

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final CustomerSessionService sessionService;
    private final CustomerJpaRepository customerRepo;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        // Skip customer session resolution for admin API paths. An expired admin JWT on an
        // admin request should produce 401 (unauthenticated), not 403 (forbidden as customer).
        // Without this guard the customer cookie would be picked up whenever the admin JWT
        // expires and the browser also holds a storefront session — making the retry loop
        // see 403 instead of 401 and never refreshing the admin token.
        String rawToken = extractCookie(request, SESSION_COOKIE);
        if (rawToken != null && SecurityContextHolder.getContext().getAuthentication() == null
                && !request.getRequestURI().startsWith("/api/v1/admin/")
                && !request.getRequestURI().startsWith("/api/v1/auth/")) {
            Optional<CustomerSessionEntity> sessionOpt = sessionService.findBySessionToken(rawToken);
            if (sessionOpt.isPresent()) {
                CustomerSessionEntity session = sessionOpt.get();
                // Verify the customer account is still active before granting authentication.
                // This catches the case where a session was not yet revoked when the account was disabled.
                Optional<CustomerEntity> customerOpt = customerRepo.findById(session.getCustomerId());
                if (customerOpt.isPresent() && STATUS_ACTIVE.equals(customerOpt.get().getStatus())) {
                    CustomerPrincipal principal = new CustomerPrincipal(
                            session.getCustomerId(), null, null, session.getId());
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                            principal, null,
                            List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    public static String extractCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        return Arrays.stream(cookies)
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
