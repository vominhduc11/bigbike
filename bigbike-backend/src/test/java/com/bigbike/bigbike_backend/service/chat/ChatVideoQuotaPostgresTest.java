package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Actual PostgreSQL migration/upsert, in a disposable database; no AI and no production counter. */
@Testcontainers(disabledWithoutDocker = true)
class ChatVideoQuotaPostgresTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withLabel("bigbike.task", "assistant-video-quota-test");

    @Test void concurrentRequestsCannotExceedTenSlotsInTheVietnameseDay() throws Exception {
        var dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        var jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("create table chat_conversations(id uuid primary key)");
        jdbc.execute("create table chat_messages(id uuid primary key)");
        try (var source = getClass().getResourceAsStream("/db/migration/V1081__chat_short_videos.sql")) {
            jdbc.execute(new String(java.util.Objects.requireNonNull(source).readAllBytes(), StandardCharsets.UTF_8));
        }
        var quota = new ChatVideoDailyQuotaService(jdbc);
        var pool = Executors.newFixedThreadPool(16);
        var start = new CountDownLatch(1);
        var attempts = new ArrayList<Future<Boolean>>();
        try {
            for (int i = 0; i < 40; i++) attempts.add(pool.submit(() -> { start.await(); return quota.tryReserve(10); }));
            start.countDown();
            int accepted = 0;
            for (var result : attempts) if (result.get(20, TimeUnit.SECONDS)) accepted++;
            assertThat(accepted).isEqualTo(10);
            assertThat(quota.tryReserve(10)).isFalse();
            assertThat(jdbc.queryForObject("select used_count from chat_video_daily_usage", Integer.class)).isEqualTo(10);
            assertThat(jdbc.queryForObject("select usage_date from chat_video_daily_usage", java.sql.Date.class).toLocalDate())
                    .isEqualTo(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        } finally { pool.shutdownNow(); }
    }
}
