package com.bigbike.bigbike_backend.persistence.entity.content;

import com.bigbike.bigbike_backend.domain.content.GuideEntry;
import com.bigbike.bigbike_backend.persistence.converter.GuideEntriesConverter;
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
 * Singleton row holding the admin-managed layout of the public guide landing page
 * ({@code /huong-dan}): the hero plus the ordered grid of guide cards. There is exactly one row
 * (seeded by Flyway with {@link #SINGLETON_ID}); the builder replaces the whole {@code entries}
 * array on save, mirroring {@code ContactPageLayoutEntity}. Detail bodies live in {@code pages}.
 */
@Entity
@Table(name = "guide_page_layout")
@Getter
@Setter
@NoArgsConstructor
public class GuidePageLayoutEntity {

    /** Fixed id of the one and only guide-page layout row (seeded in V227). */
    public static final UUID SINGLETON_ID =
            UUID.fromString("00000000-0000-0000-0000-0000000000d0");

    @Id
    private UUID id;

    @Column(name = "hero_title_vi")
    private String heroTitleVi;

    @Column(name = "hero_title_en")
    private String heroTitleEn;

    @Column(name = "hero_image_url")
    private String heroImageUrl;

    @Convert(converter = GuideEntriesConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "entries", columnDefinition = "jsonb")
    private List<GuideEntry> entries;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PreUpdate
    void onPreUpdate() {
        updatedAt = Instant.now();
    }
}
