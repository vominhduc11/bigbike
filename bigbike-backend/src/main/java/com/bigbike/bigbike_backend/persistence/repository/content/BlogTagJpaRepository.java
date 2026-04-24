package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.persistence.entity.content.BlogTagEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlogTagJpaRepository extends JpaRepository<BlogTagEntity, String> {
    Optional<BlogTagEntity> findBySlug(String slug);
}
