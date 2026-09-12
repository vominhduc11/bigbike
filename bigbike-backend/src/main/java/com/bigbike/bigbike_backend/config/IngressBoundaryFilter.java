package com.bigbike.bigbike_backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Chặn yêu cầu đi sai cửa trước khi chạy đăng nhập, phân quyền hoặc giới hạn truy cập. */
@Component
@RequiredArgsConstructor
public class IngressBoundaryFilter extends OncePerRequestFilter {

    private static final String ADMIN_API = "/api/v1/admin";
    private static final String ADMIN_AUTH = "/api/v1/auth";
    private static final String ARTICLES = "/api/v1/articles";
    private static final String CATALOG_FACETS = "/api/v1/catalog/facets";
    private static final String PUBLIC_SETTINGS = "/api/v1/settings/public";
    private static final String ADMIN_WEBSOCKET = "/ws";

    private final IngressBoundaryProperties properties;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String host = request.getServerName();
        String path = normalizeSecurityPath(request.getRequestURI());

        if (properties.isSharedHost(host)) {
            filterChain.doFilter(request, response);
            return;
        }
        if (properties.isAdminHost(host)) {
            if (isAdminDoorAllowed(path)) {
                filterChain.doFilter(request, response);
            } else {
                hide(response);
            }
            return;
        }
        if (properties.isPublicHost(host)) {
            if (isAdminOnlyPath(path)) {
                hide(response);
            } else {
                filterChain.doFilter(request, response);
            }
            return;
        }
        hide(response);
    }

    private static boolean isAdminDoorAllowed(String path) {
        return isSegment(path, ADMIN_API)
                || isSegment(path, ADMIN_AUTH)
                || isSegment(path, ARTICLES)
                || CATALOG_FACETS.equals(path)
                || PUBLIC_SETTINGS.equals(path)
                || isSegment(path, ADMIN_WEBSOCKET);
    }

    private static boolean isAdminOnlyPath(String path) {
        return isSegment(path, ADMIN_API)
                || isSegment(path, ADMIN_AUTH)
                || isSegment(path, ADMIN_WEBSOCKET);
    }

    private static boolean isSegment(String path, String prefix) {
        if (!path.startsWith(prefix)) {
            return false;
        }
        return path.length() == prefix.length()
                || path.charAt(prefix.length()) == '/'
                || path.charAt(prefix.length()) == ';';
    }

    private static String normalizeSecurityPath(String requestUri) {
        String normalized = requestUri == null ? "" : requestUri.toLowerCase(Locale.ROOT);
        for (int pass = 0; pass < 2; pass++) {
            normalized = normalized
                    .replace("%25", "%")
                    .replace("%3b", ";")
                    .replace("%2f", "/")
                    .replace("%5c", "/");
        }
        while (normalized.contains("//")) {
            normalized = normalized.replace("//", "/");
        }
        return normalized;
    }

    private static void hide(HttpServletResponse response) {
        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        response.setHeader("Cache-Control", "no-store");
        response.setContentLength(0);
    }
}
