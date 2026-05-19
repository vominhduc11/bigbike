package com.bigbike.bigbike_backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.expression.WebExpressionAuthorizationManager;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CustomerSessionFilter customerSessionFilter;
    private final CustomerCsrfFilter customerCsrfFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final SecurityHeadersFilter securityHeadersFilter;
    private final PublicCacheHeaderFilter publicCacheHeaderFilter;
    private final RestAuthenticationEntryPoint authEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Admin auth endpoints
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").permitAll()
                        // Customer auth endpoints
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/auth/password/forgot").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/auth/password/reset").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/customer/auth/verify-email").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/auth/verify-email").permitAll()
                        // Social login (OAuth2) — GET browser redirects, no existing session required
                        .requestMatchers(HttpMethod.GET, "/api/v1/customer/auth/oauth/**").permitAll()
                        // Public catalog and content reads
                        .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                        // Public review submission — no auth required, status defaults to PENDING
                        .requestMatchers(HttpMethod.POST, "/api/v1/products/*/reviews").permitAll()
                        // Catalog filter facets — public, powers the storefront filter sidebar
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/brands/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/articles/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/content-categories").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/pages/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/sliders").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/home-videos").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/search").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/search-suggest").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/address/**").permitAll()
                        // Cart endpoints: guest + customer access, CSRF enforced on mutations by filter
                        .requestMatchers("/api/v1/cart/**").permitAll()
                        .requestMatchers("/api/v1/cart").permitAll()
                        // Checkout + quick-buy: guest + customer, CSRF enforced on mutations by filter
                        .requestMatchers(HttpMethod.POST, "/api/v1/checkout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/orders/quick-buy").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/checkout/options").permitAll()
                        // Order lookup: public GET, no CSRF needed (safe method)
                        .requestMatchers(HttpMethod.GET, "/api/v1/orders/lookup").permitAll()
                        // Warranty lookup by serial number: public, no PII returned
                        .requestMatchers(HttpMethod.GET, "/api/v1/warranties/lookup").permitAll()
                        // OpenAPI docs: disabled in prod via springdoc.api-docs.enabled=false
                        .requestMatchers(HttpMethod.GET, "/v3/api-docs/**").permitAll()
                        .requestMatchers("/swagger-ui/**").permitAll()
                        // Public settings and menus
                        .requestMatchers(HttpMethod.GET, "/api/v1/settings/public").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/menus/**").permitAll()
                        // Internal redirect endpoints consumed by bigbike-web middleware.
                        // No PII; lock down at infra layer (private network / IP allowlist) for prod.
                        .requestMatchers(HttpMethod.GET, "/api/internal/redirect").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/internal/redirects/active").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/internal/redirects/hit/**").permitAll()
                        // WebSocket endpoint — auth is validated in STOMP CONNECT interceptor
                        .requestMatchers("/ws/**").permitAll()
                        // All admin endpoints: must be authenticated AND not a customer
                        // (defense in depth — keeps a logged-in customer out at the URL
                        // layer, while still allowing any admin role incl. custom roles).
                        // Fine-grained permission enforcement is still done by controller-level
                        // requirePermission() backed by AdminPermissionService (DB-driven).
                        .requestMatchers("/api/v1/admin/**").access(
                                new WebExpressionAuthorizationManager(
                                        "isAuthenticated() and !hasRole('CUSTOMER')"))
                        // Customer order read requires ROLE_CUSTOMER
                        .requestMatchers("/api/v1/customer/orders/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/v1/customer/orders").hasRole("CUSTOMER")
                        // Customer profile and addresses require ROLE_CUSTOMER
                        .requestMatchers("/api/v1/customer/me").hasRole("CUSTOMER")
                        .requestMatchers("/api/v1/customer/addresses/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/v1/customer/addresses").hasRole("CUSTOMER")
                        // Customer wishlist requires ROLE_CUSTOMER
                        .requestMatchers("/api/v1/customer/wishlist/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/v1/customer/wishlist").hasRole("CUSTOMER")
                        // Actuator health: public for Docker/k8s health checks
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        // Admin /auth/me requires any authenticated user
                        .requestMatchers("/api/v1/auth/me").authenticated()
                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                // Rate limiting runs first — rejects abusive requests before any auth work
                .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
                // Security response headers applied to every request
                .addFilterBefore(securityHeadersFilter, RateLimitingFilter.class)
                // JWT filter runs first: sets AdminPrincipal from Bearer token when present
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // Customer session runs after JWT — skipped when JWT already set the principal
                .addFilterAfter(customerSessionFilter, JwtAuthFilter.class)
                // CSRF validation runs after session is resolved
                .addFilterAfter(customerCsrfFilter, CustomerSessionFilter.class)
                // Public catalog/content GETs: relax Cache-Control so browsers/CDN
                // may cache briefly. Runs last — after Spring Security's default
                // header writer — so the overwrite sticks before the controller runs.
                .addFilterAfter(publicCacheHeaderFilter, CustomerCsrfFilter.class);

        return http.build();
    }
}
