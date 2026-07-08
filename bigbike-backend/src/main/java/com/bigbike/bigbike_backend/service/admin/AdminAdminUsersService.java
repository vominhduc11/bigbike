package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminAccountStatusService;
import com.bigbike.bigbike_backend.service.auth.AdminInviteService;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.LinkedHashMap;
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

    private static final Set<String> VALID_STATUSES = Set.of("INVITED", "ACTIVE", "DISABLED", "SUSPENDED");

    private static final String SUPER_ADMIN = "SUPER_ADMIN";

    /**
     * A {@code null} actorRole means there was no JWT principal (dev/test header-auth path),
     * which is off in production — treat it as trusted so it bypasses the tier guards.
     */
    private static boolean isSuperAdminActor(String actorRole) {
        return actorRole == null || SUPER_ADMIN.equals(actorRole);
    }

    private final AdminUserJpaRepository adminUserRepo;
    private final AdminRoleJpaRepository adminRoleRepo;
    private final AuditLogWriter auditLogWriter;
    private final PaginationService paginationService;
    private final PasswordService passwordService;
    private final AdminInviteService adminInviteService;
    private final AdminAccountStatusService adminAccountStatusService;

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

    /**
     * Creates an admin user by email invite — no password is set here. The account starts
     * {@code INVITED} (cannot log in) and an invite email with a set-password link is sent.
     */
    @Transactional
    public Map<String, Object> createAdminUser(UUID actorId, String actorRole, String clientIp, String userAgent,
            String email, String displayName, String role) {
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
        // Privilege-tier guard: only a SUPER_ADMIN may grant the SUPER_ADMIN role.
        if (SUPER_ADMIN.equals(normalizedRole) && !isSuperAdminActor(actorRole)) {
            throw new ForbiddenException("Only a SUPER_ADMIN can grant the SUPER_ADMIN role.");
        }

        Instant now = Instant.now();
        AdminUserEntity entity = new AdminUserEntity();
        entity.setEmail(normalizedEmail);
        entity.setDisplayName(displayName.trim());
        entity.setRole(normalizedRole);
        entity.setStatus("INVITED");
        // No password yet — set by the invitee when accepting the invite.
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        AdminUserEntity saved = adminUserRepo.save(entity);

        AdminInviteService.InviteResult invite = adminInviteService.issueInvite(saved);

        String afterData = "{\"email\":\"" + escapeJson(saved.getEmail())
                + "\",\"role\":\"" + saved.getRole()
                + "\",\"status\":\"INVITED\"}";
        auditLogWriter.save(buildAudit(actorId, clientIp, userAgent, "ADMIN_USER_INVITED", saved.getId(), null, afterData, now));

        return withInvite(toMap(saved), invite);
    }

    /** Resends the invite email for an INVITED admin user. */
    @Transactional
    public Map<String, Object> resendInvite(UUID actorId, String clientIp, String userAgent, UUID id) {
        AdminUserEntity user = adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found."));
        AdminInviteService.InviteResult invite = adminInviteService.resendInvite(id);
        auditLogWriter.save(buildAudit(actorId, clientIp, userAgent, "ADMIN_USER_INVITE_RESENT", id, null,
                "{\"email\":\"" + escapeJson(user.getEmail()) + "\"}", Instant.now()));
        return withInvite(toMap(user), invite);
    }

    private Map<String, Object> withInvite(Map<String, Object> base, AdminInviteService.InviteResult invite) {
        Map<String, Object> result = new LinkedHashMap<>(base);
        result.put("inviteEmailSent", invite.emailSent());
        // Surface the link only when mail isn't configured, so a Super Admin can deliver it manually.
        if (!invite.emailSent()) {
            result.put("inviteUrl", invite.inviteUrl());
        }
        return result;
    }

    @Transactional
    public Map<String, Object> updateAdminUser(UUID actorId, String actorRole, String clientIp, String userAgent,
            UUID id, String displayName, String status, String newPassword, String role) {
        AdminUserEntity entity = adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found."));

        String beforeRole = entity.getRole();
        String beforeStatus = entity.getStatus();
        String beforeDisplayName = entity.getDisplayName();
        boolean targetIsSuperAdmin = SUPER_ADMIN.equals(entity.getRole());

        // --- Privilege-tier guard: a non-SUPER_ADMIN must not be able to touch a
        // SUPER_ADMIN account at all (blocks password-reset takeover, status lockout,
        // and demotion of the top tier by a lower tier holding admin-users.write). ---
        if (targetIsSuperAdmin && !isSuperAdminActor(actorRole)) {
            throw new ForbiddenException("Only a SUPER_ADMIN can modify a SUPER_ADMIN account.");
        }

        // --- Guards: validate BEFORE applying changes ---
        if (status != null && !status.isBlank()) {
            String normalizedStatus = status.trim().toUpperCase(Locale.ROOT);
            if (!VALID_STATUSES.contains(normalizedStatus)) {
                throw new ConflictException("Invalid status: " + normalizedStatus + ". Must be ACTIVE, DISABLED or SUSPENDED.");
            }
            if (id.equals(actorId) && !"ACTIVE".equals(normalizedStatus)) {
                throw new ConflictException("Admin cannot deactivate their own account.");
            }
            // Cannot disable/suspend the last active SUPER_ADMIN (extends the demote
            // guard from role-change to status-change).
            if (targetIsSuperAdmin && "ACTIVE".equals(beforeStatus) && !"ACTIVE".equals(normalizedStatus)) {
                long activeSuperAdmins = adminUserRepo.countByRoleAndStatus(SUPER_ADMIN, "ACTIVE");
                if (activeSuperAdmins <= 1) {
                    throw new ConflictException("Cannot disable the last active SUPER_ADMIN.");
                }
            }
        }
        if (role != null && !role.isBlank()) {
            String normalizedRole = role.trim().toUpperCase(Locale.ROOT);
            if (!isValidRole(normalizedRole)) {
                throw new ConflictException("Invalid role: " + normalizedRole);
            }
            // Only a SUPER_ADMIN may grant the SUPER_ADMIN role (blocks promotion escalation).
            if (SUPER_ADMIN.equals(normalizedRole) && !targetIsSuperAdmin && !isSuperAdminActor(actorRole)) {
                throw new ForbiddenException("Only a SUPER_ADMIN can grant the SUPER_ADMIN role.");
            }
            if (id.equals(actorId) && targetIsSuperAdmin && !SUPER_ADMIN.equals(normalizedRole)) {
                throw new ConflictException("SUPER_ADMIN cannot demote themselves.");
            }
            if (targetIsSuperAdmin && !SUPER_ADMIN.equals(normalizedRole)) {
                // RBAUD-008: use targeted DB count instead of findAll() full table scan
                long superAdminCount = adminUserRepo.countByRoleAndStatus(SUPER_ADMIN, "ACTIVE");
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

        // --- Audit: one entry per distinct kind of change, so "vô hiệu hoá / tạm khoá /
        // đổi vai trò" show up as their own action instead of a generic ADMIN_USER_UPDATED
        // that's hard to tell apart when scanning the log. Never log raw password.
        boolean roleChanged = !Objects.equals(beforeRole, saved.getRole());
        boolean statusChanged = !Objects.equals(beforeStatus, saved.getStatus());
        boolean displayNameChanged = !Objects.equals(beforeDisplayName, saved.getDisplayName());
        boolean anyAuditWritten = false;

        // Invalidate the cached role/status snapshot so a lock/suspend/demote takes effect on this
        // admin's very next request instead of surviving until their access token expires.
        if (roleChanged || statusChanged) {
            adminAccountStatusService.evict(id);
        }

        if (roleChanged) {
            auditLogWriter.save(buildAudit(actorId, clientIp, userAgent, "ADMIN_USER_ROLE_CHANGED", id,
                    "{\"role\":\"" + escapeJson(beforeRole) + "\"}",
                    "{\"role\":\"" + escapeJson(saved.getRole()) + "\"}", now));
            anyAuditWritten = true;
        }
        if (statusChanged) {
            String statusAction = switch (saved.getStatus()) {
                case "DISABLED" -> "ADMIN_USER_DISABLED";
                case "SUSPENDED" -> "ADMIN_USER_SUSPENDED";
                default -> "ADMIN_USER_REACTIVATED";
            };
            auditLogWriter.save(buildAudit(actorId, clientIp, userAgent, statusAction, id,
                    "{\"status\":\"" + escapeJson(beforeStatus) + "\"}",
                    "{\"status\":\"" + escapeJson(saved.getStatus()) + "\"}", now));
            anyAuditWritten = true;
        }
        if (displayNameChanged || passwordChanged) {
            StringBuilder beforeSb = new StringBuilder("{");
            StringBuilder afterSb = new StringBuilder("{");
            boolean first = true;
            if (displayNameChanged) {
                beforeSb.append("\"displayName\":\"").append(escapeJson(beforeDisplayName)).append("\"");
                afterSb.append("\"displayName\":\"").append(escapeJson(saved.getDisplayName())).append("\"");
                first = false;
            }
            if (passwordChanged) {
                if (!first) afterSb.append(",");
                afterSb.append("\"passwordChanged\":true");
            }
            beforeSb.append("}");
            afterSb.append("}");
            auditLogWriter.save(buildAudit(actorId, clientIp, userAgent, "ADMIN_USER_UPDATED", id,
                    beforeSb.toString(), afterSb.toString(), now));
            anyAuditWritten = true;
        }
        if (!anyAuditWritten) {
            // No-op patch (nothing actually changed) — still record the attempt.
            auditLogWriter.save(buildAudit(actorId, clientIp, userAgent, "ADMIN_USER_UPDATED", id, "{}", "{}", now));
        }

        return toMap(saved);
    }

    private boolean isValidRole(String normalizedRole) {
        // DB-driven: a role is valid iff it exists in admin_roles (system roles seeded by
        // Flyway + any custom roles). No hardcoded list — so it can never drift when the
        // built-in role set changes (e.g. V211 reduced it from 7 to 4).
        return adminRoleRepo.existsById(normalizedRole);
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
