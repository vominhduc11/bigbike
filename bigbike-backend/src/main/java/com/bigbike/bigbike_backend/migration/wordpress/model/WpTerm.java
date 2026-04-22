package com.bigbike.bigbike_backend.migration.wordpress.model;

/** One row from kd_terms. */
public record WpTerm(long termId, String name, String slug, long termGroup) {}
