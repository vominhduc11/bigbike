package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminContentReadService {

    private static final Set<String> CONTENT_SORT_FIELDS =
            Set.of("title", "createdAt", "updatedAt", "publishedAt", "type", "publishStatus");

    private final ContentReadRepository contentReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;

    @Transactional(readOnly = true)
    public PageResult<AdminContentItem> listContent(
            int page, int size, String sort, String q, String search, String type, String publishStatus, String lang) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, CONTENT_SORT_FIELDS);
        String query = coalesceSearch(q, search);
        PublishStatus statusFilter = parsePublishStatus(publishStatus);
        String normalizedType = normalizeType(type);
        String locale = normalizeLocale(lang);
        // Admin VI/EN switch (strict English): ở EN, repo đã lọc bỏ mục chưa có title_en
        // qua findArticlesByFilter. DB pagination (listArticlesAdmin) không lọc theo
        // title_en nên ở EN ta đi qua nhánh filter + phân trang trong Java (số lượng nhỏ)
        // để đếm trang đúng sau khi ẩn mục chưa dịch.
        boolean strictEnglish = "en".equals(locale);

        // Content giờ chỉ còn Bài viết (Tin tức) — module Trang tĩnh đã gỡ. Tham số type
        // được giữ tương thích nhưng mọi nhánh đều trả về bài viết.
        if (strictEnglish) {
            List<AdminContentItem> items = contentReadRepository.findArticlesByFilter(statusFilter, query, locale)
                    .stream().map(AdminContentReadService::fromArticle)
                    .sorted(contentComparator(sortSpec)).toList();
            return paginationService.paginate(items, page, size);
        }
        org.springframework.data.domain.Page<Article> ap = contentReadRepository
                .listArticlesAdmin(statusFilter, query, toPageable(sortSpec, page, size), locale);
        return mapToPageResult(ap, AdminContentReadService::fromArticle);
    }

    @Transactional(readOnly = true)
    public AdminContentItem getContentByTypeAndId(String type, String id) {
        String normalizedType = normalizeType(type);
        return switch (normalizedType) {
            case "ARTICLE" -> contentReadRepository.findArticleById(id)
                    .map(AdminContentReadService::fromArticle)
                    .orElseThrow(() -> new NotFoundException("Content not found."));
            default -> throw new NotFoundException("Content not found.");
        };
    }

    static AdminContentItem fromArticle(Article article) {
        return new AdminContentItem(
                article.id(),
                "ARTICLE",
                article.slug(),
                article.slugEn(),
                article.title(),
                article.excerpt(),
                article.body(),
                article.coverImage(),
                article.productImage(),
                article.publishStatus(),
                article.featured(),
                article.homeExperience(),
                article.seo(),
                article.publishedAt(),
                article.createdAt(),
                article.updatedAt(),
                article.category(),
                article.category() != null ? article.category().id() : null,
                article.categories(),
                null,
                null,
                null,
                null,
                null,
                article.bodyBlocks(),
                article.translations()
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

    /** Normalize the requested content language to the repository locale ("vi" default, "en"). */
    private static String normalizeLocale(String lang) {
        return "en".equalsIgnoreCase(lang) ? "en" : "vi";
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
            case "publishStatus" -> Comparator.comparing(
                    AdminContentItem::publishStatus, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }
}
