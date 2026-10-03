package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ArticleRecommendations;
import com.bigbike.bigbike_backend.mapper.ArticleMapper;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ArticleRecommendationService {

    private static final int FEATURED_LIMIT = 5;
    private static final int RELATED_LIMIT = 4;

    private final ArticleJpaRepository articleJpaRepository;
    private final ArticleMapper articleMapper;

    @Transactional(readOnly = true)
    public ArticleRecommendations getRecommendations(String slug, String locale) {
        ArticleEntity currentArticle = articleJpaRepository.findBySlug(slug)
                .or(() -> articleJpaRepository.findBySlugEn(slug))
                .filter(article -> article.getPublishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Article not found."));
        List<ArticleEntity> publishedArticles = articleJpaRepository.findByPublishStatus(PublishStatus.PUBLISHED);

        Comparator<ArticleEntity> newestFirst = Comparator
                .comparing(ArticleRecommendationService::publicationInstant, Comparator.reverseOrder())
                .thenComparing(ArticleEntity::getId);

        Set<String> excludedIds = new HashSet<>();
        excludedIds.add(currentArticle.getId());
        List<ArticleEntity> manuallyFeatured = publishedArticles.stream()
                .filter(ArticleEntity::isFeatured)
                .filter(article -> !excludedIds.contains(article.getId()))
                .sorted(newestFirst)
                .limit(FEATURED_LIMIT)
                .toList();
        List<ArticleEntity> featured = manuallyFeatured.isEmpty()
                ? publishedArticles.stream()
                        .filter(article -> !excludedIds.contains(article.getId()))
                        .sorted(newestFirst)
                        .limit(FEATURED_LIMIT)
                        .toList()
                : manuallyFeatured;
        featured.forEach(article -> excludedIds.add(article.getId()));

        List<Article> related = publishedArticles.stream()
                .filter(article -> !excludedIds.contains(article.getId()))
                .sorted(newestFirst)
                .limit(RELATED_LIMIT)
                .map(article -> articleMapper.toDomain(article, normalizeLocale(locale), false))
                .toList();
        List<Article> featuredArticles = featured.stream()
                .map(article -> articleMapper.toDomain(article, normalizeLocale(locale), false))
                .toList();
        return new ArticleRecommendations(featuredArticles, related);
    }

    private static Instant publicationInstant(ArticleEntity article) {
        if (article.getPublishedAt() != null) return article.getPublishedAt();
        if (article.getCreatedAt() != null) return article.getCreatedAt();
        return Instant.EPOCH;
    }

    private static String normalizeLocale(String locale) {
        return "en".equalsIgnoreCase(locale) ? "en" : "vi";
    }
}
