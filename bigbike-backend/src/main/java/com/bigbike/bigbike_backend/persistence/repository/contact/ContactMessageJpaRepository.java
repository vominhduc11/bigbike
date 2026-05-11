package com.bigbike.bigbike_backend.persistence.repository.contact;

import com.bigbike.bigbike_backend.persistence.entity.contact.ContactMessageEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ContactMessageJpaRepository
        extends JpaRepository<ContactMessageEntity, UUID>,
                JpaSpecificationExecutor<ContactMessageEntity> {
}
