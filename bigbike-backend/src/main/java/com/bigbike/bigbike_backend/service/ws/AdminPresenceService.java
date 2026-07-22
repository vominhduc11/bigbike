package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminPresenceService {

    private static final Pattern PRODUCT_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,127}");

    private final SimpMessagingTemplate messaging;
    private final Object monitor = new Object();
    private final Map<String, Map<String, PresenceEntry>> entriesByEntity = new HashMap<>();
    private final Map<String, Set<String>> entityKeysBySession = new HashMap<>();

    public void join(UUID adminId, String sessionId, String entityType, String entityId) {
        EntityRef ref = EntityRef.parse(entityType, entityId);
        int activeAdminCount;
        synchronized (monitor) {
            entriesByEntity.computeIfAbsent(ref.key(), ignored -> new HashMap<>())
                    .put(sessionId, new PresenceEntry(adminId, ref));
            entityKeysBySession.computeIfAbsent(sessionId, ignored -> new HashSet<>()).add(ref.key());
            activeAdminCount = activeAdminCount(ref.key());
        }
        broadcast("JOIN", ref, activeAdminCount);
    }

    public void leave(UUID adminId, String sessionId, String entityType, String entityId) {
        EntityRef ref = EntityRef.parse(entityType, entityId);
        removeEntry(adminId, sessionId, ref);
    }

    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        List<PresenceChange> changes = new ArrayList<>();
        synchronized (monitor) {
            Set<String> entityKeys = entityKeysBySession.remove(event.getSessionId());
            if (entityKeys == null) return;
            for (String entityKey : entityKeys) {
                Map<String, PresenceEntry> entries = entriesByEntity.get(entityKey);
                if (entries == null || entries.remove(event.getSessionId()) == null) continue;
                EntityRef ref = EntityRef.fromKey(entityKey);
                int activeAdminCount = activeAdminCount(entityKey);
                if (entries.isEmpty()) entriesByEntity.remove(entityKey);
                changes.add(new PresenceChange(ref, activeAdminCount));
            }
        }
        changes.forEach(change -> broadcast("LEAVE", change.ref(), change.activeAdminCount()));
    }

    private void removeEntry(UUID adminId, String sessionId, EntityRef ref) {
        int activeAdminCount;
        synchronized (monitor) {
            Map<String, PresenceEntry> entries = entriesByEntity.get(ref.key());
            PresenceEntry entry = entries != null ? entries.get(sessionId) : null;
            if (entry == null || !entry.adminId().equals(adminId)) return;
            entries.remove(sessionId);
            Set<String> entityKeys = entityKeysBySession.get(sessionId);
            if (entityKeys != null) {
                entityKeys.remove(ref.key());
                if (entityKeys.isEmpty()) entityKeysBySession.remove(sessionId);
            }
            activeAdminCount = activeAdminCount(ref.key());
            if (entries.isEmpty()) entriesByEntity.remove(ref.key());
        }
        broadcast("LEAVE", ref, activeAdminCount);
    }

    private int activeAdminCount(String entityKey) {
        Map<String, PresenceEntry> entries = entriesByEntity.get(entityKey);
        if (entries == null) return 0;
        return (int) entries.values().stream().map(PresenceEntry::adminId).distinct().count();
    }

    private void broadcast(String action, EntityRef ref, int activeAdminCount) {
        try {
            messaging.convertAndSend(ref.topic(), new AdminPresenceEvent(
                    action, ref.type(), ref.id(), activeAdminCount, Instant.now()));
        } catch (Exception e) {
            log.warn("WS presence push failed for {} {}: {}", ref.type(), ref.id(), e.getMessage());
        }
    }

    private record PresenceEntry(UUID adminId, EntityRef ref) {}

    private record PresenceChange(EntityRef ref, int activeAdminCount) {}

    private record EntityRef(String type, String id) {
        static EntityRef parse(String rawType, String rawId) {
            String type = rawType != null ? rawType.trim().toUpperCase() : "";
            String id = rawId != null ? rawId.trim() : "";
            if ("ORDER".equals(type)) {
                return new EntityRef(type, UUID.fromString(id).toString());
            }
            if ("PRODUCT".equals(type) && PRODUCT_ID.matcher(id).matches()) {
                return new EntityRef(type, id);
            }
            throw new IllegalArgumentException("Invalid presence entity.");
        }

        static EntityRef fromKey(String key) {
            int separator = key.indexOf(':');
            return new EntityRef(key.substring(0, separator), key.substring(separator + 1));
        }

        String key() {
            return type + ":" + id;
        }

        String topic() {
            return "/topic/admin/presence/" + type.toLowerCase() + "/" + id;
        }
    }
}
