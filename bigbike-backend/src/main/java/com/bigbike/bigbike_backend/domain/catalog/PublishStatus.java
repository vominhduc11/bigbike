package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Publish states for products and content items (articles and pages).
 *
 * <p><strong>Active states (valid for admin API mutations):</strong>
 * {@link #DRAFT}, {@link #PUBLISHED}, {@link #TRASH}.
 *
 * <p><strong>Reserved / legacy — not valid as target states for admin API mutations:</strong>
 * {@link #HIDDEN}, {@link #ARCHIVED}, {@link #PENDING}, {@link #PRIVATE}. All four are legacy
 * values migrated to {@link #DRAFT} (see {@code V324__migrate_legacy_hidden_publish_status.sql}
 * and the earlier {@code V87__migrate_legacy_publish_statuses.sql}) — kept only so historical
 * DB rows / audit-log entries still deserialize. Use {@link #DRAFT}.
 *
 * <p>See {@code AdminMutationValidators.validatePublishTransition} for the allowed
 * state-machine transitions, and {@link #isLegacy()} for the single legacy-detection check
 * shared by the validator and {@code ProductImportService}.
 */
public enum PublishStatus {
    DRAFT,
    PUBLISHED,
    /**
     * Reserved — legacy value migrated to {@link #DRAFT} (V324, 2026-07-07). Was previously an
     * active/settable state (and, before that, the migration target for {@link #ARCHIVED}); no
     * longer a valid target state for admin API mutations.
     */
    HIDDEN,
    /**
     * Soft-delete marker. Valid as a transition target from active states, or as a
     * transition source back to {@link #DRAFT} (restore). Cannot be used as an initial
     * creation state.
     */
    TRASH,
    /**
     * Reserved — legacy value migrated to {@link #DRAFT}. Not a valid target state for
     * admin API mutations.
     */
    ARCHIVED,
    /**
     * Reserved — WordPress import artifact migrated to {@link #DRAFT}. Not a valid target
     * state for admin API mutations.
     */
    PENDING,
    /**
     * Reserved — WordPress import artifact migrated to {@link #DRAFT}. Not a valid target
     * state for admin API mutations.
     */
    PRIVATE;

    /**
     * True for every legacy/reserved value — not a valid target state for admin API mutations
     * (rejected by {@code AdminMutationValidators.validatePublishTransition} with
     * {@code RESERVED_PUBLISH_STATUS}, and treated as invalid/skip-with-warning by
     * {@code ProductImportService} on update-existing-product import). Single source of truth
     * so the two call sites can't drift apart.
     */
    public boolean isLegacy() {
        return this == HIDDEN || this == ARCHIVED || this == PENDING || this == PRIVATE;
    }
}
