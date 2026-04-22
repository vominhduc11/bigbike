package com.bigbike.bigbike_backend.migration.wordpress.model;

/**
 * One row from kd_fg_redirect (FG Redirect plugin).
 * Column names are discovered from the CREATE TABLE in the dump.
 * Common schema: id, old_url, url, redirect_type (301/302), created.
 */
public record WpFgRedirect(long id, String oldUrl, String newUrl, int redirectCode) {}
