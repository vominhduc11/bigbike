package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Maps WordPress page posts to MappedPage records.
 * SEO: RankMath metadata takes priority over Yoast fallback.
 */
@Component
public class WordPressPageMapper {

    public record MappedPage(
            long sourceId,
            Long parentSourceId,
            String slug,
            String title,
            String content,
            String status,
            String seoTitle,
            String seoDescription,
            String expectedUrl,
            List<String> unmappedMeta,
            List<String> warnings
    ) {}

    public MappedPage map(WpPost post, List<WpPostMeta> metas) {
        List<String> warnings = new ArrayList<>();
        List<String> unmapped = new ArrayList<>();

        Map<String, String> meta = metas.stream()
                .filter(m -> m.postId() == post.id())
                .filter(m -> m.metaKey() != null).collect(Collectors.toMap(WpPostMeta::metaKey, m -> m.metaValue() != null ? m.metaValue() : "", (a, b) -> a));

        if (post.postName() == null || post.postName().isBlank()) {
            warnings.add("Empty slug for page id=" + post.id());
        }
        if (post.postTitle() == null || post.postTitle().isBlank()) {
            warnings.add("Empty title for page id=" + post.id());
        }
        if (post.postContent() == null || post.postContent().isBlank()) {
            warnings.add("Empty content for page id=" + post.id());
        }

        // SEO: RankMath first, Yoast fallback
        String seoTitle = firstNonBlank(
                meta.get("rank_math_title"),
                meta.get("_yoast_wpseo_title")
        );
        String seoDescription = firstNonBlank(
                meta.get("rank_math_description"),
                meta.get("_yoast_wpseo_metadesc")
        );

        String status = mapStatus(post.postStatus());
        String expectedUrl = buildPageUrl(post.postName());

        return new MappedPage(
                post.id(),
                post.postParent() > 0 ? post.postParent() : null,
                post.postName(),
                post.postTitle(),
                post.postContent(),
                status,
                seoTitle,
                seoDescription,
                expectedUrl,
                unmapped,
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

    private String buildPageUrl(String slug) {
        if (slug == null || slug.isBlank()) return null;
        return "/" + slug + ".html";
    }

    private String firstNonBlank(String... candidates) {
        for (String s : candidates) {
            if (s != null && !s.isBlank()) return s;
        }
        return null;
    }
}
