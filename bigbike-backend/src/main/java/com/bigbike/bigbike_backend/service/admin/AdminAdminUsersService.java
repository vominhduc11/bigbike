package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminAdminUsersService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private static final Set<String> BUILTIN_ROLES = Set.of(
            "SUPER_ADMIN", "ADMIN", "EDITOR", "SHOP_MANAGER", "AUTHOR", "CONTRIBUTOR", "SEO_EDITOR"
    );

    private static final Set<String> VALID_STATUSES = Set.of("ACTIVE", "DISABLED", "SUSPENDED");

    private final AdminUserJpaRepository adminUserRepo;
    private final AdminRoleJpaRepository adminRoleRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;
    private final PasswordService passwordService;

    public PageResult<Map<String, Object>> listAdminUsers(int page, int size, String q, String roleFilter, String statusFilter) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        List<AdminUserEntity> all = adminUserRepo.findAll();

        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            all = all.stream()
                    .filter(u -> matches(u.getEmail(), qLower) || matches(u.getDisplayName(), qLower))
                    .toList();
        }
        if (roleFilter != null && !roleFilter.isBlank()) {
            String rf = roleFilter.trim().toUpperCase(Locale.ROOT);
            all = all.stream().filter(u -> rf.equals(u.getRole())).toList();
        }
        if (statusFilter != null && !statusFilter.isBlank()) {
            String sf = statusFilter.trim().toUpperCase(Locale.ROOT);
            all = all.stream().filter(u -> sf.equals(u.getStatus())).toList();
        }

        List<Map<String, Object>> mapped = all.stream().map(this::toMap).toList();
        return paginationService.paginate(mapped, normalizedPage, normalizedSize);
    }

    public Map<String, Object> getAdminUser(UUID id) {
        return toMap(adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found.")));
    }

    @Transactional
    public Map<String, Object> createAdminUser(UUID actorId, String clientIp, String userAgent,
            String email, String displayName, String role, String password) {
        if (email == null || email.isBlank()) {
            throw new ConflictException("Email is required.");
        }
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (!normalizedEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new ConflictException("Invalid email format.");
        }
        if (adminUserRepo.findByEmail(normalizedEmail).isPresent()) {
            throw new ConflictException("Email already exists: " + normalizedEmail);
        }
        if (displayName == null || displayName.isBlank()) {
            throw new ConflictException("Display name is required.");
        }
        String normalizedRole = (role != null) ? role.trim().toUpperCase(Locale.ROOT) : "";
        if (normalizedRole.isBlank()) {
            throw new ConflictException("Role is required.");
        }
        if (!isValidRole(normalizedRole)) {
            throw new ConflictException("Invalid role: " + normalizedRole);
        }
        if (password == null || password.isBlank()) {
            throw new ConflictException("Password is required.");
        }
        if (password.length() < 8) {
            throw new ConflictException("Password must be at least 8 characters.");
        }

        Instant now = Instant.now();
        AdminUserEntity entity = new AdminUserEntity();
        entity.setEmail(normalizedEmail);
        entity.setDisplayName(displayName.trim());
        entity.setRole(normalizedRole);
        entity.setStatus("ACTIVE");
        entity.setPasswordHash(passwordService.hash(password));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        AdminUserEntity saved = adminUserRepo.save(entity);

        String afterData = "{\"email\":\"" + escapeJson(saved.getEmail())
                + "\",\"role\":\"" + saved.getRole()
                + "\",\"status\":\"ACTIVE\"}";
        auditLogRepo.save(buildAudit(actorId, clientIp, userAgent, "ADMIN_USER_CREATED", saved.getId(), null, afterData, now));

        return toMap(saved);
    }

    @Transactional
    public Map<String, Object> updateAdminUser(UUID actorId, String clientIp, String userAgent,
            UUID id, String displayName, String status, String newPassword, String role) {
        AdminUserEntity entity = adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found."));

        String beforeRole = entity.getRole();
        String beforeStatus = entity.getStatus();
        String beforeDisplayName = entity.getDisplayName();

        // --- Guards: validate BEFORE applying changes ---
        if (status != null && !status.isBlank()) {
            String normalizedStatus = status.trim().toUpperCase(Locale.ROOT);
            if (!VALID_STATUSES.contains(normalizedStatus)) {
                throw new ConflictException("Invalid status: " + normalizedStatus + ". Must be ACTIVE, DISABLED or SUSPENDED.");
            }
            if (id.equals(actorId) && !"ACTIVE".equals(normalizedStatus)) {
                throw new ConflictException("Admin cannot deactivate their own account.");
            }
        }
        if (role != null && !role.isBlank()) {
            String normalizedRole = role.trim().toUpperCase(Locale.ROOT);
            if (!isValidRole(normalizedRole)) {
                throw new ConflictException("Invalid role: " + normalizedRole);
            }
            if (id.equals(actorId) && "SUPER_ADMIN".equals(entity.getRole()) && !"SUPER_ADMIN".equals(normalizedRole)) {
                throw new ConflictException("SUPER_ADMIN cannot demote themselves.");
            }
            if ("SUPER_ADMIN".equals(entity.getRole()) && !"SUPER_ADMIN".equals(normalizedRole)) {
                // RBAUD-008: use targeted DB count instead of findAll() full table scan
                long superAdminCount = adminUserRepo.countByRoleAndStatus("SUPER_ADMIN", "ACTIVE");
                if (superAdminCount <= 1) {
                    throw new ConflictException("Cannot demote the last active SUPER_ADMIN.");
                }
            }
        }

        // --- Apply changes ---
        boolean passwordChanged = false;
        if (displayName != null && !displayName.isBlank()) entity.setDisplayName(displayName.trim());
        if (status != null && !status.isBlank()) entity.setStatus(status.trim().toUpperCase(Locale.ROOT));
        if (newPassword != null && !newPassword.isBlank()) {
            entity.setPasswordHash(passwordService.hash(newPassword));
            passwordChanged = true;
        }
        if (role != null && !role.isBlank()) {
            entity.setRole(role.trim().toUpperCase(Locale.ROOT));
        }

        Instant now = Instant.now();
        entity.setUpdatedAt(now);
        AdminUserEntity saved = adminUserRepo.save(entity);

        // --- Audit: record which fields changed; never log raw password ---
        StringBuilder beforeSb = new StringBuilder("{");
        StringBuilder afterSb = new StringBuilder("{");
        beforeSb.append("\"role\":\"").append(escapeJson(beforeRole)).append("\"");
        beforeSb.append(",\"status\":\"").append(escapeJson(beforeStatus)).append("\"");
        afterSb.append("\"role\":\"").append(escapeJson(saved.getRole())).append("\"");
        afterSb.append(",\"status\":\"").append(escapeJson(saved.getStatus())).append("\"");

        if (!Objects.equals(beforeDisplayName, saved.getDisplayName())) {
            beforeSb.append(",\"displayName\":\"").append(escapeJson(beforeDisplayName)).append("\"");
            afterSb.append(",\"displayName\":\"").append(escapeJson(saved.getDisplayName())).append("\"");
        }
        if (passwordChanged) {
            afterSb.append(",\"passwordChanged\":true");
        }
        beforeSb.append("}");
        afterSb.append("}");

        auditLogRepo.save(buildAudit(actorId, clientIp, userAgent, "ADMIN_USER_UPDATED", id,
                beforeSb.toString(), afterSb.toString(), now));

        return toMap(saved);
    }

    private boolean isValidRole(String normalizedRole) {
        return BUILTIN_ROLES.contains(normalizedRole) || adminRoleRepo.existsById(normalizedRole);
    }

    private boolean matches(String field, String q) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(q);
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
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

    private AuditLogEntity buildAudit(UUID actorId, String clientIp, String userAgent,
            String action, UUID resourceId, String before, String after, Instant now) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(actorId);
        log.setAction(action);
        log.setResourceType("ADMIN_USER");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setIpAddress(clientIp);
        log.setUserAgent(userAgent);
        log.setCreatedAt(now);
        return log;
    }
}
