package com.bigbike.bigbike_backend.migration.wordpress.model;

/**
 * One row from kd_term_taxonomy.
 * taxonomy values relevant to BigBike: product_cat, product_tag,
 * pwb-brand (Perfect WooCommerce Brands), nav_menu, category.
 */
public record WpTermTaxonomy(
        long termTaxonomyId,
        long termId,
        String taxonomy,
        String description,
        long parent,
        long count
) {}
