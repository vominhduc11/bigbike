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
            int page,
            int size,
            String sort,
            String q,
            String search,
            String type,
            String publishStatus
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, CONTENT_SORT_FIELDS);
        String query = coalesceSearch(q, search);

        List<AdminContentItem> result = Stream.concat(
                        contentReadRepository.findAllArticles().stream().map(AdminContentReadService::fromArticle),
                        contentReadRepository.findAllPages().stream().map(AdminContentReadService::fromPage)
                )
                .filter(content -> matchesType(content, type))
                .filter(content -> matchesPublishStatus(content, publishStatus))
                .filter(content -> matchesQuery(content, query))
                .sorted(contentComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
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

    private static AdminContentItem fromArticle(Article article) {
        return new AdminContentItem(
                article.id(),
                "ARTICLE",
                article.slug(),
                article.title(),
                article.excerpt(),
                article.body(),
                article.coverImage(),
                article.publishStatus(),
                article.seo(),
                article.publishedAt(),
                article.createdAt(),
                article.updatedAt()
        );
    }

    private static AdminContentItem fromPage(Page page) {
        return new AdminContentItem(
                page.id(),
                "PAGE",
                page.slug(),
                page.title(),
                null,
                page.body(),
                null,
                page.publishStatus(),
                page.seo(),
                page.publishedAt(),
                page.createdAt(),
                page.updatedAt()
        );
    }

    private static String coalesceSearch(String q, String search) {
        if (q != null && !q.isBlank()) {
            return q;
        }
        return search;
    }

    private static String normalizeType(String type) {
        return type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
    }

    private static boolean matchesType(AdminContentItem content, String typeRaw) {
        if (typeRaw == null || typeRaw.isBlank()) {
            return true;
        }
        return content.type().equals(normalizeType(typeRaw));
    }

    private static boolean matchesPublishStatus(AdminContentItem content, String publishStatusRaw) {
        if (publishStatusRaw == null || publishStatusRaw.isBlank()) {
            return true;
        }
        return content.publishStatus() == PublishStatus.valueOf(publishStatusRaw);
    }

    private static boolean matchesQuery(AdminContentItem content, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String term = query.toLowerCase(Locale.ROOT);
        return content.title().toLowerCase(Locale.ROOT).contains(term)
                || content.slug().toLowerCase(Locale.ROOT).contains(term)
                || (content.excerpt() != null && content.excerpt().toLowerCase(Locale.ROOT).contains(term));
    }

    private static Comparator<AdminContentItem> contentComparator(SortSpec sortSpec) {
        Comparator<AdminContentItem> comparator = switch (sortSpec.field()) {
            case "title" -> Comparator.comparing(AdminContentItem::title, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(AdminContentItem::createdAt);
            case "updatedAt" -> Comparator.comparing(AdminContentItem::updatedAt);
            case "publishedAt" -> Comparator.comparing(content -> content.publishedAt() == null ? content.createdAt() : content.publishedAt());
            case "type" -> Comparator.comparing(AdminContentItem::type);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }
}
