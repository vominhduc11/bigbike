package com.bigbike.bigbike_backend.config;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Cấu hình phân tách cửa khách, cửa nhân viên và host dùng chung khi phát triển. */
@Component
@ConfigurationProperties(prefix = "bigbike.ingress-boundary")
@Getter
@Setter
public class IngressBoundaryProperties {

    private boolean enabled = true;
    private List<String> adminHosts = new ArrayList<>(List.of("admin.bigbike.vn"));
    private List<String> publicHosts = new ArrayList<>(List.of("api.bigbike.vn", "bigbike-backend"));
    private List<String> sharedHosts = new ArrayList<>(List.of("localhost", "127.0.0.1", "::1"));

    @PostConstruct
    void validate() {
        if (!enabled) {
            throw new IllegalStateException("Không được tắt ranh giới cửa truy cập");
        }
        adminHosts = normalizeRequired("cửa nhân viên", adminHosts);
        publicHosts = normalizeRequired("cửa khách", publicHosts);
        sharedHosts = normalizeRequired("host phát triển/kiểm thử", sharedHosts);

        assertDisjoint("cửa nhân viên", adminHosts, "cửa khách", publicHosts);
        assertDisjoint("cửa nhân viên", adminHosts, "host dùng chung", sharedHosts);
        assertDisjoint("cửa khách", publicHosts, "host dùng chung", sharedHosts);
    }

    boolean isAdminHost(String host) {
        return adminHosts.contains(normalizeHost(host));
    }

    boolean isPublicHost(String host) {
        return publicHosts.contains(normalizeHost(host));
    }

    boolean isSharedHost(String host) {
        return sharedHosts.contains(normalizeHost(host));
    }

    static String normalizeHost(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("[")) {
            int closingBracket = normalized.indexOf(']');
            if (closingBracket > 0) {
                normalized = normalized.substring(1, closingBracket);
            }
        } else {
            int firstColon = normalized.indexOf(':');
            if (firstColon >= 0 && firstColon == normalized.lastIndexOf(':')) {
                normalized = normalized.substring(0, firstColon);
            }
        }
        while (normalized.endsWith(".")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static List<String> normalizeRequired(String label, List<String> configured) {
        Set<String> normalized = new LinkedHashSet<>();
        if (configured != null) {
            for (String value : configured) {
                String host = normalizeHost(value);
                if (!host.isBlank()) {
                    normalized.add(host);
                }
            }
        }
        if (normalized.isEmpty()) {
            throw new IllegalStateException("Danh sách host cho " + label + " không được để trống");
        }
        return new ArrayList<>(normalized);
    }

    private static void assertDisjoint(
            String firstLabel,
            List<String> first,
            String secondLabel,
            List<String> second
    ) {
        Set<String> overlap = new LinkedHashSet<>(first);
        overlap.retainAll(second);
        if (!overlap.isEmpty()) {
            throw new IllegalStateException(
                    "Host không được nằm đồng thời trong " + firstLabel + " và " + secondLabel + ": " + overlap);
        }
    }
}
