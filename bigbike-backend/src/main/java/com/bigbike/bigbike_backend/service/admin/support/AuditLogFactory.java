package com.bigbike.bigbike_backend.service.admin.support;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class AuditLogFactory {

    public AuditLogEntity build(
            String actorType,
            UUID actorId,
            String action,
            String resourceType,
            UUID resourceId,
            String beforeData,
            String afterData
    ) {
        return build(actorType, actorId, action, resourceType, resourceId, beforeData, afterData, null, null);
    }

    public AuditLogEntity build(
            String actorType,
            UUID actorId,
            String action,
            String resourceType,
            UUID resourceId,
            String beforeData,
            String afterData,
            String ipAddress,
            String userAgent
    ) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType(actorType);
        log.setActorId(actorId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setResourceId(resourceId);
        log.setBeforeData(beforeData);
        log.setAfterData(afterData);
        log.setIpAddress(blankToNull(ipAddress));
        log.setUserAgent(blankToNull(userAgent));
        log.setCreatedAt(Instant.now());
        return log;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
