package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PageJpaRepository extends JpaRepository<PageEntity, String> {
    Optional<PageEntity> findBySlug(String slug);
}
