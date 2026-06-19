package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactPageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.contact.SaveContactPageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.settings.BatchUpdateSettingsRequest.BatchSettingUpdate;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.public_.dto.PublicContactBlockResponse;
import com.bigbike.bigbike_backend.domain.content.ContactBlock;
import com.bigbike.bigbike_backend.persistence.entity.content.ContactPageLayoutEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ContactPageLayoutJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminSettingsService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-managed layout of the public contact page ({@code /lien-he}).
 *
 * <p>The block list (layout) lives in the singleton {@code contact_page_layout} row. Values of
 * channels bound to a shared {@code contact} setting are <em>not</em> stored on the block — they
 * stay in {@code site_settings} (single source shared with header/footer) and are written through
 * here via {@link AdminSettingsService}, gated by a hard whitelist so a {@code content.update}
 * editor can edit them without holding {@code settings.write}.
 */
@Service
@RequiredArgsConstructor
public class ContactPageService {

    /**
     * The only {@code site_settings} keys the contact-page endpoint may write through. Editors reach
     * this path with {@code content.update} only; the whitelist keeps that scoped to contact data.
     */
    public static final Set<String> WRITE_THROUGH_KEYS = Set.of(
            "hotline", "hotline_2", "hotline_3",
            "contact_email", "contact_address",
            "zalo_url", "facebook_url", "messenger_url",
            "instagram_url", "youtube_url", "tiktok_url",
            "opening_hours_weekday", "opening_hours_weekend", "opening_hours_holiday"
    );

    private final ContactPageLayoutJpaRepository layoutRepo;
    private final SiteSettingJpaRepository settingRepo;
    private final AdminSettingsService adminSettingsService;
    private final WebRevalidationService webRevalidationService;

    // ── Admin read ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminContactPageResponse getForAdmin() {
        List<ContactBlock> blocks = sortedBlocks(loadBlocks());
        List<AdminContactPageResponse.SettingValue> values = WRITE_THROUGH_KEYS.stream()
                .sorted()
                .map(key -> settingRepo.findBySettingKey(key)
                        .map(s -> new AdminContactPageResponse.SettingValue(
                                key, s.getSettingValue(), s.getSettingValueEn()))
                        .orElse(new AdminContactPageResponse.SettingValue(key, "", null)))
                .toList();
        return new AdminContactPageResponse(blocks, values);
    }

    // ── Public read ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PublicContactBlockResponse> listPublicBlocks(String lang) {
        boolean en = "en".equalsIgnoreCase(lang);
        return sortedBlocks(loadBlocks()).stream()
                .filter(ContactBlock::enabled)
                .map(b -> new PublicContactBlockResponse(
                        b.type(),
                        b.column() == null || b.column().isBlank() ? "main" : b.column(),
                        b.sortOrder() == null ? 0 : b.sortOrder(),
                        b.icon(),
                        pick(b.labelVi(), b.labelEn(), en),
                        b.bindKey(),
                        b.value(),
                        b.href(),
                        pick(b.htmlVi(), b.htmlEn(), en)))
                .toList();
    }

    // ── Save ────────────────────────────────────────────────────────────────────

    @Transactional
    public AdminContactPageResponse save(SaveContactPageRequest req, UUID adminId, boolean callerIsSuperAdmin) {
        // 1. Normalise blocks: bound blocks never carry a literal value/href (those come from settings).
        List<ContactBlock> blocks = new ArrayList<>();
        for (ContactBlock b : req.blocks()) {
            if (b.bindKey() != null && !b.bindKey().isBlank() && !WRITE_THROUGH_KEYS.contains(b.bindKey())) {
                throw ValidationException.fromField("bindKey", "INVALID_BIND_KEY",
                        "Unknown contact setting key: " + b.bindKey());
            }
            boolean bound = b.bindKey() != null && !b.bindKey().isBlank();
            blocks.add(new ContactBlock(
                    b.id(), b.type(), b.enabled(), b.sortOrder(),
                    b.column() == null || b.column().isBlank() ? "main" : b.column(),
                    b.icon(), b.labelVi(), b.labelEn(),
                    bound ? b.bindKey() : null,
                    bound ? null : b.value(),
                    bound ? null : b.href(),
                    "richtext".equals(b.type()) ? b.htmlVi() : null,
                    "richtext".equals(b.type()) ? b.htmlEn() : null));
        }

        // 2. Write through bound setting values (whitelist-guarded) before persisting the layout.
        if (req.values() != null && !req.values().isEmpty()) {
            List<BatchSettingUpdate> updates = new ArrayList<>();
            for (SaveContactPageRequest.SettingValueInput v : req.values()) {
                if (!WRITE_THROUGH_KEYS.contains(v.key())) {
                    throw ValidationException.fromField("values", "INVALID_SETTING_KEY",
                            "Setting key is not editable from the contact page: " + v.key());
                }
                updates.add(new BatchSettingUpdate(v.key(), v.value(), v.valueEn()));
            }
            // Reuses settings validation (phone/url/email format) + audit + "settings" revalidation.
            adminSettingsService.batchUpdateSettings(updates, adminId, callerIsSuperAdmin);
        }

        // 3. Persist the layout (singleton row).
        ContactPageLayoutEntity entity = layoutRepo.findById(ContactPageLayoutEntity.SINGLETON_ID)
                .orElseGet(() -> {
                    ContactPageLayoutEntity fresh = new ContactPageLayoutEntity();
                    fresh.setId(ContactPageLayoutEntity.SINGLETON_ID);
                    return fresh;
                });
        entity.setBlocks(blocks);
        entity.setUpdatedAt(Instant.now());
        layoutRepo.save(entity);

        // 4. Refresh the storefront contact page (and settings, already queued by step 2) after commit.
        webRevalidationService.revalidate("page:lien-he", "settings");

        return getForAdmin();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private List<ContactBlock> loadBlocks() {
        return layoutRepo.findById(ContactPageLayoutEntity.SINGLETON_ID)
                .map(ContactPageLayoutEntity::getBlocks)
                .orElseGet(List::of);
    }

    private static List<ContactBlock> sortedBlocks(List<ContactBlock> blocks) {
        if (blocks == null) return List.of();
        return blocks.stream()
                .sorted(Comparator.comparingInt(b -> b.sortOrder() == null ? 0 : b.sortOrder()))
                .toList();
    }

    /** EN-with-Vietnamese-fallback, matching the storefront language rule used across settings/pages. */
    private static String pick(String vi, String en, boolean english) {
        return english && en != null && !en.isBlank() ? en : vi;
    }
}
