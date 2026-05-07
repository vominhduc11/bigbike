package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
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

    private final AdminRoleJpaRepository roleRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final AdminPermissionService adminPermissionService;

    public AdminRoleService(AdminRoleJpaRepository roleRepo, AuditLogJpaRepository auditLogRepo,
            AdminPermissionService adminPermissionService) {
        this.roleRepo = roleRepo;
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

        Set<String> before = new LinkedHashSet<>(role.getPermissions());
        role.setPermissions(new LinkedHashSet<>(permissions));
        role.setUpdatedAt(Instant.now());
        AdminRoleEntity saved = roleRepo.save(role);

        adminPermissionService.evict(saved.getId());

        auditLogRepo.save(buildAudit(actorId, "ROLE_PERMISSIONS_UPDATED", role.getId(),
                permissionsJson(role.getId(), before), permissionsJson(role.getId(), saved.getPermissions())));

        return toMap(saved);
    }

    @Transactional
    public Map<String, Object> createRole(String id, String name, String description, Set<String> permissions, UUID actorId) {
        if (id == null || id.isBlank()) {
            throw new ConflictException("Role ID must not be blank.");
        }
        if (name == null || name.isBlank()) {
            throw new ConflictException("Role name must not be blank.");
        }
        String normalizedId = id.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", "_");
        if (roleRepo.existsById(normalizedId)) {
            throw new ConflictException("Role already exists: " + normalizedId);
        }

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

        auditLogRepo.save(buildAudit(actorId, "ROLE_CREATED", saved.getId(),
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

        Set<String> before = new LinkedHashSet<>(role.getPermissions());
        roleRepo.delete(role);

        adminPermissionService.evict(role.getId());

        auditLogRepo.save(buildAudit(actorId, "ROLE_DELETED", role.getId(),
                permissionsJson(role.getId(), before), null));
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

    private AuditLogEntity buildAudit(UUID actorId, String action, String roleId,
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
