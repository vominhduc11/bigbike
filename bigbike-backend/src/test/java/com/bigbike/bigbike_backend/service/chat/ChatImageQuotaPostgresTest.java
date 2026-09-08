package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatImageEntity;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;

/** Disposable PostgreSQL only: production Flyway SQL, quota locking and receipt deletion. */
@Testcontainers(disabledWithoutDocker = true)
class ChatImageQuotaPostgresTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withLabel("bigbike.task", "assistant-image-test");

    @Test void migrationAllowsThreeImagesAndReservationsAreAtomicIdempotentAndRetained() throws Exception {
        var source = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        var jdbc = new JdbcTemplate(source);
        jdbc.execute("create table chat_conversations(id uuid primary key)");
        jdbc.execute("create table chat_messages(id uuid primary key, conversation_id uuid references chat_conversations(id), role text)");
        jdbc.execute("create table products(id varchar(64) primary key)");
        jdbc.execute("create table media(id uuid primary key)");
        jdbc.execute("create table admin_notifications(id uuid primary key, type text, payload text, created_at timestamptz)");
        jdbc.execute("create table site_settings(id uuid primary key, setting_key text unique, setting_value text, setting_group text, is_public boolean, description text, created_at timestamptz, updated_at timestamptz)");
        String old;
        try (var input = getClass().getResourceAsStream("/db/migration/V1061__assistant_model_quality_and_private_images.sql")) {
            old = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        jdbc.execute(old.substring(old.indexOf("create table if not exists chat_image_daily_usage"), old.indexOf("insert into site_settings")));
        try (var input = getClass().getResourceAsStream("/db/migration/V1062__align_chat_hash_columns_to_varchar.sql")) {
            String alignment = new String(input.readAllBytes(), StandardCharsets.UTF_8);
            jdbc.execute(alignment.substring(alignment.indexOf("alter table chat_images")));
        }
        LocalDate day = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        jdbc.update("insert into chat_image_daily_usage(usage_date,used_count) values (?,20)", java.sql.Date.valueOf(day));
        jdbc.update("insert into site_settings(id,setting_key,setting_value) values (?,'ai_assistant_daily_limit','120')", UUID.randomUUID());
        try (var input = getClass().getResourceAsStream("/db/migration/V1082__chat_image_reliability_and_receipts.sql")) {
            jdbc.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
        assertThat(jdbc.queryForObject("select setting_value from site_settings where setting_key='ai_assistant_image_daily_limit'", String.class)).isEqualTo("60");
        assertThat(jdbc.queryForObject("select setting_value from site_settings where setting_key='ai_assistant_daily_limit'", String.class)).isEqualTo("120");
        assertThat(jdbc.queryForObject("select used_count from chat_image_daily_usage", Integer.class)).isEqualTo(20);
        UUID conversation = UUID.randomUUID(), message = UUID.randomUUID();
        jdbc.update("insert into chat_conversations values (?)", conversation);
        jdbc.update("insert into chat_messages values (?,?,'CUSTOMER')", message, conversation);
        List<UUID> images = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            UUID id = UUID.randomUUID(); images.add(id);
            jdbc.update("""
                    insert into chat_images(id,request_id,conversation_id,storage_bucket,storage_object_key,
                      mime_type,width,height,size_bytes,sha256,status,expires_at)
                    values (?,?,?,'test',?,'image/png',100,100,123,?,'PENDING',now()+interval '90 days')
                    """, id, UUID.randomUUID(), conversation, id.toString(), "a".repeat(64));
        }
        for (int i = 0; i < 3; i++) jdbc.update("update chat_images set customer_message_id=?,attachment_position=? where id=?", message, i, images.get(i));
        assertHibernateSchemaAndImageRoundTrip(source, images.get(3));
        assertThatThrownBy(() -> jdbc.update("update chat_images set attachment_position=3 where id=?", images.get(0))).isInstanceOf(RuntimeException.class);
        var quota = new ChatImageDailyQuotaService(jdbc);
        var transactions = new TransactionTemplate(new DataSourceTransactionManager(source));
        var pool = Executors.newFixedThreadPool(4);
        try {
            List<Future<List<UUID>>> jobs = new ArrayList<>();
            for (int i = 0; i < 4; i++) {
                var batch = images.subList(i * 3, i * 3 + 3);
                jobs.add(pool.submit(() -> transactions.execute(status -> quota.reserveImages(batch, 25).imageIds())));
            }
            var reserved = new ArrayList<UUID>();
            for (var job : jobs) reserved.addAll(job.get(20, TimeUnit.SECONDS));
            assertThat(reserved).hasSize(5);
            assertThat(quota.usedOn(day)).isEqualTo(25);
            var replay = transactions.execute(status -> quota.reserveImages(reserved, 0));
            assertThat(replay.imageIds()).containsExactlyElementsOf(reserved);
            assertThat(quota.usedOn(day)).isEqualTo(25);
            assertThat(transactions.execute(status -> quota.reserveImages(images, 27)).imageIds()).hasSize(7);
            assertThat(quota.usedOn(day)).isEqualTo(27);
        } finally { pool.shutdownNow(); }
        jdbc.update("update chat_images set status='READY',intent_code='BANK_TRANSFER_RECEIPT' where id=?", images.get(0));
        var notifications = new ChatReceiptNotificationService(jdbc, new ObjectMapper());
        transactions.executeWithoutResult(status -> notifications.receive(conversation, message));
        transactions.executeWithoutResult(status -> notifications.receive(conversation, message));
        assertThat(jdbc.queryForObject("select count(*) from admin_notifications", Integer.class)).isEqualTo(1);
        String payload = jdbc.queryForObject("select payload from admin_notifications", String.class);
        assertThat(new ObjectMapper().readTree(payload).size()).isEqualTo(3);
        assertThatThrownBy(() -> notifications.receive(UUID.randomUUID(), message)).isInstanceOf(IllegalArgumentException.class);
        jdbc.update("delete from chat_messages where id=?", message);
        assertThat(jdbc.queryForObject("select count(*) from admin_notifications", Integer.class)).isZero();
    }

    private void assertHibernateSchemaAndImageRoundTrip(DriverManagerDataSource source, UUID imageId) {
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.connection.datasource", source)
                .applySetting("hibernate.hbm2ddl.auto", "validate")
                .build();
        try (var factory = new MetadataSources(registry)
                .addAnnotatedClass(ChatImageEntity.class).buildMetadata().buildSessionFactory();
             var session = factory.openSession()) {
            var transaction = session.beginTransaction();
            var image = session.find(ChatImageEntity.class, imageId);
            image.setAttachmentPosition(2);
            session.flush();
            session.clear();
            assertThat(session.find(ChatImageEntity.class, imageId).getAttachmentPosition()).isEqualTo(2);
            transaction.commit();
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }
}
