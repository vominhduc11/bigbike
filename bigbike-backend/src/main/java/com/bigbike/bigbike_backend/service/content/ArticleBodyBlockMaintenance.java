package com.bigbike.bigbike_backend.service.content;

import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "true", matchIfMissing = true)
public class ArticleBodyBlockMaintenance {
    private final DataSource dataSource;

    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void fillMissingBlocks() {
        try (var connection = dataSource.getConnection()) {
            int filled = ArticleBodyBlockBackfill.fillMissing(connection, 25);
            if (filled > 0) log.info("Restored editable blocks for {} articles", filled);
        } catch (Exception error) {
            log.warn("Article block maintenance failed; original content is preserved", error);
        }
    }
}
