package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.auth.AdminAccountStatusService;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final JwtService jwtService;
    private final AdminAccountStatusService adminAccountStatusService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Claims claims = jwtService.parseAccessToken(token);
                String userId = claims.getSubject();
                String email = claims.get("email", String.class);
                String role = claims.get("role", String.class);

                if (userId != null && role != null && !role.isBlank()
                        && SecurityContextHolder.getContext().getAuthentication() == null) {
                    // Re-check the admin's CURRENT status/role against the DB (cached) on every
                    // request, instead of trusting the JWT claims blindly — so locking, suspending,
                    // or demoting an admin takes effect on their very next request rather than
                    // waiting up to the access-token TTL to expire. Mirrors CustomerSessionFilter's
                    // per-request DB recheck for customers.
                    AdminAccountStatusService.Snapshot snapshot = tryParseUUID(userId)
                            .map(adminAccountStatusService::getSnapshot)
                            .orElse(null);
                    if (snapshot != null && STATUS_ACTIVE.equals(snapshot.status())) {
                        String currentRole = snapshot.role();
                        AdminPrincipal principal = new AdminPrincipal(userId, email, currentRole);
                        List<SimpleGrantedAuthority> authorities = "SUPER_ADMIN".equals(currentRole)
                                ? List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"), new SimpleGrantedAuthority("ROLE_ADMIN"))
                                : List.of(new SimpleGrantedAuthority("ROLE_" + currentRole));
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                principal, null, authorities
                        );
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                    // else: locked/suspended/deleted admin — SecurityContext stays empty, security
                    // rules handle the 401, same as an invalid/expired token below.
                }
            } catch (JwtException ignored) {
                // Invalid/expired token — SecurityContext stays empty; security rules handle the 401.
            }
        }
        filterChain.doFilter(request, response);
    }

    private static Optional<UUID> tryParseUUID(String id) {
        try {
            return Optional.of(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
