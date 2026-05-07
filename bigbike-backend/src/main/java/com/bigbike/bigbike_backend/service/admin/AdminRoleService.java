package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.PermissionCatalog;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminRoleService {

    /** Role IDs must be UPPER_CASE_WITH_UNDERSCORES, start with a letter, 2–50 chars. */
    private static final java.util.regex.Pattern ROLE_ID_PATTERN =
            java.util.regex.Pattern.compile("[A-Z][A-Z0-9_]{1,49}");

    private final AdminRoleJpaRepository roleRepo;
    private final AdminUserJpaRepository adminUserRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final AdminPermissionService adminPermissionService;

    public AdminRoleService(
            AdminRoleJpaRepository roleRepo,
            AdminUserJpaRepository adminUserRepo,
            AuditLogJpaRepository auditLogRepo,
            AdminPermissionService adminPermissionService) {
        this.roleRepo = roleRepo;
        this.adminUserRepo = adminUserRepo;
        this.auditLogRepo = auditLogRepo;
        this.adminPermissionService = adminPermissionService;
    }

    public List<Map<String, Object>> getAllRoles() {
        return roleRepo.findAll().stream()
                .map(this::toMap)
                .toList();
    }

    public Set<String> getAllRoleIds() {
        return roleRepo.findAll().stream()
                .map(AdminRoleEntity::getId)
                .collect(Collectors.toSet());
    }

    public List<String> getPermissionsForRole(String roleId) {
        if (roleId == null) return List.of();
        return roleRepo.findById(roleId.toUpperCase(Locale.ROOT))
                .map(r -> List.copyOf(r.getPermissions()))
                .orElse(List.of());
    }

    @Transactional
    public Map<String, Object> updateRolePermissions(String roleId, Set<String> permissions, UUID actorId) {
        AdminRoleEntity role = roleRepo.findById(roleId.toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new NotFoundException("Role not found: " + roleId));

        if ("SUPER_ADMIN".equals(role.getId())) {
            throw new ConflictException("Cannot modify SUPER_ADMIN permissions.");
        }

        validatePermissionKeys(permissions);

        Set<String> before = new LinkedHashSet<>(role.getPermissions());
        role.setPermissions(new LinkedHashSet<>(permissions));
        role.setUpdatedAt(Instant.now());
        AdminRoleEntity saved = roleRepo.save(role);

        adminPermissionService.evict(saved.getId());

        auditLogRepo.save(buildAudit(actorId, "ROLE_PERMISSIONS_UPDATED",
                permissionsJson(role.getId(), before), permissionsJson(role.getId(), saved.getPermissions())));

        return toMap(saved);
    }

    @Transactional
    public Map<String, Object> createRole(String id, String name, String description, Set<String> permissions, UUID actorId) {
        if (id == null || id.isBlank()) {
            throw new ValidationException("Role ID must not be blank.",
                    List.of(new ApiErrorDetail("id", "REQUIRED", "Role ID is required.")));
        }
        if (name == null || name.isBlank()) {
            throw new ValidationException("Role name must not be blank.",
                    List.of(new ApiErrorDetail("name", "REQUIRED", "Role name is required.")));
        }

        String normalizedId = id.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", "_");

        if (!ROLE_ID_PATTERN.matcher(normalizedId).matches()) {
            throw new ValidationException("Invalid role ID format.",
                    List.of(new ApiErrorDetail("id", "INVALID_FORMAT",
                            "Role ID must match [A-Z][A-Z0-9_]{1,49}: " + normalizedId)));
        }

        if (roleRepo.existsById(normalizedId)) {
            throw new ConflictException("Role already exists: " + normalizedId);
        }

        validatePermissionKeys(permissions);

        Instant now = Instant.now();
        AdminRoleEntity role = new AdminRoleEntity();
        role.setId(normalizedId);
        role.setName(name.trim());
        role.setDescription(description);
        role.setSystem(false);
        role.setPermissions(new LinkedHashSet<>(permissions));
        role.setCreatedAt(now);
        role.setUpdatedAt(now);
        AdminRoleEntity saved = roleRepo.save(role);

        adminPermissionService.evict(saved.getId());

        auditLogRepo.save(buildAudit(actorId, "ROLE_CREATED",
                null, permissionsJson(saved.getId(), saved.getPermissions())));

        return toMap(saved);
    }

    @Transactional
    public void deleteRole(String roleId, UUID actorId) {
        AdminRoleEntity role = roleRepo.findById(roleId.toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new NotFoundException("Role not found: " + roleId));

        if (role.isSystem()) {
            throw new ConflictException("Cannot delete built-in system role: " + roleId);
        }

        long inUse = adminUserRepo.countByRole(role.getId());
        if (inUse > 0) {
            throw new ConflictException(
                    "Cannot delete role '" + role.getId() + "': " + inUse + " admin user(s) still assigned.");
        }

        Set<String> before = new LinkedHashSet<>(role.getPermissions());
        roleRepo.delete(role);

        adminPermissionService.evict(role.getId());

        auditLogRepo.save(buildAudit(actorId, "ROLE_DELETED",
                permissionsJson(role.getId(), before), null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void validatePermissionKeys(Set<String> permissions) {
        List<String> unknown = permissions.stream()
                .filter(p -> !PermissionCatalog.ALL_KEYS.contains(p))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            List<ApiErrorDetail> details = unknown.stream()
                    .map(p -> new ApiErrorDetail("permissions", "UNKNOWN_PERMISSION", "Unknown permission: " + p))
                    .toList();
            throw new ValidationException("One or more permission keys are not recognised.", details);
        }
    }

    private Map<String, Object> toMap(AdminRoleEntity r) {
        return Map.of(
                "id", r.getId(),
                "name", r.getName(),
                "description", r.getDescription() != null ? r.getDescription() : "",
                "isSystem", r.isSystem(),
                "permissions", List.copyOf(r.getPermissions()),
                "createdAt", r.getCreatedAt().toString(),
                "updatedAt", r.getUpdatedAt().toString()
        );
    }

    private String permissionsJson(String roleId, Set<String> perms) {
        return "{\"roleId\":\"" + roleId + "\",\"permissions\":[" +
                perms.stream().map(p -> "\"" + p + "\"").collect(Collectors.joining(",")) +
                "]}";
    }

    private AuditLogEntity buildAudit(UUID actorId, String action,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(actorId);
        log.setAction(action);
        log.setResourceType("ADMIN_ROLE");
        // resource_id stays null: role IDs are String, not UUID
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }
}
