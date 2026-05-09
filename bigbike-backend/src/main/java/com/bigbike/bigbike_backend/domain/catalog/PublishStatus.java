package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Publish states for products and content items (articles and pages).
 *
 * <p><strong>Active states (valid for admin API mutations):</strong>
 * {@link #DRAFT}, {@link #PUBLISHED}, {@link #HIDDEN}, {@link #TRASH}.
 *
 * <p><strong>Reserved / legacy — not valid as target states for admin API mutations:</strong>
 * <ul>
 *   <li>{@link #ARCHIVED} — legacy value; migrated to {@link #HIDDEN}. Use {@link #HIDDEN}.</li>
 *   <li>{@link #PENDING} — WordPress import artifact; migrated to {@link #DRAFT}.</li>
 *   <li>{@link #PRIVATE} — WordPress import artifact; migrated to {@link #DRAFT}.</li>
 * </ul>
 *
 * <p>See {@code AdminMutationValidators.validatePublishTransition} for the allowed
 * state-machine transitions.
 */
public enum PublishStatus {
    DRAFT,
    PUBLISHED,
    HIDDEN,
    /**
     * Soft-delete marker. Valid as a transition target from active states, or as a
     * transition source back to {@link #DRAFT} (restore). Cannot be used as an initial
     * creation state.
     */
    TRASH,
    /**
     * Reserved — legacy value migrated to {@link #HIDDEN}. Not a valid target state for
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
    PRIVATE
}

