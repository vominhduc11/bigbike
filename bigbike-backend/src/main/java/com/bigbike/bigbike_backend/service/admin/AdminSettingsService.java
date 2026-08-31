package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.settings.AdminProductAssignmentResponse;
import com.bigbike.bigbike_backend.api.admin.dto.settings.AdminSiteSettingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.settings.BatchUpdateSettingsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.settings.PublicSiteSettingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.settings.UpdateSiteSettingRequest;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinition;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinitionRegistry;
import com.bigbike.bigbike_backend.service.admin.settings.SettingValueValidator;
import com.bigbike.bigbike_backend.service.review.invitation.ReviewInvitationLifecycleService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class AdminSettingsService {

    private static final int DEFAULT_SIZE = 50;
    private static final int MAX_SIZE = 200;
    private static final String MASKED_VALUE = "********";

    private final SiteSettingJpaRepository settingRepo;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final PaginationService paginationService;
    private final WebRevalidationService webRevalidationService;
    private final SettingDefinitionRegistry definitionRegistry;
    private final SettingValueValidator valueValidator;
    private final ReviewInvitationLifecycleService reviewInvitationLifecycleService;
    private final ObjectMapper objectMapper;

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminSiteSettingResponse> listSettings(
            int page, int size, String q, String group, Boolean isPublic
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Stream<SiteSettingEntity> stream = settingRepo.findAll().stream();

        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            stream = stream.filter(s ->
                    matchesQ(s.getSettingKey(), qLower) ||
                    matchesQ(s.getDescription(), qLower)
            );
        }
        if (group != null && !group.isBlank()) {
            stream = stream.filter(s -> group.equalsIgnoreCase(s.getSettingGroup()));
        }
        if (isPublic != null) {
            stream = stream.filter(s -> s.isPublic() == isPublic);
        }

        List<AdminSiteSettingResponse> items = stream
                .sorted((a, b) -> {
                    String ga = a.getSettingGroup() != null ? a.getSettingGroup() : "";
                    String gb = b.getSettingGroup() != null ? b.getSettingGroup() : "";
                    int cmp = ga.compareTo(gb);
                    return cmp != 0 ? cmp : a.getSettingKey().compareTo(b.getSettingKey());
                })
                .map(this::toAdminResponse)
                .toList();

        return paginationService.paginate(items, normalizedPage, normalizedSize);
    }

    // getByKey removed 2026-07-15 (AUD-068) with GET /admin/settings/{settingKey}.

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminSiteSettingResponse updateSetting(
            String settingKey, UUID adminId, boolean callerIsSuperAdmin, UpdateSiteSettingRequest req) {
        SiteSettingEntity entity = settingRepo.findBySettingKey(settingKey)
                .orElseThrow(() -> new NotFoundException("Setting not found: " + settingKey));

        Optional<SettingDefinition> defOpt = definitionRegistry.find(settingKey);

        // Editable gate (registry-only constraint)
        if (defOpt.map(d -> !d.editable()).orElse(false)) {
            throw ValidationException.fromField("settingKey", "READ_ONLY",
                    "Setting is read-only and cannot be modified.");
        }

        // Super-admin-only gate: keys flagged superAdminOnly (e.g. product_assign_*) can only be
        // written by a caller holding wildcard '*'. ADMIN (with settings.write) is blocked.
        requireSuperAdminForRestrictedKey(settingKey, defOpt, callerIsSuperAdmin);

        // Public allowlist gate: setting isPublic=true requires explicit allowlist entry
        if (Boolean.TRUE.equals(req.isPublic())) {
            if (definitionRegistry.matchesSensitiveFragment(settingKey)) {
                throw ValidationException.fromField("isPublic", "SENSITIVE_KEY",
                        "Sensitive settings (containing 'secret', 'password', 'token', 'privateKey') cannot be made public.");
            }
            boolean allowed = defOpt.map(SettingDefinition::publicAllowed).orElse(false);
            if (!allowed) {
                throw ValidationException.fromField("isPublic", "NOT_PUBLIC_ALLOWLISTED",
                        "Setting is not in the public allowlist; isPublic cannot be set to true.");
            }
        }

        // Type / range / format validation (only for keys we have definitions for)
        if (req.value() != null && defOpt.isPresent()) {
            valueValidator.validate(settingKey, req.value(), defOpt.get());
        }

        // English required when the setting is translatable + required in VI (TRANSLATION_RULE_002).
        if (defOpt.isPresent()) {
            String effectiveValueEn = req.valueEn() != null
                    ? (req.valueEn().isBlank() ? null : req.valueEn())
                    : entity.getSettingValueEn();
            valueValidator.validateRequiredEn(settingKey, effectiveValueEn, defOpt.get());
        }

        String before = snapshot(entity, definitionRegistry.isSensitive(settingKey));
        String oldValue = entity.getSettingValue();

        if (req.value() != null) {
            entity.setSettingValue(req.value());
        }
        // Presence-flag: omit valueEn → unchanged; send blank → clears the English value.
        if (req.valueEn() != null) {
            entity.setSettingValueEn(req.valueEn().isBlank() ? null : req.valueEn());
        }
        if (req.group() != null) {
            entity.setSettingGroup(req.group().isBlank() ? null : req.group());
        }
        if (req.isPublic() != null) {
            entity.setPublic(req.isPublic());
        }
        if (req.description() != null) {
            entity.setDescription(req.description().isBlank() ? null : req.description());
        }
        Instant now = Instant.now();
        entity.setUpdatedAt(now);
        settingRepo.save(entity);
        reviewInvitationLifecycleService.onSettingUpdated(
                settingKey, oldValue, entity.getSettingValue(), now);

        webRevalidationService.revalidate("settings");
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN",
                adminId,
                "SETTING_UPDATED",
                "SITE_SETTING",
                entity.getId(),
                before,
                snapshot(entity, definitionRegistry.isSensitive(settingKey))));

        return toAdminResponse(entity);
    }

    // ── Batch update ─────────────────────────────────────────────────────────

    private record PendingUpdate(SiteSettingEntity entity, String newValue, String newValueEn) {}

    @Transactional
    public List<AdminSiteSettingResponse> batchUpdateSettings(
            List<BatchUpdateSettingsRequest.BatchSettingUpdate> updates, UUID adminId, boolean callerIsSuperAdmin) {

        if (updates == null || updates.isEmpty()) {
            return List.of();
        }

        // Phase 1: validate every item before touching the DB
        List<PendingUpdate> pending = new ArrayList<>(updates.size());
        for (BatchUpdateSettingsRequest.BatchSettingUpdate upd : updates) {
            SiteSettingEntity entity = settingRepo.findBySettingKey(upd.key())
                    .orElseThrow(() -> new NotFoundException("Setting not found: " + upd.key()));

            Optional<SettingDefinition> defOpt = definitionRegistry.find(upd.key());

            if (defOpt.map(d -> !d.editable()).orElse(false)) {
                throw ValidationException.fromField("key", "READ_ONLY",
                        "Setting is read-only and cannot be modified: " + upd.key());
            }

            // Same super-admin-only gate as the single-update path.
            requireSuperAdminForRestrictedKey(upd.key(), defOpt, callerIsSuperAdmin);

            // CMS-008: The batch DTO (BatchSettingUpdate) carries only key+value and does NOT
            // expose an isPublic field, so the batch endpoint cannot accidentally set
            // isPublic=true. The sensitive-key guard in the single-update path is therefore
            // already the only entry-point for that mutation. No additional guard needed here;
            // the risk is structurally excluded by the DTO design.

            if (upd.value() != null && defOpt.isPresent()) {
                valueValidator.validate(upd.key(), upd.value(), defOpt.get());
            }

            // English required when the setting is translatable + required in VI (TRANSLATION_RULE_002).
            if (defOpt.isPresent()) {
                String effectiveValueEn = upd.valueEn() != null
                        ? (upd.valueEn().isBlank() ? null : upd.valueEn())
                        : entity.getSettingValueEn();
                valueValidator.validateRequiredEn(upd.key(), effectiveValueEn, defOpt.get());
            }

            pending.add(new PendingUpdate(entity, upd.value(), upd.valueEn()));
        }

        // Phase 2: apply mutations — all validation has passed
        List<AdminSiteSettingResponse> results = new ArrayList<>(pending.size());
        for (PendingUpdate p : pending) {
            SiteSettingEntity entity = p.entity();
            boolean sensitive = definitionRegistry.isSensitive(entity.getSettingKey());
            String before = snapshot(entity, sensitive);
            String oldValue = entity.getSettingValue();

            if (p.newValue() != null) {
                entity.setSettingValue(p.newValue());
            }
            if (p.newValueEn() != null) {
                entity.setSettingValueEn(p.newValueEn().isBlank() ? null : p.newValueEn());
            }
            Instant now = Instant.now();
            entity.setUpdatedAt(now);
            settingRepo.save(entity);
            reviewInvitationLifecycleService.onSettingUpdated(
                    entity.getSettingKey(), oldValue, entity.getSettingValue(), now);

            auditLogWriter.save(auditLogFactory.build(
                    "ADMIN",
                    adminId,
                    "SETTING_UPDATED",
                    "SITE_SETTING",
                    entity.getId(),
                    before,
                    snapshot(entity, sensitive)));
            results.add(toAdminResponse(entity));
        }

        webRevalidationService.revalidate("settings");
        return results;
    }

    // ── Product assignment guide (banner read) ─────────────────────────────────

    /**
     * Reads {@code product_assign_title} + {@code product_assign_roles} for the product/content
     * create-edit banner (same data, both screens). A missing, blank, or malformed
     * {@code product_assign_roles} value falls back to an empty role list rather than throwing —
     * this read sits on the hot path for every product/content editor open, gated only by
     * {@code products.read} so every role that can reach it must never see a 500 here.
     */
    public AdminProductAssignmentResponse getProductAssignment() {
        return new AdminProductAssignmentResponse(
                settingValueOrEmpty("product_assign_title"),
                parseAssignmentRoles(settingValueOrEmpty("product_assign_roles"))
        );
    }

    private List<AdminProductAssignmentResponse.RoleAssignmentDto> parseAssignmentRoles(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(rawJson,
                    new TypeReference<List<AdminProductAssignmentResponse.RoleAssignmentDto>>() {});
        } catch (JacksonException e) {
            return List.of();
        }
    }

    private String settingValueOrEmpty(String key) {
        return settingRepo.findBySettingKey(key)
                .map(SiteSettingEntity::getSettingValue)
                .orElse("");
    }

    // ── Public endpoint ───────────────────────────────────────────────────────

    public List<PublicSiteSettingResponse> listPublicSettings(String lang) {
        return settingRepo.findByIsPublic(true).stream()
                .filter(s -> isPubliclyExposable(s.getSettingKey()))
                .map(s -> new PublicSiteSettingResponse(
                        s.getSettingKey(),
                        pick(s.getSettingValue(), s.getSettingValueEn(), lang),
                        s.getSettingGroup()))
                .toList();
    }

    /** EN-with-Vietnamese-fallback per PRODUCT_RULE_002 for the storefront language. */
    private static String pick(String base, String en, String lang) {
        return "en".equalsIgnoreCase(lang) && en != null && !en.isBlank() ? en : base;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Defense-in-depth allowlist for the public endpoint. A row may have is_public=true in the DB
     * (e.g. seeded years ago) yet not be in the registry — we still refuse to expose it. Sensitive
     * fragments are always blocked, even if the registry ever marks one as public by mistake.
     */
    private boolean isPubliclyExposable(String key) {
        if (definitionRegistry.matchesSensitiveFragment(key)) return false;
        return definitionRegistry.find(key)
                .map(SettingDefinition::publicAllowed)
                .orElse(false);
    }

    /**
     * Blocks writes to keys flagged {@code superAdminOnly} (e.g. the {@code product_assign_*} group)
     * unless the caller holds wildcard {@code *} (SUPER_ADMIN). Even ADMIN (with {@code settings.write})
     * is rejected. No-op for unrestricted keys.
     */
    private void requireSuperAdminForRestrictedKey(
            String settingKey, Optional<SettingDefinition> defOpt, boolean callerIsSuperAdmin) {
        boolean restricted = defOpt.map(SettingDefinition::superAdminOnly).orElse(false);
        if (restricted && !callerIsSuperAdmin) {
            throw new ForbiddenException("Chỉ SUPER ADMIN mới được sửa cấu hình này: " + settingKey);
        }
    }

    private AdminSiteSettingResponse toAdminResponse(SiteSettingEntity s) {
        Optional<SettingDefinition> defOpt = definitionRegistry.find(s.getSettingKey());
        boolean sensitive = definitionRegistry.isSensitive(s.getSettingKey());
        String valueType = defOpt.map(d -> d.type().name()).orElse(null);
        boolean masked = sensitive && s.getSettingValue() != null && !s.getSettingValue().isEmpty();
        String displayValue = masked ? MASKED_VALUE : s.getSettingValue();
        boolean superAdminOnly = defOpt.map(SettingDefinition::superAdminOnly).orElse(false);
        return new AdminSiteSettingResponse(
                s.getId(), s.getSettingKey(), displayValue,
                masked ? null : s.getSettingValueEn(),
                s.getSettingGroup(), s.isPublic(), s.getDescription(),
                s.getCreatedAt(), s.getUpdatedAt(),
                valueType, sensitive, masked, superAdminOnly,
                defOpt.map(SettingDefinition::allowedValues).orElse(java.util.Set.of())
        );
    }

    private static String snapshot(SiteSettingEntity s, boolean sensitive) {
        String value = (sensitive && s.getSettingValue() != null && !s.getSettingValue().isEmpty())
                ? MASKED_VALUE : s.getSettingValue();
        return "{\"key\":\"" + escapeJson(s.getSettingKey()) +
               "\",\"value\":\"" + escapeJson(value) +
               "\",\"group\":\"" + escapeJson(s.getSettingGroup()) +
               "\",\"isPublic\":" + s.isPublic() + "}";
    }

    private static boolean matchesQ(String field, String qLower) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(qLower);
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
