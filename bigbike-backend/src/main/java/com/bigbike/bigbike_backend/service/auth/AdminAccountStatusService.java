package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * DB-backed, in-memory-cached lookup of an admin's CURRENT role + status/access version, so locking/suspending/
 * demoting an admin takes effect on their very next request instead of waiting for the access-token
 * TTL to expire. Mirrors {@link AdminPermissionService}'s cache/evict pattern.
 *
 * Cache invalidation: call evict(userId) after any write to AdminUserEntity.status or .role.
 */
@Service
@RequiredArgsConstructor
public class AdminAccountStatusService {

    public record Snapshot(String role, String status, long accessVersion) {}

    private final AdminUserJpaRepository adminUserRepo;
    private final ConcurrentHashMap<UUID, Snapshot> cache = new ConcurrentHashMap<>();

    /** Returns null if the admin user no longer exists (deleted). */
    public Snapshot getSnapshot(UUID userId) {
        Snapshot cached = cache.get(userId);
        if (cached != null) {
            return cached;
        }
        return adminUserRepo.findById(userId)
                .map(u -> {
                    Snapshot snapshot = new Snapshot(u.getRole(), u.getStatus(), u.getAccessVersion());
                    cache.put(userId, snapshot);
                    return snapshot;
                })
                .orElse(null);
    }

    public void evict(UUID userId) {
        if (userId != null) {
            cache.remove(userId);
        }
    }
}
