package com.bigbike.bigbike_backend.migration.wordpress.model;

/** One row from kd_term_relationships. Links a post/object to a term taxonomy entry. */
public record WpTermRelationship(long objectId, long termTaxonomyId, int termOrder) {}
