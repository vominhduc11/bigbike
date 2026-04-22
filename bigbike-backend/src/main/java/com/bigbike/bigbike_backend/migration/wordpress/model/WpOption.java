package com.bigbike.bigbike_backend.migration.wordpress.model;

/** One row from kd_options. */
public record WpOption(long optionId, String optionName, String optionValue, String autoload) {}
