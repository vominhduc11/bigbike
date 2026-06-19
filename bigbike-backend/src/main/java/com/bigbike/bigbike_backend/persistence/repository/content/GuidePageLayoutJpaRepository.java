package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.persistence.entity.content.GuidePageLayoutEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuidePageLayoutJpaRepository
        extends JpaRepository<GuidePageLayoutEntity, java.util.UUID> {
}
