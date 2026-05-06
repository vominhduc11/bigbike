package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortParser;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class ContentReadService {

    private static final Set<String> ARTICLE_SORT_FIELDS = Set.of("publishedAt", "createdAt", "title");

    private final ContentReadRepository contentReadRepository;
    private final SortParser sortParser;

    public ContentReadService(ContentReadRepository contentReadRepository, SortParser sortParser) {
        this.contentReadRepository = contentReadRepository;
        this.sortParser = sortParser;
    }

    public PageResult<Article> listArticles(int page, int size, String sort, String category, String q) {
        SortSpec sortSpec = sortParser.parse(sort, "publishedAt", SortDirection.DESC, ARTICLE_SORT_FIELDS);

        Sort springSort = toSpringSort(sortSpec);
        org.springframework.data.domain.Pageable pageable = PageRequest.of(page - 1, size, springSort);

        org.springframework.data.domain.Page<Article> result =
                contentReadRepository.listPublishedArticles(
                        blankToNull(category), blankToNull(q), pageable);

        return toPageResult(result);
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

    public List<Page> listPublishedPages() {
        return contentReadRepository.findPagesByFilter(PublishStatus.PUBLISHED, null);
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
}
