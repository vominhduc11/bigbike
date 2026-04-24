package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContentCategoryJpaRepository extends JpaRepository<ContentCategoryEntity, String> {
    Optional<ContentCategoryEntity> findBySlug(String slug);
}
