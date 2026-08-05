package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOption;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermRelationship;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermTaxonomy;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressTableRow;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Reads only the WordPress tables allowed by the live migration contract. */
final class LiveWordPressSnapshotReader {

    private static final DateTimeFormatter WP_DATETIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final WordPressSqlDumpRowReader rowReader;

    LiveWordPressSnapshotReader(WordPressSqlDumpRowReader rowReader) {
        this.rowReader = rowReader;
    }

    Snapshot read(Path dumpPath, String prefix) throws IOException {
        String posts = prefix + "posts";
        String postmeta = prefix + "postmeta";
        String terms = prefix + "terms";
        String termTaxonomy = prefix + "term_taxonomy";
        String termRelationships = prefix + "term_relationships";
        String rankMath = prefix + "rank_math_redirections";
        String fgRedirect = prefix + "fg_redirect";
        String options = prefix + "options";

        Set<String> targetTables = Set.of(
                posts, postmeta, terms, termTaxonomy, termRelationships,
                rankMath, fgRedirect, options);

        Map<Long, WpPost> postsById = new LinkedHashMap<>();
        Map<Long, LocalDateTime> postModifiedGmtById = new LinkedHashMap<>();
        Map<Long, List<WpPostMeta>> metaByPost = new HashMap<>();
        Map<Long, WpTerm> termsById = new LinkedHashMap<>();
        Map<Long, WpTermTaxonomy> taxonomyById = new LinkedHashMap<>();
        List<WpTermRelationship> relationships = new ArrayList<>();
        List<WpRedirectRow> rankMathRedirects = new ArrayList<>();
        List<WpFgRedirect> fgRedirects = new ArrayList<>();
        Map<String, String> optionValues = new LinkedHashMap<>();

        List<String> warnings = rowReader.stream(dumpPath, targetTables, (table, row) -> {
            if (posts.equals(table)) {
                WpPost value = toPost(row);
                if (value != null && value.id() > 0) {
                    postsById.put(value.id(), value);
                    LocalDateTime modifiedGmt = parseDateTime(row.get("post_modified_gmt"));
                    if (modifiedGmt != null) postModifiedGmtById.put(value.id(), modifiedGmt);
                }
            } else if (postmeta.equals(table)) {
                WpPostMeta value = toPostMeta(row);
                if (value != null && value.postId() > 0) {
                    metaByPost.computeIfAbsent(value.postId(), ignored -> new ArrayList<>()).add(value);
                }
            } else if (terms.equals(table)) {
                WpTerm value = toTerm(row);
                if (value != null && value.termId() > 0) termsById.put(value.termId(), value);
            } else if (termTaxonomy.equals(table)) {
                WpTermTaxonomy value = toTaxonomy(row);
                if (value != null && value.termTaxonomyId() > 0) {
                    taxonomyById.put(value.termTaxonomyId(), value);
                }
            } else if (termRelationships.equals(table)) {
                WpTermRelationship value = toRelationship(row);
                if (value != null) relationships.add(value);
            } else if (rankMath.equals(table)) {
                WpRedirectRow value = toRankMathRedirect(row);
                if (value != null) rankMathRedirects.add(value);
            } else if (fgRedirect.equals(table)) {
                WpFgRedirect value = toFgRedirect(row);
                if (value != null) fgRedirects.add(value);
            } else if (options.equals(table)) {
                WpOption value = toOption(row);
                if (value != null && value.optionName() != null) {
                    optionValues.put(value.optionName(), value.optionValue());
                }
            }
        });

        Map<Long, List<WpTermRelationship>> relationshipsByObject = new HashMap<>();
        for (WpTermRelationship relationship : relationships) {
            relationshipsByObject
                    .computeIfAbsent(relationship.objectId(), ignored -> new ArrayList<>())
                    .add(relationship);
        }

        return new Snapshot(
                Map.copyOf(postsById), Map.copyOf(postModifiedGmtById),
                immutableLists(metaByPost), Map.copyOf(termsById),
                Map.copyOf(taxonomyById), immutableLists(relationshipsByObject),
                List.copyOf(rankMathRedirects), List.copyOf(fgRedirects),
                Map.copyOf(optionValues), List.copyOf(warnings));
    }

    private static <K, V> Map<K, List<V>> immutableLists(Map<K, List<V>> input) {
        Map<K, List<V>> result = new HashMap<>();
        input.forEach((key, value) -> result.put(key, List.copyOf(value)));
        return Map.copyOf(result);
    }

    record Snapshot(
            Map<Long, WpPost> postsById,
            Map<Long, LocalDateTime> postModifiedGmtById,
            Map<Long, List<WpPostMeta>> metaByPost,
            Map<Long, WpTerm> termsById,
            Map<Long, WpTermTaxonomy> taxonomyById,
            Map<Long, List<WpTermRelationship>> relationshipsByObject,
            List<WpRedirectRow> rankMathRedirects,
            List<WpFgRedirect> fgRedirects,
            Map<String, String> options,
            List<String> warnings) {

        List<WpPost> postsOfType(String type) {
            return postsById.values().stream()
                    .filter(post -> type.equals(post.postType()))
                    .sorted(Comparator.comparingLong(WpPost::id))
                    .toList();
        }

        Map<String, String> meta(long postId) {
            Map<String, String> result = new LinkedHashMap<>();
            for (WpPostMeta value : metaByPost.getOrDefault(postId, List.of())) {
                if (value.metaKey() != null) result.putIfAbsent(value.metaKey(), value.metaValue());
            }
            return result;
        }

        LocalDateTime postModifiedGmt(long postId) {
            return postModifiedGmtById.get(postId);
        }

        List<TaxonomyTerm> taxonomyTerms(long objectId, String taxonomy) {
            Set<Long> seen = new LinkedHashSet<>();
            List<TaxonomyTerm> result = new ArrayList<>();
            for (WpTermRelationship relationship : relationshipsByObject.getOrDefault(objectId, List.of())) {
                WpTermTaxonomy tax = taxonomyById.get(relationship.termTaxonomyId());
                if (tax == null || !taxonomy.equals(tax.taxonomy()) || !seen.add(tax.termId())) continue;
                WpTerm term = termsById.get(tax.termId());
                if (term != null) result.add(new TaxonomyTerm(term, tax));
            }
            return List.copyOf(result);
        }

        Map<Long, String> attachmentPaths() {
            Map<Long, String> result = new LinkedHashMap<>();
            for (WpPost attachment : postsOfType("attachment")) {
                String path = meta(attachment.id()).get("_wp_attached_file");
                if (path != null && !path.isBlank()) result.put(attachment.id(), path.trim());
            }
            return Map.copyOf(result);
        }

        record TaxonomyTerm(WpTerm term, WpTermTaxonomy taxonomy) {}
    }

    private WpPost toPost(WordPressTableRow row) {
        try {
            return new WpPost(
                    row.getLong("ID", 0), row.getLong("post_author", 0),
                    parseDateTime(row.get("post_date")), parseDateTime(row.get("post_date_gmt")),
                    nvl(row.get("post_content")), nvl(row.get("post_title")),
                    nvl(row.get("post_excerpt")), nvl(row.get("post_status")),
                    nvl(row.get("comment_status")), nvl(row.get("post_name")),
                    nvl(row.get("post_type")), row.getLong("post_parent", 0),
                    row.getInt("menu_order", 0), nvl(row.get("guid")),
                    nvl(row.get("post_mime_type")), row.getLong("comment_count", 0));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private WpPostMeta toPostMeta(WordPressTableRow row) {
        return new WpPostMeta(row.getLong("meta_id", 0), row.getLong("post_id", 0),
                row.get("meta_key"), row.get("meta_value"));
    }

    private WpTerm toTerm(WordPressTableRow row) {
        return new WpTerm(row.getLong("term_id", 0), nvl(row.get("name")),
                nvl(row.get("slug")), row.getLong("term_group", 0));
    }

    private WpTermTaxonomy toTaxonomy(WordPressTableRow row) {
        return new WpTermTaxonomy(
                row.getLong("term_taxonomy_id", 0), row.getLong("term_id", 0),
                nvl(row.get("taxonomy")), nvl(row.get("description")),
                row.getLong("parent", 0), row.getLong("count", 0));
    }

    private WpTermRelationship toRelationship(WordPressTableRow row) {
        return new WpTermRelationship(row.getLong("object_id", 0),
                row.getLong("term_taxonomy_id", 0), row.getInt("term_order", 0));
    }

    private WpRedirectRow toRankMathRedirect(WordPressTableRow row) {
        String sources = row.get("sources");
        return new WpRedirectRow(
                row.getLong("id", 0), sources, nvl(row.get("url_to")),
                row.getInt("header_code", 301), nvl(row.get("status")),
                WordPressRedirectMapper.parseFirstSourcePattern(sources));
    }

    private WpFgRedirect toFgRedirect(WordPressTableRow row) {
        return new WpFgRedirect(row.get("old_url"),
                row.getLong("ID", row.getLong("id", 0)), row.get("type"),
                row.getInt("activated", 1) != 0);
    }

    private WpOption toOption(WordPressTableRow row) {
        return new WpOption(row.getLong("option_id", 0), row.get("option_name"),
                row.get("option_value"), row.get("autoload"));
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank() || value.startsWith("0000")) return null;
        try {
            return LocalDateTime.parse(value, WP_DATETIME);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String nvl(String value) {
        return value == null ? "" : value;
    }
}
