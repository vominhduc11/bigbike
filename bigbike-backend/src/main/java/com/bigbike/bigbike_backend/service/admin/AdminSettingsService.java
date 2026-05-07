package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.settings.AdminSiteSettingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.settings.PublicSiteSettingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.settings.UpdateSiteSettingRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinition;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinitionRegistry;
import com.bigbike.bigbike_backend.service.admin.settings.SettingValueValidator;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSettingsService {

    private static final int DEFAULT_SIZE = 50;
    private static final int MAX_SIZE = 200;
    private static final String MASKED_VALUE = "********";

    private final SiteSettingJpaRepository settingRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;
    private final WebRevalidationService webRevalidationService;
    private final SettingDefinitionRegistry definitionRegistry;
    private final SettingValueValidator valueValidator;

    public AdminSettingsService(
            SiteSettingJpaRepository settingRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService,
            WebRevalidationService webRevalidationService,
            SettingDefinitionRegistry definitionRegistry,
            SettingValueValidator valueValidator
    ) {
        this.settingRepo = settingRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
        this.webRevalidationService = webRevalidationService;
        this.definitionRegistry = definitionRegistry;
        this.valueValidator = valueValidator;
    }

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

    // ── Get by key ────────────────────────────────────────────────────────────

    public AdminSiteSettingResponse getByKey(String settingKey) {
        SiteSettingEntity entity = settingRepo.findBySettingKey(settingKey)
                .orElseThrow(() -> new NotFoundException("Setting not found: " + settingKey));
        return toAdminResponse(entity);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminSiteSettingResponse updateSetting(String settingKey, UUID adminId, UpdateSiteSettingRequest req) {
        SiteSettingEntity entity = settingRepo.findBySettingKey(settingKey)
                .orElseThrow(() -> new NotFoundException("Setting not found: " + settingKey));

        Optional<SettingDefinition> defOpt = definitionRegistry.find(settingKey);

        // Editable gate (registry-only constraint)
        if (defOpt.map(d -> !d.editable()).orElse(false)) {
            throw ValidationException.fromField("settingKey", "READ_ONLY",
                    "Setting is read-only and cannot be modified.");
        }

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

        String before = snapshot(entity);

        if (req.value() != null) {
            entity.setSettingValue(req.value());
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
        entity.setUpdatedAt(Instant.now());
        settingRepo.save(entity);

        webRevalidationService.revalidate("settings");
        auditLogRepo.save(buildAudit(adminId, "SETTING_UPDATED", entity.getId(), before, snapshot(entity)));

        return toAdminResponse(entity);
    }

    // ── Public endpoint ───────────────────────────────────────────────────────

    public List<PublicSiteSettingResponse> listPublicSettings() {
        return settingRepo.findByIsPublic(true).stream()
                .filter(s -> isPubliclyExposable(s.getSettingKey()))
                .map(s -> new PublicSiteSettingResponse(s.getSettingKey(), s.getSettingValue(), s.getSettingGroup()))
                .toList();
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

    private AdminSiteSettingResponse toAdminResponse(SiteSettingEntity s) {
        Optional<SettingDefinition> defOpt = definitionRegistry.find(s.getSettingKey());
        boolean sensitive = definitionRegistry.isSensitive(s.getSettingKey());
        String valueType = defOpt.map(d -> d.type().name()).orElse(null);
        boolean masked = sensitive && s.getSettingValue() != null && !s.getSettingValue().isEmpty();
        String displayValue = masked ? MASKED_VALUE : s.getSettingValue();
        return new AdminSiteSettingResponse(
                s.getId(), s.getSettingKey(), displayValue,
                s.getSettingGroup(), s.isPublic(), s.getDescription(),
                s.getCreatedAt(), s.getUpdatedAt(),
                valueType, sensitive, masked
        );
    }

    private AuditLogEntity buildAudit(UUID adminId, String action, UUID resourceId,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType("SITE_SETTING");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    private static String snapshot(SiteSettingEntity s) {
        return "{\"key\":\"" + escapeJson(s.getSettingKey()) +
               "\",\"value\":\"" + escapeJson(s.getSettingValue()) +
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
