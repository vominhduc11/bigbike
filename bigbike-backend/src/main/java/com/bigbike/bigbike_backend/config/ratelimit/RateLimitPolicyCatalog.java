package com.bigbike.bigbike_backend.config.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

/** Maps every side-effecting or abuse-prone application route to exactly one rate-limit tier. */
@Component
public class RateLimitPolicyCatalog {

    private static final Set<String> WRITE_METHODS = Set.of(
            HttpMethod.POST.name(), HttpMethod.PUT.name(), HttpMethod.PATCH.name(), HttpMethod.DELETE.name());

    public Optional<RateLimitTier> resolve(HttpServletRequest request) {
        if (isCatalogSearch(request)) {
            return Optional.of(RateLimitTier.SEARCH);
        }
        return resolve(request.getMethod(), request.getRequestURI());
    }

    public Optional<RateLimitTier> resolve(String rawMethod, String rawPath) {
        String method = rawMethod == null ? "" : rawMethod.toUpperCase(Locale.ROOT);
        String path = normalizePath(rawPath);

        if (path.startsWith("/api/internal/")) {
            return Optional.of(RateLimitTier.INTERNAL);
        }
        if (HttpMethod.GET.name().equals(method) && "/ws".equals(path)) {
            return Optional.of(RateLimitTier.WEBSOCKET_HANDSHAKE);
        }

        if (HttpMethod.POST.name().equals(method)) {
            if ("/api/v1/auth/login".equals(path) || "/api/v1/customer/auth/login".equals(path)) {
                return Optional.of(RateLimitTier.LOGIN);
            }
            if ("/api/v1/customer/auth/register".equals(path)) {
                return Optional.of(RateLimitTier.REGISTER);
            }
            if ("/api/v1/customer/auth/password/forgot".equals(path)
                    || "/api/v1/customer/auth/password/reset".equals(path)
                    || "/api/v1/auth/admin/accept-invite".equals(path)
                    || "/api/v1/customer/auth/verify-email".equals(path)) {
                return Optional.of(RateLimitTier.PASSWORD_RESET);
            }
            if ("/api/v1/customer/auth/resend-verification".equals(path)
                    || isAdminInviteResend(path)) {
                return Optional.of(RateLimitTier.RESEND_VERIFICATION);
            }
            if ("/api/v1/auth/refresh".equals(path)
                    || "/api/v1/customer/auth/refresh".equals(path)
                    || "/api/v1/auth/logout".equals(path)
                    || "/api/v1/customer/auth/logout".equals(path)) {
                return Optional.of(RateLimitTier.REFRESH);
            }
            if ("/api/v1/checkout".equals(path)) {
                return Optional.of(RateLimitTier.CHECKOUT);
            }
            if ("/api/v1/chat/messages".equals(path)
                    || "/api/v1/chat/leads".equals(path)
                    || "/api/v1/chat/leads/decline".equals(path)) {
                return Optional.of(RateLimitTier.CHAT);
            }
            if (isProductReviewPhotoPath(path)) {
                return Optional.of(RateLimitTier.REVIEW_PHOTO);
            }
            if (isProductReviewPath(path)) {
                return Optional.of(RateLimitTier.REVIEW);
            }
        }

        if (isCustomerAvatarPath(path) && WRITE_METHODS.contains(method)) {
            return Optional.of(RateLimitTier.CUSTOMER_MEDIA);
        }
        if (isCustomerMutationPath(path) && WRITE_METHODS.contains(method)) {
            return Optional.of(RateLimitTier.CUSTOMER_MUTATION);
        }
        if (isCartMutationPath(path) && WRITE_METHODS.contains(method)) {
            return Optional.of(RateLimitTier.CUSTOMER_MUTATION);
        }

        if (HttpMethod.GET.name().equals(method)) {
            if ("/api/v1/auth/admin/invite".equals(path)) {
                return Optional.of(RateLimitTier.PASSWORD_RESET);
            }
            if ("/api/v1/orders/lookup".equals(path)) {
                return Optional.of(RateLimitTier.ORDER_LOOKUP);
            }
            if ("/api/v1/search-suggest".equals(path)) {
                return Optional.of(RateLimitTier.SEARCH);
            }
            if (isOAuthRoundTrip(path)) {
                return Optional.of(RateLimitTier.OAUTH);
            }
            if (isAdminExportPath(path)) {
                return Optional.of(RateLimitTier.ADMIN_EXPORT);
            }
        }

        if (path.startsWith("/api/v1/admin/")) {
            if (HttpMethod.POST.name().equals(method) && "/api/v1/admin/products/import/validate".equals(path)) {
                return Optional.of(RateLimitTier.ADMIN_IMPORT_VALIDATE);
            }
            if (HttpMethod.POST.name().equals(method) && "/api/v1/admin/products/import/commit".equals(path)) {
                return Optional.of(RateLimitTier.ADMIN_IMPORT_COMMIT);
            }
            if (isAdminMediaWrite(method, path)) {
                return Optional.of(RateLimitTier.ADMIN_MEDIA);
            }
            if (WRITE_METHODS.contains(method)) {
                return Optional.of(RateLimitTier.ADMIN_MUTATION);
            }
        }

        return Optional.empty();
    }

    public boolean acceptsCustomerIdentity(RateLimitTier tier) {
        return switch (tier) {
            case CUSTOMER_MUTATION, CUSTOMER_MEDIA, CHECKOUT, REFRESH, RESEND_VERIFICATION,
                    REVIEW, REVIEW_PHOTO, CHAT -> true;
            default -> false;
        };
    }

    public boolean acceptsAdminIdentity(RateLimitTier tier) {
        return switch (tier) {
            case ADMIN_MUTATION, ADMIN_MEDIA, ADMIN_IMPORT_VALIDATE, ADMIN_IMPORT_COMMIT,
                    ADMIN_EXPORT, RESEND_VERIFICATION, WEBSOCKET_HANDSHAKE, WEBSOCKET_COMMAND -> true;
            default -> false;
        };
    }

    public String routeGroup(RateLimitTier tier) {
        return tier.key();
    }

    static String normalizePath(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            return "/";
        }
        String path = rawPath.split("\\?", 2)[0]
                .replaceAll("(?i)%2f", "/")
                .replaceAll("(?i)%5c", "/")
                .replace('\\', '/');
        while (path.contains("//")) {
            path = path.replace("//", "/");
        }
        while (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path;
    }

    private static boolean isCatalogSearch(HttpServletRequest request) {
        if (!HttpMethod.GET.name().equals(request.getMethod())
                || !"/api/v1/products".equals(normalizePath(request.getRequestURI()))) {
            return false;
        }
        String query = request.getParameter("q");
        return query != null && !query.isBlank();
    }

    private static boolean isCartMutationPath(String path) {
        return "/api/v1/cart".equals(path) || path.startsWith("/api/v1/cart/");
    }

    private static boolean isCustomerAvatarPath(String path) {
        return "/api/v1/customer/me/avatar".equals(path);
    }

    private static boolean isCustomerMutationPath(String path) {
        return "/api/v1/customer/me".equals(path)
                || path.startsWith("/api/v1/customer/addresses")
                || path.startsWith("/api/v1/customer/orders")
                || path.startsWith("/api/v1/customer/auth/oauth/links");
    }

    private static boolean isProductReviewPath(String path) {
        return path.matches("^/api/v1/products/[^/]+/reviews$");
    }

    private static boolean isProductReviewPhotoPath(String path) {
        return path.matches("^/api/v1/products/[^/]+/reviews/photos$");
    }

    private static boolean isOAuthRoundTrip(String path) {
        return path.matches("^/api/v1/customer/auth/oauth/[^/]+/(authorize|callback)$");
    }

    private static boolean isAdminInviteResend(String path) {
        return path.matches("^/api/v1/admin/admin-users/[^/]+/resend-invite$");
    }

    private static boolean isAdminMediaWrite(String method, String path) {
        return HttpMethod.POST.name().equals(method)
                && "/api/v1/admin/media".equals(path);
    }

    private static boolean isAdminExportPath(String path) {
        return path.startsWith("/api/v1/admin/")
                && (path.contains("/export/") || path.endsWith("/export") || path.endsWith("/export.csv"));
    }
}
