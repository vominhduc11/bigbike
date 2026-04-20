package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArticleJpaRepository extends JpaRepository<ArticleEntity, String> {
    Optional<ArticleEntity> findBySlug(String slug);
}
