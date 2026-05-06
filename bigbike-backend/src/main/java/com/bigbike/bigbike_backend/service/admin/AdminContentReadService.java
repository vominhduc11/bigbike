package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
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
import java.util.stream.Stream;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class AdminContentReadService {

    private static final Set<String> CONTENT_SORT_FIELDS = Set.of("title", "createdAt", "updatedAt", "publishedAt", "type");

    private final ContentReadRepository contentReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;

    public AdminContentReadService(
            ContentReadRepository contentReadRepository,
            SortParser sortParser,
            PaginationService paginationService
    ) {
        this.contentReadRepository = contentReadRepository;
        this.sortParser = sortParser;
        this.paginationService = paginationService;
    }

    public PageResult<AdminContentItem> listContent(
            int page, int size, String sort, String q, String search, String type, String publishStatus) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, CONTENT_SORT_FIELDS);
        String query = coalesceSearch(q, search);
        PublishStatus statusFilter = parsePublishStatus(publishStatus);
        String normalizedType = normalizeType(type);

        if ("ARTICLE".equals(normalizedType)) {
            org.springframework.data.domain.Page<Article> ap = contentReadRepository
                    .listArticlesAdmin(statusFilter, query, toPageable(sortSpec, page, size));
            return mapToPageResult(ap, AdminContentReadService::fromArticle);
        }
        if ("PAGE".equals(normalizedType)) {
            org.springframework.data.domain.Page<Page> pp = contentReadRepository
                    .listPagesAdmin(statusFilter, query, toPageable(sortSpec, page, size));
            return mapToPageResult(pp, AdminContentReadService::fromPage);
        }

        // Combined: load filtered articles + pages from DB, merge+sort+paginate in Java
        List<AdminContentItem> articles = contentReadRepository
                .findArticlesByFilter(statusFilter, query)
                .stream().map(AdminContentReadService::fromArticle).toList();
        List<AdminContentItem> pages = contentReadRepository
                .findPagesByFilter(statusFilter, query)
                .stream().map(AdminContentReadService::fromPage).toList();

        List<AdminContentItem> merged = Stream.concat(articles.stream(), pages.stream())
                .sorted(contentComparator(sortSpec))
                .toList();

        return paginationService.paginate(merged, page, size);
    }

    public AdminContentItem getContentByTypeAndId(String type, String id) {
        String normalizedType = normalizeType(type);
        return switch (normalizedType) {
            case "ARTICLE" -> contentReadRepository.findArticleById(id)
                    .map(AdminContentReadService::fromArticle)
                    .orElseThrow(() -> new NotFoundException("Content not found."));
            case "PAGE" -> contentReadRepository.findPageById(id)
                    .map(AdminContentReadService::fromPage)
                    .orElseThrow(() -> new NotFoundException("Content not found."));
            default -> throw new NotFoundException("Content not found.");
        };
    }

    static AdminContentItem fromArticle(Article article) {
        return new AdminContentItem(
                article.id(),
                "ARTICLE",
                article.slug(),
                article.title(),
                article.excerpt(),
                article.body(),
                article.coverImage(),
                article.productImage(),
                article.publishStatus(),
                article.seo(),
                article.publishedAt(),
                article.createdAt(),
                article.updatedAt(),
                article.tags(),
                article.author(),
                article.author() != null ? article.author().id() : null,
                article.category(),
                article.category() != null ? article.category().id() : null,
                article.categories(),
                null,
                null
        );
    }

    static AdminContentItem fromPage(Page page) {
        return new AdminContentItem(
                page.id(),
                "PAGE",
                page.slug(),
                page.title(),
                null,
                page.body(),
                null,
                null,
                page.publishStatus(),
                page.seo(),
                page.publishedAt(),
                page.createdAt(),
                page.updatedAt(),
                null,
                null,
                null,
                null,
                null,
                null,
                page.type(),
                page.parentId()
        );
    }

    // --- Helpers ---

    private static org.springframework.data.domain.Pageable toPageable(SortSpec spec, int page, int size) {
        Sort.Direction dir = spec.direction() == SortDirection.ASC ? Sort.Direction.ASC : Sort.Direction.DESC;
        String field = mapSortField(spec.field());
        return PageRequest.of(page - 1, size, Sort.by(dir, field));
    }

    private static String mapSortField(String field) {
        // "type" is not a DB column — fall back to updatedAt for combined sort
        return "type".equals(field) ? "updatedAt" : field;
    }

    private static <S> PageResult<AdminContentItem> mapToPageResult(
            org.springframework.data.domain.Page<S> springPage,
            java.util.function.Function<S, AdminContentItem> mapper) {
        return new PageResult<>(
                springPage.getContent().stream().map(mapper).toList(),
                springPage.getNumber() + 1,
                springPage.getSize(),
                springPage.getTotalElements(),
                springPage.getTotalPages()
        );
    }

    private static String coalesceSearch(String q, String search) {
        if (q != null && !q.isBlank()) return q;
        return search;
    }

    private static String normalizeType(String type) {
        return type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
    }

    private static PublishStatus parsePublishStatus(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return PublishStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
    }

    private static Comparator<AdminContentItem> contentComparator(SortSpec sortSpec) {
        Comparator<AdminContentItem> comparator = switch (sortSpec.field()) {
            case "title" -> Comparator.comparing(AdminContentItem::title, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(AdminContentItem::createdAt);
            case "updatedAt" -> Comparator.comparing(AdminContentItem::updatedAt);
            case "publishedAt" -> Comparator.comparing(
                    content -> content.publishedAt() == null ? content.createdAt() : content.publishedAt());
            case "type" -> Comparator.comparing(AdminContentItem::type);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }
}
