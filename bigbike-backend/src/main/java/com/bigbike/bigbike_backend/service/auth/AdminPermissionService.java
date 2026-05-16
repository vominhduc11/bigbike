package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * DB-backed, in-memory-cached resolver for role → permission list.
 * This is the runtime source of truth; AdminRolePermissions.MAP is bootstrap/catalog only.
 *
 * Cache invalidation: call evict(roleId) after any role-permissions write.
 */
@Service
@RequiredArgsConstructor
public class AdminPermissionService {

    private final AdminRoleJpaRepository roleRepo;
    private final ConcurrentHashMap<String, List<String>> cache = new ConcurrentHashMap<>();

    /**
     * Returns the permission list for the given role, loading from DB on first access.
     * Unknown roles return an empty list — no fallback to any other role.
     * Empty results are not cached so that a role created after the first miss is picked up
     * without requiring an explicit evict() call.
     */
    public List<String> getPermissionsForRole(String roleId) {
        if (roleId == null) return List.of();
        String key = roleId.toUpperCase(Locale.ROOT);
        List<String> cached = cache.get(key);
        if (cached != null) return cached;
        return roleRepo.findById(key)
                .map(r -> {
                    List<String> perms = List.copyOf(r.getPermissions());
                    cache.put(key, perms);
                    return perms;
                })
                .orElse(List.of());
    }

    /** Removes a role's cached permissions, forcing a DB re-read on next access. */
    public void evict(String roleId) {
        if (roleId != null) {
            cache.remove(roleId.toUpperCase(Locale.ROOT));
        }
    }
}
