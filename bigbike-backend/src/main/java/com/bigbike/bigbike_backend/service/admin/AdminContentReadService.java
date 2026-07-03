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
    private final com.bigbike.bigbike_backend.mapper.ArticleMapper articleMapper;

    @Transactional(readOnly = true)
    public PageResult<AdminContentItem> listContent(
            int page, int size, String sort, String q, String search, String type, String publishStatus, String lang) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, CONTENT_SORT_FIELDS);
        String query = coalesceSearch(q, search);
        PublishStatus statusFilter = parsePublishStatus(publishStatus);
        String locale = normalizeLocale(lang);
        org.springframework.data.domain.Page<Article> ap = contentReadRepository
                .listArticlesAdmin(statusFilter, query, toPageable(sortSpec, page, size), locale);
        return mapToPageResult(ap, articleMapper::toAdminContentItem);
    }

    @Transactional(readOnly = true)
    public AdminContentItem getContentByTypeAndId(String type, String id) {
        String normalizedType = normalizeType(type);
        return switch (normalizedType) {
            case "ARTICLE" -> contentReadRepository.findArticleById(id)
                    .map(articleMapper::toAdminContentItem)
                    .orElseThrow(() -> new NotFoundException("Content not found."));
            default -> throw new NotFoundException("Content not found.");
        };
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

}
