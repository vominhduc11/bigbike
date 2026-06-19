package com.bigbike.bigbike_backend.persistence.entity.content;

import com.bigbike.bigbike_backend.domain.content.ContactBlock;
import com.bigbike.bigbike_backend.persistence.converter.ContactBlocksConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Singleton row holding the admin-managed layout of the public contact page ({@code /lien-he}).
 * There is exactly one row (seeded by Flyway with {@link #SINGLETON_ID}); the builder replaces the
 * whole {@code blocks} array on save, mirroring the home-highlights save-whole-list pattern.
 */
@Entity
@Table(name = "contact_page_layout")
@Getter
@Setter
@NoArgsConstructor
public class ContactPageLayoutEntity {

    /** Fixed id of the one and only contact-page layout row (seeded in V224). */
    public static final UUID SINGLETON_ID =
            UUID.fromString("00000000-0000-0000-0000-0000000000c0");

    @Id
    private UUID id;

    @Convert(converter = ContactBlocksConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "blocks", columnDefinition = "jsonb")
    private List<ContactBlock> blocks;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PreUpdate
    void onPreUpdate() {
        updatedAt = Instant.now();
    }
}
