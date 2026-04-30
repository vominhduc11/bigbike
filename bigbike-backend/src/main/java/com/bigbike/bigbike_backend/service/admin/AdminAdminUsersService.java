package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAdminUsersService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private static final Set<String> VALID_ROLES = Set.of(
            "SUPER_ADMIN", "ADMIN", "EDITOR", "SHOP_MANAGER", "AUTHOR", "CONTRIBUTOR", "SEO_EDITOR"
    );

    private final AdminUserJpaRepository adminUserRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;
    private final PasswordService passwordService;

    public AdminAdminUsersService(
            AdminUserJpaRepository adminUserRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService,
            PasswordService passwordService
    ) {
        this.adminUserRepo = adminUserRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
        this.passwordService = passwordService;
    }

    public PageResult<Map<String, Object>> listAdminUsers(int page, int size, String q) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        List<AdminUserEntity> all = adminUserRepo.findAll();
        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            all = all.stream()
                    .filter(u -> matches(u.getEmail(), qLower) || matches(u.getDisplayName(), qLower))
                    .toList();
        }
        List<Map<String, Object>> mapped = all.stream().map(this::toMap).toList();
        return paginationService.paginate(mapped, normalizedPage, normalizedSize);
    }

    public Map<String, Object> getAdminUser(UUID id) {
        return toMap(adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found.")));
    }

    /**
     * @param actorId the ID of the admin performing the update (for audit log and self-demotion guard)
     */
    @Transactional
    public Map<String, Object> updateAdminUser(UUID actorId, UUID id, String displayName, String status, String newPassword, String role) {
        AdminUserEntity entity = adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found."));

        String beforeRole = entity.getRole();
        String beforeStatus = entity.getStatus();

        if (displayName != null && !displayName.isBlank()) entity.setDisplayName(displayName.trim());
        if (status != null && !status.isBlank()) entity.setStatus(status.toUpperCase(Locale.ROOT));
        if (newPassword != null && !newPassword.isBlank()) {
            entity.setPasswordHash(passwordService.hash(newPassword));
        }
        if (role != null && !role.isBlank()) {
            String normalizedRole = role.trim().toUpperCase(Locale.ROOT);
            if (!VALID_ROLES.contains(normalizedRole)) {
                throw new ConflictException("Invalid role: " + normalizedRole);
            }
            // Prevent self-demotion from SUPER_ADMIN
            if (id.equals(actorId) && "SUPER_ADMIN".equals(entity.getRole()) && !"SUPER_ADMIN".equals(normalizedRole)) {
                throw new ConflictException("SUPER_ADMIN cannot demote themselves.");
            }
            // Prevent removing the last SUPER_ADMIN
            if ("SUPER_ADMIN".equals(entity.getRole()) && !"SUPER_ADMIN".equals(normalizedRole)) {
                long superAdminCount = adminUserRepo.findAll().stream()
                        .filter(u -> "SUPER_ADMIN".equals(u.getRole()) && "ACTIVE".equals(u.getStatus()))
                        .count();
                if (superAdminCount <= 1) {
                    throw new ConflictException("Cannot demote the last active SUPER_ADMIN.");
                }
            }
            entity.setRole(normalizedRole);
        }
        // Prevent self-deactivation
        if (id.equals(actorId) && status != null && !"ACTIVE".equalsIgnoreCase(status)) {
            throw new ConflictException("Admin cannot deactivate their own account.");
        }

        Instant now = Instant.now();
        entity.setUpdatedAt(now);
        AdminUserEntity saved = adminUserRepo.save(entity);

        auditLogRepo.save(buildAudit(actorId, "ADMIN_USER_UPDATED", id,
                "{\"role\":\"" + beforeRole + "\",\"status\":\"" + beforeStatus + "\"}",
                "{\"role\":\"" + saved.getRole() + "\",\"status\":\"" + saved.getStatus() + "\"}", now));

        return toMap(saved);
    }

    private boolean matches(String field, String q) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(q);
    }

    private Map<String, Object> toMap(AdminUserEntity u) {
        return Map.of(
                "id", u.getId().toString(),
                "email", u.getEmail(),
                "displayName", u.getDisplayName() != null ? u.getDisplayName() : "",
                "role", u.getRole() != null ? u.getRole() : "",
                "status", u.getStatus() != null ? u.getStatus() : "",
                "lastLoginAt", u.getLastLoginAt() != null ? u.getLastLoginAt().toString() : "",
                "createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : "",
                "updatedAt", u.getUpdatedAt() != null ? u.getUpdatedAt().toString() : ""
        );
    }

    private AuditLogEntity buildAudit(UUID actorId, String action, UUID resourceId,
            String before, String after, Instant now) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(actorId);
        log.setAction(action);
        log.setResourceType("ADMIN_USER");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(now);
        return log;
    }
}
