package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchGroup;
import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.util.AdminSearchText;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Orchestrates permission-scoped, partial-success quick-search groups. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminQuickSearchService {

    public static final String[] SEARCH_PERMISSIONS = {
            "orders.read", "products.read", "customers.read", "catalog.read", "content.read", "admin-users.read"
    };

    private static final List<GroupDefinition> GROUPS = List.of(
            new GroupDefinition("orders", "orders.read"),
            new GroupDefinition("products", "products.read"),
            new GroupDefinition("customers", "customers.read"),
            new GroupDefinition("categories", "catalog.read"),
            new GroupDefinition("brands", "catalog.read"),
            new GroupDefinition("articles", "content.read"),
            new GroupDefinition("adminUsers", "admin-users.read")
    );

    private final AdminQuickSearchReader reader;

    public AdminQuickSearchResponse search(String rawQuery, AdminUserProfile profile) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.isBlank() || AdminSearchText.normalize(query).length() > 100) {
            throw ValidationException.fromField(
                    "q", "INVALID_SEARCH_QUERY", "Search query must contain 1 to 100 characters.");
        }

        List<String> permissions = profile == null || profile.permissions() == null
                ? List.of()
                : profile.permissions();
        Map<String, AdminQuickSearchGroup> results = new LinkedHashMap<>();
        for (GroupDefinition group : GROUPS) {
            if (!hasPermission(permissions, group.permission())) {
                continue;
            }
            try {
                results.put(group.key(), read(group.key(), query));
            } catch (RuntimeException exception) {
                // Do not log the query or any row data: names, email addresses and phone numbers
                // are customer/admin data and must never enter the application log.
                log.warn("Admin quick-search group {} failed: {}", group.key(), exception.getClass().getSimpleName());
                results.put(group.key(), AdminQuickSearchGroup.error("SEARCH_GROUP_UNAVAILABLE"));
            }
        }
        return new AdminQuickSearchResponse(results);
    }

    private AdminQuickSearchGroup read(String group, String query) {
        return switch (group) {
            case "orders" -> reader.searchOrders(query);
            case "products" -> reader.searchProducts(query);
            case "customers" -> reader.searchCustomers(query);
            case "categories" -> reader.searchCategories(query);
            case "brands" -> reader.searchBrands(query);
            case "articles" -> reader.searchArticles(query);
            case "adminUsers" -> reader.searchAdminUsers(query);
            default -> throw new IllegalArgumentException("Unknown quick-search group.");
        };
    }

    private static boolean hasPermission(List<String> permissions, String permission) {
        return permissions.contains("*") || permissions.contains(permission);
    }

    private record GroupDefinition(String key, String permission) {
    }
}
