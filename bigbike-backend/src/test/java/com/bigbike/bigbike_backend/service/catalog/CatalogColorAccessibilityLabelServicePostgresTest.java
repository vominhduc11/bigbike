package com.bigbike.bigbike_backend.service.catalog;

import javax.sql.DataSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Runs the same vocabulary and repository-mapping assertions on isolated PostgreSQL. */
@Testcontainers(disabledWithoutDocker = true)
class CatalogColorAccessibilityLabelServicePostgresTest extends CatalogColorAccessibilityLabelServiceTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Override
    protected DataSource dataSource() {
        return new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }
}
