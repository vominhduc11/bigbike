package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryJpaRepository extends JpaRepository<CategoryEntity, String> {
    Optional<CategoryEntity> findBySlug(String slug);
}
