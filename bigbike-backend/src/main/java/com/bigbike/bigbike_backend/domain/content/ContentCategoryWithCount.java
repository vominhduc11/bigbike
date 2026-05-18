package com.bigbike.bigbike_backend.domain.content;

/**
 * A content (news) category plus the number of PUBLISHED articles in it.
 * Powers the Tin tức category filter (desktop sidebar + mobile drawer).
 */
public record ContentCategoryWithCount(String id, String slug, String name, long articleCount) {
}
