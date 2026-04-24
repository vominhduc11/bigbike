package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.persistence.entity.content.ContentAuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContentAuthorJpaRepository extends JpaRepository<ContentAuthorEntity, String> {
}
