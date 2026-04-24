package com.bigbike.bigbike_backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CustomerSessionFilter customerSessionFilter;
    private final CustomerCsrfFilter customerCsrfFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final SecurityHeadersFilter securityHeadersFilter;
    private final RestAuthenticationEntryPoint authEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            CustomerSessionFilter customerSessionFilter,
            CustomerCsrfFilter customerCsrfFilter,
            RateLimitingFilter rateLimitingFilter,
            SecurityHeadersFilter securityHeadersFilter,
            RestAuthenticationEntryPoint authEntryPoint,
            RestAccessDeniedHandler accessDeniedHandler
    ) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.customerSessionFilter = customerSessionFilter;
        this.customerCsrfFilter = customerCsrfFilter;
        this.rateLimitingFilter = rateLimitingFilter;
        this.securityHeadersFilter = securityHeadersFilter;
        this.authEntryPoint = authEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
    }

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
                        // Public catalog and content reads
                        .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/brands/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/articles/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/pages/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/search").permitAll()
                        // Cart endpoints: guest + customer access, CSRF enforced on mutations by filter
                        .requestMatchers("/api/v1/cart/**").permitAll()
                        .requestMatchers("/api/v1/cart").permitAll()
                        // Checkout + quick-buy: guest + customer, CSRF enforced on mutations by filter
                        .requestMatchers(HttpMethod.POST, "/api/v1/checkout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/orders/quick-buy").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/checkout/options").permitAll()
                        // Order lookup: public GET, no CSRF needed (safe method)
                        .requestMatchers(HttpMethod.GET, "/api/v1/orders/lookup").permitAll()
                        // OpenAPI docs
                        .requestMatchers(HttpMethod.GET, "/v3/api-docs").permitAll()
                        .requestMatchers("/swagger-ui/**").permitAll()
                        // Public settings and menus
                        .requestMatchers(HttpMethod.GET, "/api/v1/settings/public").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/menus/**").permitAll()
                        // Internal redirect lookup consumed by bigbike-web proxy/middleware.
                        // No PII; lock down at infra layer (private network / IP allowlist) for prod.
                        .requestMatchers(HttpMethod.GET, "/api/internal/redirect").permitAll()
                        // Admin endpoints require ROLE_ADMIN
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        // Customer order read requires ROLE_CUSTOMER
                        .requestMatchers("/api/v1/customer/orders/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/v1/customer/orders").hasRole("CUSTOMER")
                        // Customer profile requires ROLE_CUSTOMER
                        .requestMatchers("/api/v1/customer/me").hasRole("CUSTOMER")
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
                // Register JWT filter first so it can serve as anchor for customer filters
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // Customer session resolves cookie auth before JWT Bearer auth
                .addFilterBefore(customerSessionFilter, JwtAuthFilter.class)
                // CSRF validation runs after session is resolved
                .addFilterAfter(customerCsrfFilter, CustomerSessionFilter.class);

        return http.build();
    }
}
