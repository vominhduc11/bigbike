package com.bigbike.bigbike_backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ArticleRecommendations;
import com.bigbike.bigbike_backend.mapper.ArticleMapper;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ArticleRecommendationServiceTest {

    private ArticleJpaRepository articleRepository;
    private ArticleMapper articleMapper;
    private ArticleRecommendationService service;

    @BeforeEach
    void setUp() {
        articleRepository = mock(ArticleJpaRepository.class);
        articleMapper = mock(ArticleMapper.class);
        service = new ArticleRecommendationService(articleRepository, articleMapper);
        when(articleMapper.toDomain(any(ArticleEntity.class), eq("vi"), eq(false)))
                .thenAnswer(invocation -> toArticle(invocation.getArgument(0)));
    }

    @Test
    void usesManualFeaturedPicksNewestFirstAndNeverDuplicatesGroups() {
        ArticleEntity current = published("current", "current", "2026-09-20T00:00:00Z", true);
        ArticleEntity selectedOlder = published("selected-older", "selected-older", "2026-09-01T00:00:00Z", true);
        ArticleEntity selectedNewer = published("selected-newer", "selected-newer", "2026-09-12T00:00:00Z", true);
        ArticleEntity selectedThird = published("selected-third", "selected-third", "2026-09-10T00:00:00Z", true);
        ArticleEntity latest = published("latest", "latest", "2026-09-19T00:00:00Z", false);
        ArticleEntity relatedNext = published("related-next", "related-next", "2026-09-18T00:00:00Z", false);
        ArticleEntity relatedThird = published("related-third", "related-third", "2026-09-17T00:00:00Z", false);

        List<ArticleEntity> published = List.of(
                current, selectedOlder, selectedNewer, selectedThird, latest, relatedNext, relatedThird);
        when(articleRepository.findBySlug("current")).thenReturn(Optional.of(current));
        when(articleRepository.findByPublishStatus(PublishStatus.PUBLISHED)).thenReturn(published);

        ArticleRecommendations result = service.getRecommendations("current", "vi");

        assertThat(ids(result.featured()))
                .containsExactly("selected-newer", "selected-third", "selected-older");
        assertThat(ids(result.related())).containsExactly("latest", "related-next", "related-third");
        assertThat(ids(result.featured())).doesNotContain("current");
        assertThat(ids(result.related())).doesNotContain("current");
        Set<String> overlap = ids(result.featured()).stream()
                .filter(ids(result.related())::contains)
                .collect(Collectors.toSet());
        assertThat(overlap).isEmpty();
    }

    @Test
    void fallsBackToNewestWhenNoEligibleManualFeaturedArticleRemains() {
        ArticleEntity current = published("current", "current", "2026-09-20T00:00:00Z", true);
        ArticleEntity newest = published("newest", "newest", "2026-09-19T00:00:00Z", false);
        ArticleEntity middle = published("middle", "middle", "2026-09-18T00:00:00Z", false);
        ArticleEntity older = published("older", "older", "2026-09-17T00:00:00Z", false);
        List<ArticleEntity> published = List.of(current, newest, middle, older);
        when(articleRepository.findBySlug("current")).thenReturn(Optional.of(current));
        when(articleRepository.findByPublishStatus(PublishStatus.PUBLISHED)).thenReturn(published);

        ArticleRecommendations result = service.getRecommendations("current", "vi");

        assertThat(ids(result.featured())).containsExactly("newest", "middle", "older");
        assertThat(result.related()).isEmpty();
    }

    private static ArticleEntity published(String id, String slug, String publishedAt, boolean featured) {
        ArticleEntity article = new ArticleEntity();
        article.setId(id);
        article.setSlug(slug);
        article.setTitle(slug);
        article.setBody("<p>Body</p>");
        article.setPublishStatus(PublishStatus.PUBLISHED);
        article.setFeatured(featured);
        article.setPublishedAt(Instant.parse(publishedAt));
        article.setCreatedAt(Instant.parse(publishedAt));
        article.setUpdatedAt(Instant.parse(publishedAt));
        return article;
    }

    private static Article toArticle(ArticleEntity entity) {
        return new Article(
                entity.getId(),
                entity.getSlug(),
                entity.getSlugEn(),
                entity.getTitle(),
                entity.getBody(),
                null,
                null,
                entity.getPublishStatus(),
                entity.isFeatured(),
                entity.isHomeExperience(),
                null,
                null,
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                null);
    }

    private static List<String> ids(List<Article> articles) {
        return articles.stream().map(Article::id).toList();
    }
}
