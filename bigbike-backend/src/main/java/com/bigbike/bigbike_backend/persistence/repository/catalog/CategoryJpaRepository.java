package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CategoryJpaRepository
        extends JpaRepository<CategoryEntity, String>, JpaSpecificationExecutor<CategoryEntity> {
    Optional<CategoryEntity> findBySlug(String slug);

    /**
     * Count visible children of a parent. Used by the hide-guard so we don't
     * have to scan the entire categories table on every soft-delete or
     * visibility patch.
     */
    long countByParent_IdAndIsVisibleTrue(String parentId);
    long countByParent_Id(String parentId);
    java.util.List<CategoryEntity> findByParent_Id(String parentId);
}
