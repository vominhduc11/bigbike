package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.domain.content.ContentCategoryItem;

import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
public class AdminContentReferenceService {

    private final ContentCategoryJpaRepository categoryJpaRepository;

    public AdminContentReferenceService(
            ObjectProvider<ContentCategoryJpaRepository> categoryProvider
    ) {
        this.categoryJpaRepository = categoryProvider.getIfAvailable();
    }

    // --- Reference list endpoint (for the article editor's category dropdown) ---

    public List<ContentCategoryItem> listCategories() {
        requireJpa();
        return categoryJpaRepository.findAll().stream()
                .map(e -> new ContentCategoryItem(e.getId(), e.getSlug(), e.getName()))
                .sorted(java.util.Comparator.comparing(ContentCategoryItem::name))
                .toList();
    }

    // --- Helpers ---

    private void requireJpa() {
        if (categoryJpaRepository == null) {
            throw new com.bigbike.bigbike_backend.api.error.MutationNotImplementedException(
                    "Content reference APIs require JPA persistence profile.");
        }
    }
}
