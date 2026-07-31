package com.bigbike.bigbike_backend.persistence.entity.home;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "home_highlights_config")
@Getter
@Setter
@NoArgsConstructor
public class HomeHighlightsConfigEntity {

    @Id
    @Column(columnDefinition = "smallint")
    private Short id;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void touch(Instant now) {
        updatedAt = now;
    }
}
