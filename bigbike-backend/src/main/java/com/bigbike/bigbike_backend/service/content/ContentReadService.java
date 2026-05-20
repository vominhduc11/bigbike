package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortParser;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ContentReadService {

    private static final Set<String> ARTICLE_SORT_FIELDS = Set.of("publishedAt", "createdAt", "title");

    private final ContentReadRepository contentReadRepository;
    private final SortParser sortParser;

    public PageResult<Article> listArticles(int page, int size, String sort, String category, String q, String lang) {
        SortSpec sortSpec = sortParser.parse(sort, "publishedAt", SortDirection.DESC, ARTICLE_SORT_FIELDS);

        Sort springSort = toSpringSort(sortSpec);
        org.springframework.data.domain.Pageable pageable = PageRequest.of(page - 1, size, springSort);

        org.springframework.data.domain.Page<Article> result =
                contentReadRepository.listPublishedArticles(
                        blankToNull(category), blankToNull(q), pageable, resolvedLang(lang));

        return toPageResult(result);
    }

    public Article getArticleBySlug(String slug, String lang) {
        return contentReadRepository.findArticleBySlug(slug, resolvedLang(lang))
                .filter(article -> article.publishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Article not found."));
    }

    public Page getPageBySlug(String slug, String lang) {
        return contentReadRepository.findPageBySlug(slug, resolvedLang(lang))
                .filter(page -> page.publishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Page not found."));
    }

    public List<Page> listPublishedPages() {
        return contentReadRepository.findPagesByFilter(PublishStatus.PUBLISHED, null);
    }

    /** Content (news) categories with their PUBLISHED-article counts, for the Tin tức filter. */
    public List<ContentCategoryWithCount> listContentCategories() {
        return contentReadRepository.listContentCategoriesWithCounts();
    }

    private static Sort toSpringSort(SortSpec spec) {
        Sort.Direction dir = spec.direction() == SortDirection.ASC ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(dir, spec.field());
    }

    private static <T> PageResult<T> toPageResult(org.springframework.data.domain.Page<T> springPage) {
        return new PageResult<>(
                springPage.getContent(),
                springPage.getNumber() + 1,
                springPage.getSize(),
                springPage.getTotalElements(),
                springPage.getTotalPages()
        );
    }

    private static String blankToNull(String s) {
        return (s != null && !s.isBlank()) ? s.trim() : null;
    }

    private static String resolvedLang(String lang) {
        return "en".equals(lang) ? "en" : "vi";
    }
}
