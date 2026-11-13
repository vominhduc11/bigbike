package com.bigbike.bigbike_backend.persistence.repository.media;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

/** Isolated H2 fixture: no Spring application, Flyway, scheduler or live storage is started. */
class MediaImageDimensionsRepositoryTest {
    @Test
    void selectsOnlyDimensionsWhilePreservingNullDimensionsAndAllStatuses() {
        List<String> statements = new ArrayList<>();
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.connection.driver_class", "org.h2.Driver")
                .applySetting("hibernate.connection.url", "jdbc:h2:mem:media-dimensions;DB_CLOSE_DELAY=-1")
                .applySetting("hibernate.hbm2ddl.auto", "create-drop")
                .applySetting("hibernate.session_factory.statement_inspector", (StatementInspector) sql -> {
                    statements.add(sql);
                    return sql;
                }).build();
        try (var factory = new MetadataSources(registry).addAnnotatedClass(MediaEntity.class)
                .buildMetadata().buildSessionFactory(); var entityManager = factory.createEntityManager()) {
            entityManager.getTransaction().begin();
            entityManager.persist(media("/media/known.webp", 1280, 720, "ACTIVE"));
            entityManager.persist(media("/media/deleted.webp", null, null, "DELETED"));
            entityManager.persist(media("/media/unrequested.webp", 800, 600, "ACTIVE"));
            entityManager.getTransaction().commit();
            entityManager.clear();
            statements.clear();

            var repository = new JpaRepositoryFactory(entityManager).getRepository(MediaJpaRepository.class);
            var results = repository.findImageDimensionsByPublicUrlIn(List.of(
                    "/media/known.webp", "/media/deleted.webp", "/media/absent.webp"));
            assertThat(results).hasSize(2);
            var known = results.stream().filter(row -> row.getPublicUrl().endsWith("known.webp"))
                    .findFirst().orElseThrow();
            assertThat(known.getWidth()).isEqualTo(1280);
            assertThat(known.getHeight()).isEqualTo(720);
            var deleted = results.stream().filter(row -> row.getPublicUrl().endsWith("deleted.webp"))
                    .findFirst().orElseThrow();
            assertThat(deleted.getWidth()).isNull();
            assertThat(deleted.getHeight()).isNull();
            assertThat(statements).hasSize(1);
            assertThat(statements.get(0)).contains("public_url", "width", "height")
                    .doesNotContain("metadata", "original_filename", "sizes", "file_path");
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    private static MediaEntity media(String url, Integer width, Integer height, String status) {
        MediaEntity media = new MediaEntity();
        media.setPublicUrl(url);
        media.setFilePath(url);
        media.setWidth(width);
        media.setHeight(height);
        media.setStatus(status);
        media.setStorageProvider("MINIO");
        media.setMetadata("Large metadata should not be fetched");
        media.setCreatedAt(Instant.parse("2026-11-12T00:00:00Z"));
        media.setUpdatedAt(media.getCreatedAt());
        return media;
    }
}
