package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortParser;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class ContentReadService {

    private static final Set<String> ARTICLE_SORT_FIELDS = Set.of("publishedAt", "createdAt", "title");

    private final ContentReadRepository contentReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;

    public ContentReadService(
            ContentReadRepository contentReadRepository,
            SortParser sortParser,
            PaginationService paginationService
    ) {
        this.contentReadRepository = contentReadRepository;
        this.sortParser = sortParser;
        this.paginationService = paginationService;
    }

    public PageResult<Article> listArticles(int page, int size, String sort, String category, String q) {
        SortSpec sortSpec = sortParser.parse(sort, "publishedAt", SortDirection.DESC, ARTICLE_SORT_FIELDS);

        List<Article> result = contentReadRepository.findAllArticles().stream()
                .filter(article -> article.publishStatus() == PublishStatus.PUBLISHED)
                .filter(article -> matchesCategory(article, category))
                .filter(article -> matchesQuery(article, q))
                .sorted(articleComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    public Article getArticleBySlug(String slug) {
        return contentReadRepository.findArticleBySlug(slug)
                .filter(article -> article.publishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Article not found."));
    }

    public Page getPageBySlug(String slug) {
        return contentReadRepository.findPageBySlug(slug)
                .filter(page -> page.publishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Page not found."));
    }

    private static boolean matchesCategory(Article article, String categorySlug) {
        if (categorySlug == null || categorySlug.isBlank()) {
            return true;
        }
        if (article.category() != null && article.category().slug().equals(categorySlug)) {
            return true;
        }
        return article.categories() != null && article.categories().stream()
                .anyMatch(category -> category != null && category.slug().equals(categorySlug));
    }

    private static boolean matchesQuery(Article article, String q) {
        if (q == null || q.isBlank()) {
            return true;
        }
        String term = q.toLowerCase(Locale.ROOT);
        return article.title().toLowerCase(Locale.ROOT).contains(term)
                || (article.excerpt() != null && article.excerpt().toLowerCase(Locale.ROOT).contains(term));
    }

    private static Comparator<Article> articleComparator(SortSpec sortSpec) {
        Comparator<Article> comparator = switch (sortSpec.field()) {
            case "publishedAt" -> Comparator.comparing(article -> article.publishedAt() == null ? article.createdAt() : article.publishedAt());
            case "createdAt" -> Comparator.comparing(Article::createdAt);
            case "title" -> Comparator.comparing(Article::title, String.CASE_INSENSITIVE_ORDER);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }
}
