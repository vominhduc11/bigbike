package com.bigbike.bigbike_backend.service.maintenance;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Short-lived in-memory upload leases used only to avoid cutting an active admin upload at the
 * maintenance boundary. The upload itself remains owned by the media service; leases expire as a
 * fail-safe when a browser disappears without sending END.
 */
@Service
public class MaintenanceUploadLeaseService {

    private static final Duration LEASE_TTL = Duration.ofMinutes(15);
    private final Map<String, Instant> activeLeases = new ConcurrentHashMap<>();

    public void update(UUID adminId, String uploadId, String status) {
        if (adminId == null || uploadId == null || uploadId.isBlank()) {
            throw new IllegalArgumentException("Upload lease identity is required.");
        }
        pruneExpired();
        String key = adminId + ":" + uploadId.trim();
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if ("PENDING".equals(normalized) || "UPLOADING".equals(normalized)) {
            activeLeases.put(key, Instant.now());
        } else if ("DONE".equals(normalized) || "ERROR".equals(normalized) || "CANCELLED".equals(normalized)) {
            activeLeases.remove(key);
        } else {
            throw new IllegalArgumentException("Invalid upload lease status.");
        }
    }

    public Activity activity() {
        pruneExpired();
        return new Activity(!activeLeases.isEmpty(), activeLeases.size());
    }

    private void pruneExpired() {
        Instant cutoff = Instant.now().minus(LEASE_TTL);
        activeLeases.entrySet().removeIf(entry -> entry.getValue().isBefore(cutoff));
    }

    public record Activity(boolean active, int count) {}
}
