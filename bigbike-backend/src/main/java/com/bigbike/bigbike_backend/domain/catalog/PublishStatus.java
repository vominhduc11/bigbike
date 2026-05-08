package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Publish states for content items (articles and pages).
 *
 * <p><strong>Valid content states:</strong> {@link #DRAFT}, {@link #PUBLISHED},
 * {@link #HIDDEN}, {@link #ARCHIVED}, {@link #TRASH}.
 *
 * <p><strong>Reserved / not valid for new content:</strong>
 * <ul>
 *   <li>{@link #PENDING} — imported from WordPress pending-review queue; not a valid target
 *       state for content created or updated via the BigBike admin API.</li>
 *   <li>{@link #PRIVATE} — imported from WordPress private posts; not a valid target state
 *       for content created or updated via the BigBike admin API.</li>
 *   <li>{@link #TRASH} — soft-delete marker. Content can be moved TO trash from active states,
 *       and restored FROM trash back to DRAFT. It cannot be used as an initial creation state.</li>
 * </ul>
 *
 * <p>See {@code AdminMutationValidators.validatePublishTransition} for the allowed
 * state-machine transitions.
 */
public enum PublishStatus {
    DRAFT,
    PUBLISHED,
    HIDDEN,
    ARCHIVED,
    /**
     * Reserved — WordPress import artifact. Not a valid target state for admin API mutations.
     * Use {@link #DRAFT} for unpublished content awaiting review.
     */
    PENDING,
    /**
     * Reserved — WordPress import artifact. Not a valid target state for admin API mutations.
     * Use {@link #HIDDEN} to hide published content without deleting it.
     */
    PRIVATE,
    /**
     * Soft-delete marker. Valid only as a transition target from active states, or as a
     * transition source back to {@link #DRAFT} (restore). Cannot be used as an initial
     * creation state.
     */
    TRASH
}

