package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import com.bigbike.bigbike_backend.migration.wordpress.importer.TaxonomyRef;

/**
 * Maps WordPress blog posts (post_type=post) to MappedArticle records.
 * SEO: RankMath first, Yoast fallback.
 * URL pattern: /tin-tuc/{slug}.html
 */
@Component
public class WordPressArticleMapper {

    public record MappedArticle(
            long sourceId,
            long authorSourceId,
            String authorName,
            String slug,
            String title,
            String excerpt,
            String content,
            LocalDateTime publishedAt,
            String status,
            String seoTitle,
            String seoDescription,
            List<TaxonomyRef> categories,
            List<TaxonomyRef> tags,
            String expectedUrl,
            List<String> warnings
    ) {}

    public MappedArticle map(WpPost post, List<WpPostMeta> metas) {
        List<String> warnings = new ArrayList<>();

        Map<String, String> meta = metas.stream()
                .filter(m -> m.postId() == post.id())
                .filter(m -> m.metaKey() != null).collect(Collectors.toMap(WpPostMeta::metaKey, m -> m.metaValue() != null ? m.metaValue() : "", (a, b) -> a));

        if (post.postName() == null || post.postName().isBlank()) {
            warnings.add("Empty slug for article id=" + post.id());
        }
        if (post.postTitle() == null || post.postTitle().isBlank()) {
            warnings.add("Empty title for article id=" + post.id());
        }

        String seoTitle = firstNonBlank(
                meta.get("rank_math_title"),
                meta.get("_yoast_wpseo_title")
        );
        String seoDescription = firstNonBlank(
                meta.get("rank_math_description"),
                meta.get("_yoast_wpseo_metadesc")
        );

        String status = mapStatus(post.postStatus());
        String expectedUrl = "/tin-tuc/" + post.postName() + ".html";

        return new MappedArticle(
                post.id(),
                post.authorId(),
                null,
                post.postName(),
                post.postTitle(),
                post.postExcerpt(),
                post.postContent(),
                post.postDate(),
                status,
                seoTitle,
                seoDescription,
                List.of(),
                List.of(),
                expectedUrl,
                warnings
        );
    }

    private String mapStatus(String postStatus) {
        return switch (postStatus == null ? "" : postStatus) {
            case "publish" -> "PUBLISHED";
            case "draft"   -> "DRAFT";
            case "trash"   -> "ARCHIVED";
            case "private" -> "DRAFT";
            default        -> "DRAFT";
        };
    }

    private String firstNonBlank(String... candidates) {
        for (String s : candidates) {
            if (s != null && !s.isBlank()) return s;
        }
        return null;
    }
}
