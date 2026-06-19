package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.persistence.entity.content.ContactPageLayoutEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContactPageLayoutJpaRepository
        extends JpaRepository<ContactPageLayoutEntity, java.util.UUID> {
}
