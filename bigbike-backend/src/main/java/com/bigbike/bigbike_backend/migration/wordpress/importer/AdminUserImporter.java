package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.auth.AdminRole;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressAdminUserMapper.MappedAdminUser;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Idempotent admin user importer. Upserts on email. Roles from wp_capabilities
 * are persisted to {@code admin_user_roles} via {@code AdminUserEntity.roles}.
 *
 * The legacy phpass hash is preserved in {@code password_hash} exactly as in
 * WordPress — the phpass verifier (Phase 2F) handles login. NEVER log the hash.
 */
@Component
public class AdminUserImporter implements DomainImporter {

    private final AdminUserJpaRepository adminUserRepo;

    public AdminUserImporter(AdminUserJpaRepository adminUserRepo) {
        this.adminUserRepo = adminUserRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.ADMIN_USERS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedAdminUser> items, MigrationExecutionOptions options) {

        int inserted = 0;
        int updated = 0;
        int skipped = 0;
        int failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedAdminUser mau : items) {
            if (mau.email() == null || mau.email().isBlank()) {
                skipped++;
                warnings.add("Admin sourceId=" + mau.sourceId() + " skipped — missing email");
                continue;
            }
            try {
                Optional<AdminUserEntity> existing = adminUserRepo.findByEmail(mau.email());
                AdminUserEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new AdminUserEntity();
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setEmail(mau.email());
                entity.setDisplayName(truncate(mau.displayName(), 255));
                entity.setStatus(mau.status() != null ? mau.status() : "ACTIVE");
                if (mau.legacyPasswordHash() != null && !mau.legacyPasswordHash().isBlank()) {
                    entity.setPasswordHash(mau.legacyPasswordHash());
                }
                // Legacy single-role column: pick the highest-ranked role for back-compat.
                entity.setRole(primaryRole(mau.roles()).name());
                entity.setRoles(new LinkedHashSet<>(mau.roles()));
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mau.warnings());

                if (!options.dryRun()) {
                    adminUserRepo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Admin sourceId=" + mau.sourceId() + ": " + e.getMessage());
                if (options.failFast()) {
                    throw new IllegalStateException(errors.get(errors.size() - 1), e);
                }
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.ADMIN_USERS, inserted, updated, skipped, failed, warnings, errors);
    }

    private static AdminRole primaryRole(Set<AdminRole> roles) {
        // Ordered by privilege high → low.
        for (AdminRole candidate : List.of(
                AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.SHOP_MANAGER,
                AdminRole.EDITOR, AdminRole.SEO_EDITOR, AdminRole.AUTHOR, AdminRole.CONTRIBUTOR)) {
            if (roles.contains(candidate)) {
                return candidate;
            }
        }
        return AdminRole.CONTRIBUTOR;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
