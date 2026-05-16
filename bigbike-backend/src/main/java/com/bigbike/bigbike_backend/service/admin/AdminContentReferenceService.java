package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.UpsertAuthorRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.content.ContentAuthorItem;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryItem;
import com.bigbike.bigbike_backend.domain.content.ContentPageRefItem;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentAuthorEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentAuthorJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminContentReferenceService {

    private final ContentAuthorJpaRepository authorJpaRepository;
    private final ContentCategoryJpaRepository categoryJpaRepository;
    private final PageJpaRepository pageJpaRepository;

    public AdminContentReferenceService(
            ObjectProvider<ContentAuthorJpaRepository> authorProvider,
            ObjectProvider<ContentCategoryJpaRepository> categoryProvider,
            ObjectProvider<PageJpaRepository> pageProvider
    ) {
        this.authorJpaRepository = authorProvider.getIfAvailable();
        this.categoryJpaRepository = categoryProvider.getIfAvailable();
        this.pageJpaRepository = pageProvider.getIfAvailable();
    }

    // --- Reference list endpoints (for form dropdowns) ---

    public List<ContentAuthorItem> listAuthors() {
        requireJpa();
        return authorJpaRepository.findAll().stream()
                .map(e -> new ContentAuthorItem(e.getId(), e.getName()))
                .sorted(java.util.Comparator.comparing(ContentAuthorItem::name))
                .toList();
    }

    public List<ContentCategoryItem> listCategories() {
        requireJpa();
        return categoryJpaRepository.findAll().stream()
                .map(e -> new ContentCategoryItem(e.getId(), e.getSlug(), e.getName()))
                .sorted(java.util.Comparator.comparing(ContentCategoryItem::name))
                .toList();
    }

    public List<ContentPageRefItem> listPageRefs() {
        requireJpa();
        return pageJpaRepository.findAll().stream()
                .filter(p -> p.getPublishStatus() != null)
                .map(p -> new ContentPageRefItem(p.getId(), p.getSlug(), p.getTitle()))
                .sorted(java.util.Comparator.comparing(ContentPageRefItem::title))
                .toList();
    }

    // --- Author CRUD ---

    @Transactional
    public ContentAuthorItem createAuthor(UpsertAuthorRequest request) {
        requireJpa();
        String name = trimRequired(request.getName());

        ContentAuthorEntity entity = new ContentAuthorEntity();
        entity.setId(generateId("author"));
        entity.setName(name);
        authorJpaRepository.save(entity);
        return new ContentAuthorItem(entity.getId(), entity.getName());
    }

    @Transactional
    public ContentAuthorItem updateAuthor(String authorId, UpsertAuthorRequest request) {
        requireJpa();
        ContentAuthorEntity entity = authorJpaRepository.findById(authorId)
                .orElseThrow(() -> new NotFoundException("Author not found."));
        entity.setName(trimRequired(request.getName()));
        authorJpaRepository.save(entity);
        return new ContentAuthorItem(entity.getId(), entity.getName());
    }

    // --- Category CRUD ---

    @Transactional
    public ContentCategoryItem createCategory(UpsertCategoryRequest request) {
        requireJpa();
        List<ApiErrorDetail> errors = new ArrayList<>();

        String slug = request.getSlug() == null ? null : request.getSlug().trim();
        String name = request.getName() == null ? null : request.getName().trim();

        if (slug != null && categoryJpaRepository.findBySlug(slug).isPresent()) {
            errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
        }
        AdminMutationValidators.throwIfErrors(errors);

        ContentCategoryEntity entity = new ContentCategoryEntity();
        entity.setId(generateId("cc"));
        entity.setSlug(slug);
        entity.setName(name);
        categoryJpaRepository.save(entity);
        return new ContentCategoryItem(entity.getId(), entity.getSlug(), entity.getName());
    }

    @Transactional
    public ContentCategoryItem updateCategory(String categoryId, UpsertCategoryRequest request) {
        requireJpa();
        ContentCategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = request.getSlug() == null ? null : request.getSlug().trim();
        String name = request.getName() == null ? null : request.getName().trim();

        if (slug != null && !slug.equals(entity.getSlug())) {
            categoryJpaRepository.findBySlug(slug).ifPresent(existing -> {
                if (!existing.getId().equals(categoryId)) {
                    errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
                }
            });
        }
        AdminMutationValidators.throwIfErrors(errors);

        if (slug != null) entity.setSlug(slug);
        if (name != null) entity.setName(name);
        categoryJpaRepository.save(entity);
        return new ContentCategoryItem(entity.getId(), entity.getSlug(), entity.getName());
    }

    // --- Helpers ---

    private void requireJpa() {
        if (authorJpaRepository == null || categoryJpaRepository == null || pageJpaRepository == null) {
            throw new com.bigbike.bigbike_backend.api.error.MutationNotImplementedException(
                    "Content reference APIs require JPA persistence profile.");
        }
    }

    private static String trimRequired(String value) {
        return value == null ? "" : value.trim();
    }

    private static String generateId(String prefix) {
        return prefix + "_" + java.util.UUID.randomUUID().toString().replace("-", "");
    }
}
