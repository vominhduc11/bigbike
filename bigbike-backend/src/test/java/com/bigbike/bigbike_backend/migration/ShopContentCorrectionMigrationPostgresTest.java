package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class ShopContentCorrectionMigrationPostgresTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void replacesOnlyKnownClausesAndOldEnglishAddressWithoutOverwritingEditedContent() throws Exception {
        String migration;
        try (var input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1094__sync_shop_hours_content_and_english_address.sql"))) {
            migration = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("""
                    create table site_settings (
                        setting_key text primary key, setting_value text, setting_value_en text,
                        updated_at timestamptz default '2026-01-01');
                    insert into site_settings values
                    ('home_content_bottom_html',
                     '<p>Giữ nguyên (T2–T7: 9:00–21:00 | CN: 9:00–17:00). Hỗ trợ: 18:00.</p>',
                     '<p>Keep prose (Mon–Sat: 9:00 AM–9:00 PM | Sun: 9:00 AM–6:00 PM). Support: 6 PM.</p>', default),
                    ('contact_address', 'Địa chỉ VI giữ nguyên',
                     '79/30/52 Au Co, Ward 14, District 11, Ho Chi Minh City', default),
                    ('unrelated', 'T2–T7: 9:00–21:00 | CN: 9:00–18:00', 'Support: 6 PM', default);
                    """);
            statement.execute(migration);
            try (var result = statement.executeQuery("select * from site_settings order by setting_key")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString("setting_value")).isEqualTo("Địa chỉ VI giữ nguyên");
                assertThat(result.getString("setting_value_en"))
                        .isEqualTo("79/30/52 Au Co, Hoa Binh Ward, Ho Chi Minh City");
                assertThat(result.next()).isTrue();
                assertThat(result.getString("setting_value"))
                        .isEqualTo("<p>Giữ nguyên ({{store_hours}}). Hỗ trợ: 18:00.</p>");
                assertThat(result.getString("setting_value_en"))
                        .isEqualTo("<p>Keep prose ({{store_hours}}). Support: 6 PM.</p>");
                assertThat(result.next()).isTrue();
                assertThat(result.getString("setting_value"))
                        .isEqualTo("T2–T7: 9:00–21:00 | CN: 9:00–18:00");
            }
            // Idempotent, including updated_at. Custom edits must survive a rerun.
            statement.execute("create temp table snapshot as select * from site_settings");
            statement.execute(migration);
            try (var result = statement.executeQuery("""
                    select count(*) from (
                        (select * from site_settings except select * from snapshot)
                        union all (select * from snapshot except select * from site_settings)
                    ) diff
                    """)) {
                result.next();
                assertThat(result.getInt(1)).isZero();
            }
            statement.execute("""
                    update site_settings set setting_value = 'Custom schedule', setting_value_en = 'Custom content'
                    where setting_key in ('contact_address', 'home_content_bottom_html')
                    """);
            statement.execute(migration);
            try (var result = statement.executeQuery("""
                    select count(*) from site_settings
                    where setting_key in ('contact_address', 'home_content_bottom_html')
                      and setting_value = 'Custom schedule' and setting_value_en = 'Custom content'
                    """)) {
                result.next();
                assertThat(result.getInt(1)).isEqualTo(2);
            }
        }
    }
}
