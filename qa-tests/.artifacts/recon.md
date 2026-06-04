

================================================================================
# BACKEND_INFRA
================================================================================
Perfect. Now I have all the information needed. Let me compile a comprehensive reconnaissance report:

## BigBike Backend (Spring Boot) — QA Automation Test Suite Reconnaissance Report

---

### 1. BUILD SYSTEM

**Build Tool:** Maven (not Gradle)

**Wrapper:** Present and functional
- Executable: `/bigbike-backend/mvnw` (shell script)
- Windows batch: `/bigbike-backend/mvnw.cmd`
- Maven home: `/bigbike-backend/.mvn/`

**Run tests command:**
```bash
./mvnw test                    # Run all unit/integration tests
./mvnw test -Dtest=ClassName  # Run single test class
./mvnw verify                  # Run tests + security scan (see Maven profiles below)
./mvnw -B -Psecurity-scan verify  # Batch mode with OWASP Dependency Check
```

**POM Location:** `C:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-backend/pom.xml`

**Java Version:** `17` (property: `<java.version>17</java.version>`)

**Spring Boot Version:** `4.0.5` (parent: `spring-boot-starter-parent`)

---

### 2. TEST-RELATED DEPENDENCIES (from pom.xml)

#### Core Test Framework
| Dependency | Version | Scope | Notes |
|---|---|---|---|
| `spring-boot-starter-test` | BOM managed | test | Includes JUnit 5, Mockito, AssertJ, JSONAssert, Spring Test |
| `spring-boot-actuator-test` | BOM managed | test | Actuator-specific assertions |
| `spring-boot-configuration-processor` | BOM managed | optional | Config metadata generation |

#### Spring Boot Starter Test Modules (Modular starters, all BOM-managed)
| Dependency | Scope | Purpose |
|---|---|---|
| `spring-boot-starter-data-jpa-test` | test | JPA/Hibernate testing setup |
| `spring-boot-starter-flyway-test` | test | Flyway migration test support |
| `spring-boot-starter-mail-test` | test | JavaMailSender mock/test |
| `spring-boot-starter-security-test` | test | Security MockMvc + @WithMockUser |
| `spring-boot-starter-thymeleaf-test` | test | Thymeleaf template testing |
| `spring-boot-starter-webmvc-test` | test | MockMvc, request builders, assertions |
| `spring-boot-starter-websocket-test` | test | WebSocket test support |

#### Testcontainers Stack
| Dependency | Version | Scope | Notes |
|---|---|---|---|
| `spring-boot-testcontainers` | BOM managed | test | Spring Boot integration bridge |
| `testcontainers-bom` | `1.20.4` | import/pom | BOM manages all testcontainers:* versions |
| `org.testcontainers:postgresql` | BOM managed | test | PostgreSQL 16-alpine container **PRESENT** |
| `org.testcontainers:junit-jupiter` | BOM managed | test | JUnit 5 integration for Testcontainers |

#### Database & ORM
| Dependency | Version | Scope | Notes |
|---|---|---|---|
| `h2` | BOM managed | test | H2 in-memory DB for H2-based tests (no Testcontainers) |
| `postgresql` | BOM managed | runtime | Production PostgreSQL JDBC driver |

#### Mocking & Assertions (via spring-boot-starter-test transitive)
- **JUnit Jupiter** (JUnit 5) — all @Test, @BeforeEach, @Nested, @ParameterizedTest
- **Mockito** — @Mock, @InjectMocks, Mockito.when/verify
- **AssertJ** — assertThat(), soft assertions
- **Spring MockMvc** — MockMvc, request builders (get/post/patch/delete), status matchers, jsonPath

#### Security Testing (via spring-boot-starter-security-test)
- `SecurityMockMvcConfigurers.springSecurity()` — apply security filters to MockMvc
- `@WithMockUser`, `@WithUserDetails` — annotate test methods
- `authentication()` POST processor — custom authentication in request

#### Mapping & Code Generation
| Dependency | Version | Scope | Notes |
|---|---|---|---|
| `mapstruct` | `1.6.3` | compile | DTO/Entity mappers |
| `lombok` | BOM managed | optional | @Getter/@Setter/@AllArgsConstructor |
| `mapstruct-processor` | `1.6.3` | annotation processor | Generates MapStruct implementations |
| `lombok-mapstruct-binding` | `0.2.0` | annotation processor | Handles Lombok + MapStruct conflict |

#### ABSENT: REST-Assured, Cucumber, TestNG
**NOT PRESENT** in pom.xml:
- `rest-assured` — NOT being used; tests use MockMvc instead
- `cucumber`, `io.cucumber:*` — NOT being used; no BDD framework
- `testng` — NOT being used; JUnit 5 is the standard
- **MinIO Testcontainers** (`org.testcontainers:minio`) — **NOT PRESENT** (MinIO tests use fixed test credentials and graceful failure on unavailable server, per `application-test.properties` comments)

---

### 3. TEST DIRECTORY STRUCTURE & EXISTING TEST COVERAGE

**Test Root:** `C:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-backend/src/test/java/`

**Total Test Classes:** 75 Java test files across `com.bigbike.bigbike_backend.*` hierarchy

#### Test Classes by Category:

**A. API/Integration Tests (56 tests in `api/` package)**
Tests are named by phase (Phase1A...Phase2F) and feature:

| Test Class | Coverage |
|---|---|
| `BigbikeBackendApplicationTests` | Basic Spring context load (@SpringBootTest) |
| **Auth & Security** |  |
| `AdminAuthApiTest` | Admin login, token refresh, logout (POST /api/v1/admin/auth/*) |
| `AdminAuthSecurityTest` | CSRF, invalid grant, disabled-account flows |
| `AuthProfileGuardTest` | Customer profile guard (403 if no profile role) |
| `RbacSecurityTest` | Role-based access control, URL gate enforcement |
| `RbacUrlGateIntegrationTest` | Permission cache eviction, multi-role scenarios |
| `Phase1DCustomerAuthTest` | Customer sign-up, email verification, password reset |
| `Phase1I1CustomerStatusLoginTest` | Customer login state transitions |
| **Admin CRUD/Features** |  |
| `AdminAuditLogApiTest` | GET /api/v1/admin/audit-logs, filters (action/resourceType/date) |
| `AdminUserApiTest` | Admin user management |
| `AdminRolesApiTest` | Role/permission CRUD |
| `AdminReadApiTest` | Admin read queries (entities, filters) |
| `AdminMutationApiTest` | Admin mutations (POST/PATCH/DELETE) |
| `AdminContentApiTest` | Content (pages, menus) CRUD |
| `AdminMediaP0Test` | Media upload (P0), MinIO integration, image resize |
| `AdminDashboardApiTest` | Dashboard KPIs |
| `AdminReportApiTest` | Report generation, export |
| `AdminReportRepositoryQueryTest` | **Testcontainers test** — PostgreSQL native SQL (AT TIME ZONE, ::text casts) |
| `AdminReceivableApiTest` | Receivables/accounting |
| `AdminCouponGiftApiTest` | Coupon/gift management |
| `AdminRedirectApiTest` | URL redirects (legacy compatibility) |
| `AdminShippingApiTest` | Shipping zones, methods, rates |
| **Customer/Commerce** |  |
| `Phase1ECartApiTest` | Shopping cart (add/remove/update items, coupon apply) |
| `Phase1FCheckoutApiTest` | Checkout flow, order creation, address validation |
| `Phase1GOrderReadApiTest` | Customer order history, order detail |
| `Phase1HAdminOrderApiTest` | Admin order read/update/cancel |
| `Phase1KInventoryP0FixApiTest` | Stock/inventory management |
| `Phase1KInventorySerialApiTest` | Serial number tracking |
| `Phase1LReturnsApiTest` | Return/RMA flows |
| `Phase1KOpenApiContractTest` | OpenAPI contract validation (spec vs runtime) |
| `Phase1K1ContractHardeningTest` | Contract edge cases |
| **Public/Customer Features** |  |
| `PublicReadApiTest` | Public product/category read (no auth) |
| `PublicReviewApiTest` | Product reviews (read/create) |
| `ContentPublicApiTest` | Public content (pages, menus) |
| `ContentP1ApiTest` | Phase 1 content endpoints |
| `HomepagePublicApiTest` | Homepage data (sliders, featured) |
| `HomeVideoApiTest` | YouTube video list |
| `SliderApiTest` | Homepage slider management |
| `WarrantyApiTest` | Product warranty info |
| `CustomerAddressApiTest` | Customer address book CRUD |
| `CustomerWishlistApiTest` | Wishlist add/remove |
| `GuestOrderLinkingTest` | Guest order lookup by email+phone |
| **POS & Inventory** |  |
| `Phase1MPosApiTest` | Point-of-sale checkout |
| **Product & Catalog** |  |
| `Phase1NReviewsApiTest` | Product review system |
| **Migration (WordPress legacy)** |  |
| `Phase2AWordPressMigrationFoundationTest` | Migration foundation setup |
| `Phase2BWordPressCatalogDryRunImporterTest` | Dry-run catalog import |
| `Phase2B1RealDumpDryRunCalibrationTest` | Real dump calibration |
| `Phase2CWordPressCustomerOrderCouponDryRunImporterTest` | Customer/order/coupon import |
| `Phase2D1StagingImportRehearsalTest` | Staging rehearsal |
| `Phase2DWordPressMigrationWritePlanImportTest` | Write-plan execution |
| `Phase2D2ProductVariationImporterTest` | Product variation import |
| `Phase2D3ProductNormalizationTest` | Data normalization |
| `Phase2D4RedirectMappingTest` | URL redirect mapping |
| `Phase2EMediaCopyTest` | MinIO media copy from WordPress uploads |
| `Phase2EProductGalleryBackfillTest` | Product gallery backfill |
| `Phase2FSerialInventoryTest` | Serial inventory data |

**B. Schema/Repository Tests (4 tests in `schema/` package)**

| Test Class | Coverage |
|---|---|
| `Phase1BSchemaTest` | JPA entity save/load cycle (Customer, Address, Coupon, Shipping, Settings) |
| `Phase1CCommerceSchemaTest` | Commerce entity schema (Order, Payment, Fulfillment) |
| `SliderRepositoryTest` | Slider repository queries |
| `HomeVideoRepositoryTest` | Home video repository queries |

**C. Service Unit Tests (10 tests in `service/` package)**

| Test Class | Coverage |
|---|---|
| `PasswordServiceTest` | Argon2id hashing, verify, salt randomness |
| `DescriptionBlockRendererTest` | HTML sanitization (XSS prevention) |
| `BodyBlockParserTest` | Content block parsing |
| `SliderReadServiceTest` | Slider read logic |
| `YouTubeUrlParserTest` | YouTube URL extraction |
| `WebRevalidationServiceTest` | Next.js on-demand revalidation |
| `AdminMutationValidatorsTest` | Admin mutation business rule validators |
| `AdminReportCsvHardeningTest` | CSV export edge cases (injection, encoding) |
| `ProductBilingualRoundtripTest` | Bilingual (VN/EN) product name mappings |
| `VariantGalleryRoundtripTest` | Product variant gallery serialization |

**D. Config/DTO Tests (2 tests)**

| Test Class | Coverage |
|---|---|
| `CorsConfigTest` | CORS policy enforcement |
| `PublicHomeVideoResponseTest` | DTO marshalling |

**E. Migration Tests (1 test)**

| Test Class | Coverage |
|---|---|
| `WordPressVariationMapperRtwpvgTest` | WordPress product variation mapper |

#### Base Test Classes / Abstract Parents
**NONE IDENTIFIED** — no `Abstract*Test`, `Base*Test`, or shared test config parent class in the codebase. Each test class:
- Directly uses `@SpringBootTest`
- Sets up MockMvc via `MockMvcBuilders.webAppContextSetup()` + `springSecurity()`
- Uses `@BeforeEach` for per-test setup

#### Test Configuration Annotations Used
- `@SpringBootTest` — Full Spring context (primary annotation across all API tests)
- `@ActiveProfiles("tc")` — Testcontainers profile (PostgreSQL tests only)
- `@Testcontainers` + `@Container` + `@ServiceConnection` — Testcontainers orchestration (PostgreSQL)
- `@Sql(scripts = "/db/test-seed.sql")` — Per-class database seeding
- `@BeforeEach` — Per-test setup (MockMvc, permission cache eviction)
- `@Test` (JUnit 5)
- `@WithMockUser`, custom `authentication()` POST processor — Security mocking

---

### 4. TEST CONFIGURATION & PROFILES

**Test Spring Profiles:**

| Profile | File | Activation | Purpose |
|---|---|---|---|
| (default) | `src/test/resources/application.properties` | All tests by default | H2 in-memory, dev auth bypass, Flyway disabled |
| `tc` | `src/test/resources/application-tc.properties` | `@ActiveProfiles("tc")` | Testcontainers (PostgreSQL), Flyway enabled |

**Test Properties Summary:**

**`application.properties` (default, H2-based):**
```
spring.datasource.url=jdbc:h2:mem:bigbike;MODE=PostgreSQL;...
spring.datasource.driver-class-name=org.h2.Driver
spring.jpa.hibernate.ddl-auto=create-drop
spring.flyway.enabled=false
bigbike.auth.dev-header-enabled=true
bigbike.internal.allow-open=true
bigbike.minio.endpoint=http://localhost:9000
bigbike.minio.access-key=test-access-key
bigbike.minio.secret-key=test-secret-key
bigbike.seed.admin-password=Test@Seed!12345
```

**`application-tc.properties` (Testcontainers):**
```
spring.flyway.enabled=true
spring.jpa.hibernate.ddl-auto=none
spring.flyway.locations=classpath:db/migration,classpath:db/testmigration
bigbike.jwt.secret=tc-testcontainers-fixed-secret-for-ci-tests-32chars
bigbike.cors.allowed-origins=https://tc-test.bigbike.vn
```
*Note:* `@ServiceConnection` on PostgreSQLContainer auto-wires JDBC connection.

**Production Profiles (referenced but not used in tests):**
- `application-dev.properties` — Local dev (seed admin, allow-open=true, Flyway with dev migrations)
- `application-prod.properties` — Production (structured logging, pool tuning, Swagger disabled)
- `application-mock.properties` — (exists but purpose unclear from scanning)

**DB Migration Locations:**
- Main: `src/main/resources/db/migration/` — Flyway V-migrations (versioned)
- Dev-only: `src/main/resources/db/migration-dev/` — Dev seed migrations
- Test-only: `src/test/resources/db/testmigration/` — Test-specific migrations (e.g., V26_5__seed_products_for_v27.sql)
- Test seeding: `src/test/resources/db/test-seed.sql` — SQL seed file via @Sql annotation

**Test Fixtures:**
- Location: `src/test/resources/fixtures/wordpress/` (not yet explored in detail; likely fixture data for migration tests)

---

### 5. HOW TESTS ARE RUN

**Standard command:**
```bash
cd C:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-backend/
./mvnw test
```

**Windows batch variant:**
```cmd
mvnw.cmd test
```

**Single test class:**
```bash
./mvnw test -Dtest=AdminAuditLogApiTest
```

**With filtering:**
```bash
./mvnw test -Dtest=*ApiTest               # Run all *ApiTest classes
./mvnw test -Dtest=AdminAuditLogApiTest#testListWithValidAuth  # Single method
```

**Profiles & Activation:**
- H2 tests (default): Run without any Maven profile flag.
- Testcontainers tests: Automatically detected via `@ActiveProfiles("tc")` + `@Testcontainers` annotations; Maven does not need special config.
- Security scan: `./mvnw -B -Psecurity-scan verify` (OWASP Dependency Check Maven plugin)

**Maven Plugin Build Phases:**
- `test` — Compile + run all tests, stop on first failure
- `verify` — Includes `test` + post-test plugins (e.g., security-scan if active)
- `clean` — Remove target/ directory

---

### 6. MAIN SOURCE PACKAGE STRUCTURE

**Root Package:** `com.bigbike.bigbike_backend`

**Top-level Modules:**

```
├── api/                          # REST controllers & DTOs
│   ├── admin/                    # Admin endpoints (auth, CRUD, reports)
│   ├── auth/                     # Auth flow (login, token, password reset)
│   ├── cart/                     # Cart operations
│   ├── catalog/                  # Product/category reads
│   ├── checkout/                 # Checkout flow
│   ├── common/                   # Shared error handling, response wrappers
│   ├── content/                  # Content (pages, menus) endpoints
│   ├── customer/                 # Customer profile, address, wishlist
│   ├── error/                    # Global error handler (@ExceptionHandler)
│   ├── internal/                 # Internal endpoints (/api/internal/*)
│   ├── openapi/                  # OpenAPI schema config (SpringDoc)
│   ├── order/                    # Order read/create
│   └── public_/                  # Public-facing endpoints (no auth required)
│
├── config/                       # Spring configuration classes
│   ├── CorsConfig
│   ├── SecurityConfig            # Spring Security, JWT, RBAC
│   ├── WebSocketConfig
│   ├── JpaConfig
│   └── ...
│
├── controller/                   # (Legacy?) Controller classes
│
├── domain/                       # Value objects, enums, domain logic
│   ├── auth/                     # AuthToken, AdminPrincipal
│   ├── catalog/                  # PublishStatus, ProductStockState
│   ├── commerce/                 # OrderStatus, PaymentMethod
│   ├── content/                  # ContentBlockType
│   ├── customer/
│   ├── menu/
│   ├── slider/
│   └── video/
│
├── mapper/                       # MapStruct DTOs mappers
│
├── migration/                    # WordPress migration logic
│   └── wordpress/                # Importers, mappers, dry-run tools
│
├── persistence/                  # JPA/Repository layer
│   ├── entity/                   # @Entity classes (domain model)
│   │   ├── audit/
│   │   ├── catalog/
│   │   ├── commerce/
│   │   ├── coupon/
│   │   ├── customer/
│   │   ├── media/
│   │   ├── menu/
│   │   ├── redirect/
│   │   ├── settings/
│   │   ├── shipping/
│   │   └── ...
│   ├── repository/               # JpaRepository interfaces
│   └── converter/                # JPA attribute converters
│
├── repository/                   # (May be legacy?) Custom query repos
│
├── service/                      # Business logic, transactions
│   ├── admin/                    # Admin mutations, reports, validators
│   ├── address/
│   ├── auth/                     # PasswordService, JwtService
│   ├── cart/
│   ├── catalog/
│   ├── checkout/
│   ├── common/
│   ├── content/
│   ├── coupon/
│   ├── customer/
│   ├── email/                    # JavaMailSender integration
│   ├── home/
│   ├── inventory/
│   ├── order/
│   ├── payment/
│   ├── pos/                      # Point-of-sale
│   ├── public_/
│   ├── receivable/
│   ├── search/
│   ├── security/                 # Permission evaluation
│   ├── slider/
│   ├── video/
│   ├── web/                      # Next.js revalidation
│   └── ws/                       # WebSocket messaging
│
└── BigbikeBackendApplication    # Main Spring Boot entry point
```

---

### 7. COMPREHENSIVE TEST INFRASTRUCTURE SUMMARY

#### What Already Exists (Infrastructure)
| Component | Status | Details |
|---|---|---|
| **Test Framework** | READY | JUnit 5 with MockMvc (Spring Test) |
| **Mocking** | READY | Mockito (via spring-boot-starter-test) |
| **Assertions** | READY | AssertJ (via spring-boot-starter-test) |
| **Security Testing** | READY | spring-boot-starter-security-test, @WithMockUser, authentication() POST processor |
| **H2 In-Memory DB** | READY | Scope: test; all tests use H2 by default (create-drop schema) |
| **Testcontainers** | READY | PostgreSQL 16-alpine; used by AdminReportRepositoryQueryTest & native-SQL tests |
| **Spring Test Config** | READY | @SpringBootTest, @ActiveProfiles, @Sql, @BeforeEach |
| **Permission Testing** | READY | AdminPermissionService.evict(), X-Admin-Role/X-Admin-Permissions headers (dev auth bypass) |
| **Test Seed Data** | READY | `/db/test-seed.sql` (40+ KB fixture), loaded via @Sql annotation |
| **Test Migrations** | READY | `db/testmigration/` with V26_5__seed_products_for_v27.sql for dependency setup |
| **API Testing** | READY | MockMvc with request builders, jsonPath assertions, status matchers |
| **Maven Wrapper** | READY | mvnw shell script + mvnw.cmd batch; no build config needed |

#### What Does NOT Exist (Would Need to Add)
| Component | Status | What's Missing |
|---|---|---|
| **REST-Assured** | ABSENT | Not in pom.xml; tests use MockMvc instead. Would require adding `io.rest-assured:rest-assured` if external HTTP testing needed (unlikely — internal SpringBoot tests sufficient). |
| **Cucumber/BDD** | ABSENT | No Gherkin feature files or Cucumber steps. Would need `io.cucumber:*` dependencies. |
| **TestNG** | ABSENT | JUnit 5 is the standard; no need unless migrating. |
| **MinIO Testcontainers** | ABSENT | `org.testcontainers:minio` not present. Current tests use fixed credentials with graceful server-unavailable fallback. **Could add if automated MinIO container testing desired.** |
| **Test Base Classes** | ABSENT | No AbstractIntegrationTest, CommonTestSetup, or shared configuration parent. Each test class independently uses @SpringBootTest. **Could introduce for DRY principle if test suite grows.** |
| **Selenium/Browser Tests** | ABSENT | No browser automation. Frontend (bigbike-web) is separate Next.js repo. |
| **Load/Performance Tests** | ABSENT | No JMeter, Gatling, or spring-cloud-load-test-stress-ng. Would require separate plugin. |
| **Contract Testing** | ABSENT | No Pact, Spring Cloud Contract, or OpenAPI contract tests (though Phase1KOpenApiContractTest validates OpenAPI schema compliance at runtime). |

---

### 8. KEY TESTING PATTERNS OBSERVED

1. **API Integration Tests Use MockMvc:**
   - Full Spring context via `@SpringBootTest`
   - No embedded Servlet container startup (in-process)
   - `SecurityMockMvcConfigurers.springSecurity()` applies security filters
   - `authentication()` POST processor or `@WithMockUser` for auth
   - Examples: AdminAuditLogApiTest, Phase1ECartApiTest, AdminReportApiTest

2. **Service Unit Tests Use Spring Context:**
   - `@SpringBootTest` even for simple services (PasswordServiceTest, SliderReadServiceTest)
   - Could use `@SpringBootTest(classes = {ServiceClass.class})` to slim context if performance needed
   - Autowire service beans directly

3. **Repository/Schema Tests Use @Sql Seeding:**
   - `@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)` loads fixture data
   - H2 default profile; or `@ActiveProfiles("tc")` for real PostgreSQL via Testcontainers

4. **Testcontainers Pattern (PostgreSQL-specific):**
   - `@SpringBootTest @ActiveProfiles("tc") @Testcontainers` (3-annotation pattern)
   - `@Container @ServiceConnection static PostgreSQLContainer<?>` — Spring Boot auto-wires JDBC
   - Used only in AdminReportRepositoryQueryTest (native SQL requiring PostgreSQL-specific syntax)
   - **MinIO NOT containerized** — tests degrade gracefully with fixed test credentials

5. **Permission Testing:**
   - `AdminPermissionService.evict(roleKey)` clears cache before assertions
   - Dev header auth bypass (`bigbike.auth.dev-header-enabled=true` in test profile) allows `X-Admin-Role` + `X-Admin-Permissions` headers
   - Example: AdminAuditLogApiTest line 54-55

6. **No Abstract Base Classes:**
   - Each test class is self-contained
   - Boilerplate (MockMvc setup, permission evict) is duplicated across tests
   - **Opportunity:** Could create IntegrationTestBase extends the setup pattern

---

### 9. CRITICAL NOTES FOR QA AUTOMATION SUITE PLANNING

1. **Testcontainers PostgreSQL is Available:** If any new tests require real PostgreSQL (native SQL, full-text search, jsonb, etc.), use `AdminReportRepositoryQueryTest` as template.

2. **MinIO Not Containerized:** The Phase2E media tests use fixed credentials with graceful failure if MinIO unavailable. If robust MinIO testing needed, add `org.testcontainers:minio` to pom.xml and create testcontainers variant.

3. **Flyway Test Migrations:** Tests in the `tc` profile load `db/testmigration/` migrations. If adding new table structures, add corresponding migration files (V27_*, V28_*, etc.) for Testcontainers tests.

4. **H2 Limitations:** H2 cannot parse PostgreSQL-specific syntax (AT TIME ZONE, ::type casts, some window functions). H2-based tests require SQL compatibility; native-SQL tests must use Testcontainers profile.

5. **Dev Auth Bypass:** `bigbike.auth.dev-header-enabled=true` in test profile allows injecting roles via headers. Never leave this enabled in production (correctly set to `false` in application-prod.properties).

6. **Test Data:** Reuse `src/test/resources/db/test-seed.sql` for common fixtures. Load it via `@Sql` at class level to seed once per test class.

7. **No REST-Assured:** MockMvc is the standard. If external HTTP testing needed (cross-service, real endpoints), REST-Assured can be added, but is not currently required.

8. **Existing Test Count:** 75 test classes covering API, schema, service, config, and migration. New tests can follow the Phase*Test naming pattern or service-specific patterns (e.g., CartServiceTest, OrderServiceTest).

---

### 10. RECOMMENDED NEXT STEPS FOR QA AUTOMATION FRAMEWORK

1. **Establish a Base Class** (optional, but recommended for DRY):
   - `AbstractIntegrationTest` with MockMvc setup, permission eviction helpers
   - `AbstractRepositoryTest` for schema-focused tests with @Sql seeding

2. **Add MinIO Testcontainers** (if automated media testing required):
   - Add `org.testcontainers:minio` to pom.xml dependencies
   - Create `AbstractMinioTest` with @Container + @ServiceConnection pattern

3. **Document Test Profile Activation:**
   - README with command examples for running H2 tests vs Testcontainers tests
   - CI/CD configuration to run both suites (H2 in quick feedback, Testcontainers in nightly/PR)

4. **Extend Testcontainers Coverage:**
   - Currently only AdminReportRepositoryQueryTest uses it
   - Consider using for any tests requiring PostgreSQL-specific features

5. **Retrofit Selenium/E2E Tests** (outside bigbike-backend):
   - Backend tests are comprehensive (API, schema, service)
   - Frontend (Next.js) would need separate Cypress/Playwright tests in bigbike-web

---

## CONCLUSION

The BigBike backend has a **mature, comprehensive test infrastructure** in place:
- **75 existing tests** covering API, schema, service, and migration layers
- **Maven-based** with testcontainers BOM (1.20.4) for PostgreSQL integration
- **Spring 4.0.5** + **Java 17** with full Spring Boot test stack
- **MockMvc** for API testing, JUnit 5, Mockito, AssertJ all present
- **H2 in-memory** for fast tests; Testcontainers for PostgreSQL-specific SQL
- **Test seeding** via @Sql + Flyway migrations ready to scale

**Major gaps:**
- No REST-Assured (would need explicit add if testing external services)
- No MinIO Testcontainers (tests degrade gracefully; could be enhanced)
- No abstract base classes (opportunity for DRY; currently duplicated MockMvc setup)

The foundation is **solid for QA automation expansion**. New test suites can reuse the `@SpringBootTest` + MockMvc pattern (H2-based for speed, or `@ActiveProfiles("tc")` for PostgreSQL-specific tests) and follow the existing Phase*Test naming convention.

================================================================================
# FRONTEND_INFRA
================================================================================
Perfect! Now let me create a comprehensive report. I have all the information I need:

## QA Automation Infrastructure for BigBike Frontend Apps

### 1. bigbike-web (Next.js App Router)

**Location:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-web\`

#### Versions & Ports
- **Next.js:** 16.2.4
- **Dev Port:** 3001 (script: `npm run dev` → `next dev -p 3001`)
- **Build/Start:** `npm run build` / `npm run start` (production mode on port 3000 by default)
- **Node Modules:** Locked via package-lock.json

#### Test Dependencies
- **Playwright:** @playwright/test ^1.60.0 (root: playwright ^1.60.0)
- **Unit Tests:** Vitest ^4.1.5, @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1, jsdom ^29.1.0
- **Coverage:** @vitest/coverage-v8 ^4.1.5

#### Vitest Configuration
- **File:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-web\vitest.config.ts`
- **Setup:** vitest.setup.ts (includes @testing-library/jest-dom)
- **Environment:** jsdom
- **Test Pattern:** `**/__tests__/**/*.{test,spec}.{ts,tsx}` and `**/*.{test,spec}.{ts,tsx}` (excludes node_modules, .next, scripts, e2e)
- **Coverage Scope:** lib/** and components/** (excludes mock data and vn-address-data.ts)

#### Unit Tests
- **Count:** 11 test files (located in `__tests__/` directory)
- **Categories:**
  - API routes: search-suggest-route.test.ts, snapshot-route.test.ts
  - Contracts: commerce-order-detail.test.ts, price-changes.test.ts
  - Schemas: auth.test.ts, checkout.test.ts
  - SEO: robots.test.ts
  - Utils: auth.test.ts, format.test.ts, html.test.ts, variant-match.test.ts
- **Component Tests:** 1 test file (components/catalog/ReviewsSection.test.tsx)

#### Playwright Configuration
- **File:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-web\playwright.config.ts`
- **Base URL:** `http://localhost:3001`
- **Test Dir:** `./e2e/`
- **Timeout:** 90,000ms
- **Action Timeout:** 30,000ms
- **Browsers:** Chromium only
- **Baseline:** Points to **http://localhost:3001** for local dev, not docker stack (3000)

#### E2E Test Suite
- **Location:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-web\e2e\`
- **Test Files:** 9 files (*.e2e.ts and *.spec.ts)
  - smoke.e2e.ts — Basic homepage rendering, landmarks, no serious issues
  - routes.e2e.ts — Public route coverage (50+ routes), account gating, 404 handling
  - catalog.e2e.ts — (exists, size TBD)
  - responsive.e2e.ts — Responsive sweep across breakpoints
  - effects.e2e.ts — Animation/interaction audits
  - visual.e2e.ts — Visual regression baseline capture
  - experience-section.spec.ts — Hero carousel audit (AR, mobile variants, text overlay)
  - hero-banner-responsive-audit.spec.ts — Detailed hero banner audit across 6 viewports (360–2560px)

#### E2E Helper Structure
- **Config:** `e2e/helpers/config.ts`
  - Base URL: env `E2E_BASE_URL` or `PLAYWRIGHT_BASE_URL` or hardcoded `http://103.1.236.148:3000` (live storefront)
  
- **Routes:** `e2e/helpers/routes.ts`
  - 50+ route definitions (public, auth, account, catalog, content, commerce)
  - Sample deep-link slugs (real product/category/brand/news URLs)
  - Account routes that expect guest gating (redirect to /dang-nhap/)
  
- **UI Quality:** `e2e/helpers/ui-quality.ts`
  - Runtime guards: console errors/warnings, page errors, request failures, 4xx/5xx responses
  - Third-party allowlist (Google, Facebook, Sentry, Zalo, YouTube, Maps, Fonts)
  - Benign console patterns (React DevTools, ResizeObserver, Fast Refresh, GTM, preload warnings)
  - Navigation helpers: gotoAndSettle() with auto-scroll, font wait, network idle
  - Layout checks: horizontal overflow detection, broken image detection (with tolerance)
  
- **Viewports:** `e2e/helpers/viewports.ts` (defined via code in tests)
  - Breakpoints: 360, 576, 768, 992, 1200, 1440, 1920, 2560px

#### Web Login Pages & Auth Routes
- **Login Page:** `/dang-nhap/` → `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-web\app\dang-nhap\page.tsx`
  - Form component: LoginForm.tsx (client component)
  - Uses returnTo param for post-login redirect
  - Link to registration at `/dang-ky/`
  
- **Register Page:** `/dang-ky/` → `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-web\app\dang-ky\page.tsx`
  - Form component: RegisterForm.tsx
  - SocialLoginButtons.tsx for OAuth
  
- **Password Reset:** `/quen-mat-khau/` (referenced in route catalog)
  
- **Auth Type:** Session/Cookie-based (implicit from app design; no explicit JWT config in web)

#### Package.json Scripts
```
"dev": "next dev -p 3001"
"build": "next build"
"start": "next start"
"lint": "npm run check:no-runtime-business-data && eslint"
"test": "vitest run"
"test:watch": "vitest"
"test:coverage": "vitest run --coverage"
"test:e2e": "playwright test"
"test:e2e:ui": "playwright test --ui"
"test:e2e:debug": "playwright test --debug"
"test:e2e:report": "playwright show-report"
"test:e2e:responsive": "playwright test responsive"
"test:e2e:visual": "playwright test visual"
"test:e2e:effects": "playwright test effects"
```

---

### 2. bigbike-admin (Vite + React 19.2.4)

**Location:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\`

#### Versions & Ports
- **React:** 19.2.4
- **Vite:** 8.0.4
- **Dev Port:** 4000 (vite.config.js: `server.port: 4000`)
- **Preview Port (E2E):** 4280 (e2e/vite.preview.config.ts)
- **Backend Proxy:** `/api` → `http://localhost:8080`, `/media` → `http://localhost:9000` (MinIO)

#### Test Dependencies
- **Playwright:** @playwright/test ^1.60.0
- **Unit Tests:** None detected (admin is E2E/integration-test first)
- **Build Tools:** Babel @rolldown/plugin-babel ^0.2.2, React Compiler preset

#### Vite Configuration
- **File:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\vite.config.js`
- **Alias:** `@` → `./src`
- **Plugins:** Tailwind CSS, React, Babel with React Compiler
- **Dev Proxy:**
  - `/api` → `http://localhost:8080` (backend)
  - `/media-proxy` → `http://localhost:9000/bigbike-media` (MinIO, rewrite)
  - `/media` → `http://localhost:9000/bigbike-media` (MinIO, rewrite)

#### Playwright Configuration
- **File:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\playwright.config.ts`
- **Base URL:** Env `E2E_BASE_URL` or `http://127.0.0.1:4280` (local preview)
- **Test Dir:** `./e2e/specs`
- **Timeout:** 60,000ms
- **Expect Timeout:** 10,000ms
- **Workers:** 1 (serial, due to per-IP rate limits on login 5/min, refresh 30/min)
- **Retries:** 2 (CI) / 1 (local)
- **Artifacts:** `./e2e/.artifacts`
- **Screenshots:** `./e2e/__screenshots__` (8-viewport matrix)
- **Report:** HTML to `e2e/report`, JSON to `e2e/report/results.json`
- **Browsers:** Chromium only
- **Locale:** vi-VN, Timezone: Asia/Ho_Chi_Minh
- **WebServer:** Managed (if E2E_NO_WEBSERVER not set):
  - Builds with: `VITE_ADMIN_API_BASE=/api/v1 VITE_MINIO_INTERNAL_ORIGIN=http://minio:9000 npm run build && npx vite preview --config e2e/vite.preview.config.ts`
  - Serves on: `http://127.0.0.1:4280`
  - Reuses existing server if running (fix→verify loop support)

#### E2E Test Suite
- **Location:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\e2e\`
- **Spec Files:** 5 files in `./e2e/specs/`
  - auth.spec.ts — Login/logout, credential validation, session bootstrap
  - smoke-routes.spec.ts — Navigation smoke tests grouped by section (sales, products, content, reports, system), list + create screens
  - responsive.spec.ts — Responsive viewport sweep (8 breakpoints: 360–2560px)
  - visual.spec.ts — Visual regression baseline snapshots
  - effects.spec.ts — Animation/interaction audits

#### E2E Fixtures & Infrastructure
- **Fixtures:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\e2e\fixtures\admin-test.ts`
  - Auth strategy: single login per worker (serial), cookie rotation with backoff (429 rate limits)
  - Fixtures: `test` (authenticated, injected refresh cookie), `testAnon` (unauthenticated, for login page)
  - Collectors: console errors/warnings, page errors, API 4xx/5xx, WebSocket issues, resource load failures
  - Console error allowlist: React DevTools, Vite, ERR_ABORTED, favicon, WebSocket failures (non-critical)
  - Refresh cookie: `bb_admin_refresh` (httpOnly, single-use, rotated after each request)
  
- **Env Config:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\e2e\utils\env.ts`
  - Base URL: `http://127.0.0.1:4280` or env `E2E_BASE_URL`
  - Default creds: `admin@bigbike.vn` / `admin123` (override via `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`)
  - API base: `/api/v1`
  - Preview port: 4280
  
- **Quality Utilities:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\e2e\utils\quality.ts`
  - Navigation: gotoAdmin() (full reload), navigateSpa() (history.pushState, zero refresh cost)
  - Readiness: waitForScreenReady() (shell + content visible, network idle, Suspense cleared)
  - Login detection: isOnLogin() (checks `.bb-login-shell`)
  - Overflow audits: getHorizontalOverflow() (page-level scroll check)
  - Viewport fixtures: DESKTOP_VIEWPORT (1440×900) + 8-viewport matrix
  
- **Routes Catalog:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\e2e\utils\routes.ts`
  - 30+ list routes across 5 groups: sales (orders, customers, POS, reviews, coupons, returns, receivables, newsletter), products (products, categories, brands, attributes, inventory, serials, warranties), content (pages, sliders, videos, menu, media, redirects), reports, system (shipping, settings, roles, audit logs, admin users)
  - 4 create routes: product, category, brand, article
  - Route kinds: list, form, dashboard, workspace

#### Admin Screens & Components
- **Location:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\src\screens\`
- **Count:** 40+ screen files (lazy-loaded with chunk-reload fallback)
- **Examples:**
  - DashboardScreen, OrderListScreen, OrderDetailScreen
  - ProductListScreen, ProductDetailScreen, CategoryListScreen, BrandDetailScreen
  - CustomerListScreen, CustomerDetailScreen
  - InventoryScreen, SettingsScreen, RolesScreen, AuditLogListScreen
  - MediaLibraryScreen, MenuScreen, PosScreen
  - LoginScreen (unauthenticated fallback)

#### Admin Login & Auth
- **Login Route:** `/admin/dashboard` (redirects to login shell if unauthenticated)
- **Login Screen:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-admin\src\screens\LoginScreen.jsx`
  - Shell class: `.bb-login-shell`
  - Input fields: `input[type="email"]`, `input[type="password"]`
  - Submit button: `button[type="submit"]`
  - Error display: `[role="alert"]` inside `.bb-login-shell`
  
- **Auth Type:** JWT (refresh token in httpOnly cookie, access token in memory)
- **Logout:** Via user menu `.bb-user-chip` → danger item → `.bb-user-dropdown-item.danger`
- **Session Recovery:** If refresh cookie rotates/expires, test re-seeds via API login and re-injects cookie

#### Package.json Scripts
```
"dev": "vite"
"build": "npm run check:no-runtime-mock && vite build"
"lint": "npm run check:no-runtime-mock && eslint ."
"preview": "vite preview"
"preview:e2e": "vite preview --config e2e/vite.preview.config.ts"
"test:e2e": "playwright test"
"test:e2e:ui": "playwright test --ui"
"test:e2e:debug": "playwright test --debug"
"test:e2e:report": "playwright show-report e2e/report"
"test:e2e:responsive": "playwright test responsive"
"test:e2e:effects": "playwright test effects"
"test:e2e:admin": "playwright test"
```

---

### 3. Root package.json & Playwright Installation

**Location:** `C:\Users\ADMIN\OneDrive\Documents\bigbike\package.json`

#### Root Dependencies
- **Playwright:** playwright ^1.60.0 (installed at repo root)
- **Scripts:** Delegated to bigbike-web:
  - `npm run dev` → bigbike-web dev
  - `npm run build` → bigbike-web build
  - `npm run start` → bigbike-web start
  - `npm run lint` → bigbike-web lint
  - `npm run test` → bigbike-web test
  - `npm run screenshot:product-listing` → Playwright script
  - `npm run screenshot:product-details` → Playwright script

#### Playwright @ 1.60.0
- Installed at root as devDependency
- Available for both web and admin E2E suites
- CLI available: `npx playwright` (test, show-report, etc.)

---

### 4. Docker Stack & API Configuration

#### Local Docker Ports (as referenced in configs)
- **Web Frontend:** http://localhost:3000 (Next.js production, not in dev config)
- **Admin Frontend (dev):** http://localhost:4000 (Vite dev server)
- **Admin Frontend (E2E):** http://127.0.0.1:4280 (Vite preview, managed)
- **Backend API:** http://localhost:8080 (Spring Boot, proxied as /api/v1)
- **MinIO (Media):** http://localhost:9000 (Vite proxies /media and /media-proxy)

#### API Base Paths
- **Admin:** `/api/v1` (uses relative proxy in Vite)
- **Web:** Backend API called via lib/api/public-api.ts (implied Next.js API routes or direct backend calls)

---

### 5. Test Execution Summary

#### Unit Tests (Web Only)
```bash
npm --prefix bigbike-web run test          # Vitest run mode
npm --prefix bigbike-web run test:watch    # Vitest watch mode
npm --prefix bigbike-web run test:coverage # With coverage report (v8, HTML/lcov)
```

#### E2E Tests (Both Apps)
```bash
# Web
npm --prefix bigbike-web run test:e2e              # All specs
npm --prefix bigbike-web run test:e2e:ui          # Debug UI
npm --prefix bigbike-web run test:e2e:debug       # Step-through debugger
npm --prefix bigbike-web run test:e2e:report      # View HTML report
npm --prefix bigbike-web run test:e2e:responsive  # Responsive specs only
npm --prefix bigbike-web run test:e2e:visual      # Visual regression only
npm --prefix bigbike-web run test:e2e:effects     # Effects/animation specs only

# Admin
npm --prefix bigbike-admin run test:e2e              # All specs
npm --prefix bigbike-admin run test:e2e:ui         # Debug UI
npm --prefix bigbike-admin run test:e2e:debug      # Step-through debugger
npm --prefix bigbike-admin run test:e2e:report     # View HTML report (e2e/report)
npm --prefix bigbike-admin run test:e2e:responsive # Responsive specs only
npm --prefix bigbike-admin run test:e2e:effects    # Effects specs only
npm --prefix bigbike-admin run preview:e2e         # Manual preview server startup
```

---

### 6. Existing vs Missing E2E Infrastructure

#### Existing (Web)
✓ Playwright config (points to localhost:3001)
✓ Test directory (e2e/)
✓ 9 spec files (smoke, routes, responsive, effects, visual, catalog, experience-section, hero-banner-responsive)
✓ Reusable UI-quality helpers (guards, navigation, layout checks)
✓ Route catalog with 50+ routes
✓ Third-party allowlist + benign console patterns
✓ Viewport definitions (8 breakpoints)
✓ Public + account route gating tests

#### Missing (Web)
✗ Authentication E2E (login/logout tests) — no testAnon or test fixtures for session seeding
✗ Account routes E2E (post-auth flow) — not tested beyond 401/403 gating
✗ WebSocket / real-time tests
✗ Checkout / payment flow tests
✗ Error page recovery tests (beyond 404)
✗ Mobile-specific interaction tests (tap, swipe)
✗ API contract tests (schema validation beyond unit tests)

#### Existing (Admin)
✓ Playwright config (auto-managed preview on 4280)
✓ Auth test fixtures (login, session rotation, cookie seeding)
✓ Smoke routes test (list + create screens)
✓ Responsive viewport sweep (8 breakpoints)
✓ Visual regression baseline (snapshot mode)
✓ Effects/animation audit
✓ Route catalog (30+ routes, grouped by section)
✓ Runtime/network quality guards (console, page errors, API 4xx/5xx)
✓ WebSocket issue detection
✓ Per-IP rate limit handling (serial tests, 429 backoff)
✓ Screenshot artifacts on failure (retain-on-failure)

#### Missing (Admin)
✗ Component unit tests (no Vitest setup; E2E-only strategy)
✗ Data-driven CRUD scenarios (create/edit/delete flows per screen)
✗ Permission matrix validation (per-role access tests)
✗ Search/filter/sort interaction tests
✗ Form validation error scenarios
✗ API error recovery (5xx handling)
✗ Offline/network failure scenarios
✗ WebSocket push notification tests
✗ Concurrent action tests (multi-tab, race conditions)
✗ Accessibility (a11y) tests

---

### 7. Key Differences: Web vs Admin E2E Strategy

| Aspect | Web | Admin |
|--------|-----|-------|
| **Framework** | Next.js 16.2.4 | Vite 8 + React 19 |
| **Port (Dev)** | 3001 | 4000 |
| **Port (E2E)** | 3001 | 4280 (managed) |
| **Auth Type** | Session/Cookie | JWT (refresh token in httpOnly cookie, access token in memory) |
| **Test Workers** | Default (parallel) | 1 (serial, due to rate limits) |
| **Fixtures** | None (public-only tests) | test/testAnon (auth seeding, cookie rotation) |
| **Login Tests** | Implied (gating checks only) | Full flow (testAnon fixture) |
| **Unit Tests** | Vitest (11 files) | None |
| **E2E Specs** | 9 files (smoke, routes, responsive, effects, visual, catalog, audits) | 5 files (auth, smoke-routes, responsive, visual, effects) |
| **Baseline URL** | http://103.1.236.148:3000 (live) | http://127.0.0.1:4280 (local preview) |
| **WebServer Mgmt** | Manual (npm run dev) | Automatic (webpack in playwright.config) |

---

### 8. Playwright & Dependency Versions

- **@playwright/test:** ^1.60.0 (both)
- **playwright:** ^1.60.0 (root)
- **Vitest:** ^4.1.5 (web only)
- **Testing Library:** @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1, jsdom ^29.1.0 (web only)

All Playwright configs use **Chromium only** (internal admin tool, no multi-browser requirement for web either).

---

### Summary for QA Automation Planning

**Web (Next.js 3001):** Light E2E coverage (public routes + guest gating), no auth flows, no unit tests for UI. Focused on layout/UX quality (overflow, images, responsive). Opportunity: Add authenticated user flows (cart, checkout, account dashboard).

**Admin (Vite 4000/4280):** Comprehensive E2E coverage (auth, smoke routes, responsive, visual, effects), serial execution with session rotation, managed WebServer. No unit tests (E2E-first strategy). Opportunity: Add component tests, permission-level access validation, CRUD workflows per screen.

**Docker Stack:** Backend 8080, MinIO 9000. Web E2E defaults to live production (103.1.236.148:3000), Admin E2E defaults to local preview (127.0.0.1:4280). Both can be overridden via E2E_BASE_URL.

================================================================================
# DOCS_ORACLE
================================================================================
Perfect! Now let me compile all my findings with the exact evidence paths. Let me create a comprehensive summary:

## ORACLE EXTRACTION: HIGH-RISK QA AREAS (BigBike)

Based on thorough reading of the docs/business/ and docs/engineering/ source-of-truth files, here is the ORACLE (expected behavior) for the 6 highest-risk areas:

---

### **A. ORDER STATE MACHINE**

**Evidence Path:** `docs/business/STATE_MACHINES.md` § 6. Order State Machine + `docs/business/BUSINESS_RULES.md` § Order Completion & Cancellation Rules

#### All Order Statuses:
- `PENDING`
- `PROCESSING`
- `ON_HOLD`
- `COMPLETED`
- `CANCELLED`
- `FAILED`
- `REFUNDED`

#### Allowed Transitions (Key Rules):

| From | To | Precondition | Side Effect | Rule ID |
|------|----|----|----------|---------|
| `PENDING`, `ON_HOLD` | `PROCESSING` | Order exists | Audit, notification, websocket | – |
| `PENDING`, `ON_HOLD` | `CANCELLED` | `paymentStatus ≠ PAID` | Restore stock, release serials, `cancelledAt` set | ORDER_RULE_004 |
| `PROCESSING` | `COMPLETED` | COD: `paymentStatus = PAID`; DELIVERY: `fulfillmentStatus = DELIVERED`; CREDIT: `UNPAID` allowed if `customerId` exists and valid | Set `completedAt`, audit, notification, websocket | ORDER_RULE_001, ORDER_RULE_002, ORDER_RULE_003 |

#### Terminal States (Cannot Reverse):
- `CANCELLED`
- `FAILED`
- `REFUNDED`

#### Forbidden Transitions (Must Reject with 409/Conflict):
- `COMPLETED` → any other state (terminal) — REFUNDED must go through `POST /admin/orders/{id}/refund`
- `CANCELLED` → any state (terminal)
- `FAILED` → any state (terminal)
- `PROCESSING` → `COMPLETED` if `paymentStatus = PAID` AND no valid refund flow initiated (ORDER_RULE_004)
- `PROCESSING` → `COMPLETED` for DELIVERY without `fulfillmentStatus = DELIVERED` (ORDER_RULE_003)
- `PROCESSING` → `COMPLETED` for COD without `paymentStatus = PAID` (ORDER_RULE_002)
- Any state → unknown status value

#### Cancel Behavior:
- **When `CANCELLED`:** `restoreStockForOrder` + `releaseReservationForOrder` (inventory returns; serials released)
- **When `paymentStatus = PAID`:** Direct cancel blocked — must use `POST /admin/orders/{id}/refund` (atomic refund flow)

#### COD Completion Rules:
- `paymentStatus` must = `PAID` before order can move `PROCESSING → COMPLETED`
- Error message (backend): `Đơn COD phải được thu tiền trước khi hoàn thành.`

#### Debt-Order (Credit/AR) Completion Rules:
- `paymentMethod = CREDIT` + `customerId` present + valid customer → `COMPLETED` allowed with `paymentStatus = UNPAID`
- Only non-CREDIT unpaid orders are rejected for COMPLETED
- Error message: `Đơn chưa thanh toán chỉ được hoàn thành khi là đơn công nợ có khách hàng hợp lệ.`

---

### **B. OVERSELL + IDEMPOTENCY**

**Evidence Path:** `docs/business/BUSINESS_RULES.md` § Inventory And Serial Rules, § Coupon Rules; `docs/business/STATE_MACHINES.md` § 9. Inventory / Stock / Serial State Machine

#### Oversell Prevention:
- **Rule STOCK_RULE_005/006:** Checkout enforces stock via:
  - For variants: `variant.quantityOnHand` check before order creation
  - For no-variant products: `product.stockQuantity` check
- **Forbidden:** Cannot create order if `quantityOnHand < requestedQty` (checkout rejects HTTP 400)
- **Race condition (2 buyers, 1 unit):** First buyer succeeds (stock = 0); second buyer is rejected before order creation
- **No double-sell ever gets committed to DB** — stock decrement happens atomically with order creation in transaction

#### Idempotency / Double-Submit Protection:
- **Cart coupon:** One coupon per cart enforced by DB uniqueness + service logic
- **Checkout idempotent:** Same request re-submitted creates new order; no dedup by client token in code (NOT_FOUND_IN_REPO for idempotency key explicit enforcement, but checkout is transactional so double-submit = double-order)
- **POS idempotent:** `idempotency_key` prevents duplicate invoice (CONFIRMED_FROM_CODE `PosOrderService.java`)

#### Price/Stock/Coupon Re-Validation at Checkout:
- **Price re-sync:** `CheckoutService` re-reads `variant.retailPrice` from DB before order creation and reports any changes (CONFIRMED_FROM_CODE)
- **Stock re-check:** Same — quantity rechecked at checkout, not at add-to-cart time
- **Coupon re-validate:** `CheckoutService` loads coupon fresh from DB, validates status/expiry/usage limit, locks row atomically, increments usage (CONFIRMED_FROM_CODE)

#### Rule IDs:
- `STOCK_RULE_001`: New product always `OUT_OF_STOCK` initially
- `STOCK_RULE_005`: Variants drive stock enforcement in checkout
- `STOCK_RULE_006`: No-variant products use `stockQuantity` + `stockState` for enforcement

---

### **C. REFUND**

**Evidence Path:** `docs/business/STATE_MACHINES.md` § 6. Order State Machine (Payment transitions) + `docs/business/BUSINESS_RULES.md` § Order Completion & Cancellation Rules

#### Refund Rules:
- **Full-Only:** `RefundService.applyRefund` only supports full refund (V114 removed partial refund). `refundAmount` must equal full `paidAmount`
- **Authority:** Only via `POST /admin/orders/{id}/refund`; direct status patch `COMPLETED → REFUNDED` is rejected
- **Precondition:** Order `paymentStatus = PAID` only
- **Warranty Cancellation:** Linked warranties voided atomically
- **Serial Restoration:** SOLD serials restored via `SerialLifecycleService.restoreSoldSerialsForRefund`
- **AR Clearance:** Open receivable (if any) written off atomically
- **Order Status:** Flips to `REFUNDED` for any non-terminal order (PENDING/ON_HOLD/PROCESSING/COMPLETED)
- **Terminal:** Once `REFUNDED`, no further action — status change to other states blocked

#### No Further Action After Refunded:
- Order stuck in `REFUNDED` state (terminal)
- No re-opening, no re-charge
- If customer disputes, new return + separate refund flow must be initiated

---

### **D. RETURN/EXCHANGE**

**Evidence Path:** `docs/business/STATE_MACHINES.md` § 10. Return / Refund State Machine + `docs/business/BUSINESS_RULES.md` § Returns And Inspection Rules

#### Return Eligibility:
- **Window:** Only orders in `COMPLETED` status within **30 days** from `orders.completed_at`
- **Rule RETURN_RULE_001:** (CONFIRMED_FROM_CODE)
- **Rule RETURN_RULE_008:** Frontend MUST call `GET /api/v1/customer/orders/{orderId}/return-eligibility` before rendering return form

#### Customer Ownership:
- **Rule RETURN_RULE_006:** Endpoint `GET /api/v1/customer/orders/{orderId}/return-eligibility` is read-only; returns one of: `OK`, `ORDER_NOT_FOUND`, `NOT_OWNER`, `ORDER_NOT_COMPLETED`, `WINDOW_EXPIRED`, `RETURN_IN_PROGRESS`, `NOTHING_TO_RETURN`
- **Constraint:** Customer can only see returns on own orders (enforced by `CustomerReturnService`)

#### Admin Approval Flow:
| From | To | Precondition | Side Effect |
|------|----|----|----------|
| `PENDING` | `APPROVED` | Return exists | History record; approved notification sent |
| `PENDING` | `REJECTED` | Return exists | History record; rejected notification sent |
| `APPROVED` | `RECEIVED` | Approved | Goods-received notification; serial-tracked items marked `RETURNED` |
| `RECEIVED` | `INSPECTING` | Goods received | Optional QC step; admin must call `PATCH /returns/{id}/items/{itemId}/inspect` per item before COMPLETED/REFUNDED |
| `RECEIVED` or `INSPECTING` | `COMPLETED` | Goods received; (if INSPECTING) every item has inspection result | Restore stock **for PASS items only**; FAIL items excluded from inventory |
| `RECEIVED` or `INSPECTING` | `REFUNDED` | Full-order coverage (every line item returned qty = original qty); `refundAmount` provided (= full paidAmount); order `paymentStatus = PAID`; (if INSPECTING) every item inspected | `RefundService.applyRefund` handles all stock/serial restore; RMA-level restore skipped; order → `REFUNDED`; AR written off; refunded notification |

#### Per-Item Inspection (V104):
- **Endpoint:** `PATCH /api/v1/admin/returns/{returnId}/items/{itemId}/inspect`
- **Body:** `{ "result": "PASS"|"FAIL", "note": "..." }`
- **Rules:**
  - Idempotent (overwrites previous decision)
  - Only allowed when return status = `INSPECTING`
  - Blocking: Cannot transition `INSPECTING → COMPLETED/REFUNDED` until **every** item inspected
  - **FAIL items never restock** — kept out of inventory (RETURN_RULE_005)
  - **PASS items restore** — added back to available inventory

#### Safety Items (Helmet/Armor):
- **Implicit rule from V104 context:** INSPECTING is strongly recommended (not mandatory) for safety equipment to catch damage
- **Hard rule:** FAIL items excluded from stock — dangerous/damaged goods never re-enter sellable inventory

#### Restock Only PASS Items:
- Return status `COMPLETED` from `RECEIVED` path: RMA-level `restoreStockForReturn` restores all received items
- Return status `COMPLETED` from `INSPECTING` path: RMA-level `restoreStockForReturn` restores **only PASS items**; FAIL items remain damaged/out-of-inventory
- Return status `REFUNDED`: RMA-level restore skipped; order-level restore via RefundService (all non-FAIL serials restored)

#### Refund-via-Return Rules:
- **Full-order requirement:** RETURN_RULE_007 — every line item must have return qty = original qty (no partial returns to refund)
- **Amount match:** `refundAmount` must equal full `paidAmount` (not partial)
- **Paid order requirement:** Order `paymentStatus = PAID` only
- **Error on partial-coverage:** Backend rejects with `ConflictException` code `RETURN_NOT_FULL_COVERAGE` (409 Conflict)
- **Resolution:** Partial returns close via `COMPLETED`; any standalone refund must go through order-level `POST /admin/orders/{id}/refund`

#### Terminal States:
- `REJECTED`
- `COMPLETED`
- `REFUNDED`

#### One Active Return at a Time:
- **Rule RETURN_RULE_002:** (CONFIRMED_FROM_CODE)
- **Enforcement:** `AdminReturnService` + V65 partial unique index
- **Active:** status ∈ `{PENDING, APPROVED, RECEIVED, INSPECTING}`

---

### **E. ADMIN AUTH / DevAdminAuthService**

**Evidence Path:**
- `docs/engineering/PERMISSION_MATRIX.md` § Role And Permission Source, § Roles
- `docs/engineering/API_CONTRACT.md` § Auth Models
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java` (code)

#### Critical DevAdminAuthService Warning:
**MUST throw in production profile:**
- File: `DevAdminAuthService.java`, lines 99–105
- Code logic:
  ```java
  private void ensureDevMockProfile() {
      String[] activeProfiles = environment.getActiveProfiles();
      Set<String> activeSet = Arrays.stream(activeProfiles)
          .map(p -> p.toLowerCase(Locale.ROOT))
          .collect(Collectors.toSet());
      boolean isProd = activeSet.stream().anyMatch(PROD_PROFILES::contains);
      if (isProd) {
          throw new AuthNotImplementedException("Dev header authentication is not available in production.");
      }
  }
  ```
- **Explicit marker:** `PROD_PROFILES = Set.of("prod", "production")`
- **Behavior:** If any active profile is `prod` or `production`, `ensureDevMockProfile()` throws `AuthNotImplementedException` immediately
- **Real admin auth must work:** In prod, only JWT bearer token + DB role/permission resolution (via `AdminPermissionService`) is accepted (lines 68–79)
- **Status:** `CONFIRMED_FROM_CODE`

#### Real Admin Auth Enforcement (Production Path):
- `requirePermission()` method (lines 67–97):
  - When `SecurityContext` holds `AdminPrincipal` (real JWT), permissions resolved from DB via `AdminPermissionService.getPermissionsForRole(role)`
  - Guest/null auth → `UnauthorizedException` (line 89)
  - **Customer logged in → `UnauthorizedException`** (line 84) — explicitly rejects customer trying to access admin API
- **Controller gating:** All `/api/v1/admin/**` routes require `isAuthenticated() && !hasRole('CUSTOMER')` in Spring Security config (PERMISSION_MATRIX.md line 73)
- **Fine-grained permission:** Each endpoint calls `requirePermission()` with specific permission key (e.g., `orders.write`, `products.update`)

#### Backend Rejection of Guest/Customer on Admin APIs:
- **Guest:** No `Authentication` object in SecurityContext → `UnauthorizedException("No authenticated admin principal.")`
- **Customer:** `auth.getPrincipal() instanceof CustomerPrincipal` → explicitly caught and `UnauthorizedException` thrown (line 84)
- **Error codes:** HTTP `401 UNAUTHORIZED`
- **Status:** `CONFIRMED_FROM_CODE`

#### Role Governance:
- **System roles (immutable):** `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER`, `EDITOR`, `AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR`
- **Custom roles:** Created/edited/deleted via Roles API (non-system, `is_system = FALSE`)
- **SUPER_ADMIN guardrail:** Cannot demote self or the last active `SUPER_ADMIN` (enforced by `AdminAdminUsersService`)
- **Wildcard:** `SUPER_ADMIN` has `*` permission (immutable)

---

### **F. POS**

**Evidence Path:** `docs/business/BUSINESS_RULES.md` § POS Rules + § Order Completion & Cancellation Rules (ORDER_RULE_005)

#### POS Sale Rules:

| Scenario | Order Status | Payment Status | Receivable Created | Permissions | Side Effects |
|----------|------|------|------|------|------|
| **CASH** | `COMPLETED` immediately | `PAID` | N/A | `pos.read`, `pos.write` | Stock decremented; payment recorded as provider = `POS`; staff/customer snapshots stored |
| **CARD_TERMINAL** | `COMPLETED` immediately | `PAID` | N/A | `pos.read`, `pos.write` | Same as CASH |
| **CREDIT** | `COMPLETED` immediately | `UNPAID` | Yes, atomically created | `pos.read`, `pos.write`, `receivables.*` | Customer + `creditEnabled=true` + `creditStatus=ACTIVE` required; receivable created via `ReceivableService.createReceivableForOrder`; **failure rolls back entire transaction** |

#### Stock Deduction:
- **Immediate:** Stock movement `OUT` written at order creation
- **Stock movement record:** Inventory log contains serial numbers if applicable
- **No reversal:** POS-completed orders cannot be cancelled directly (COMPLETED is terminal); must use refund/return flow

#### Payment Recording:
- **Provider:** All POS payments recorded with `payment.provider = "POS"`
- **No external gateway:** Manual reconciliation only (admin marks paid or confirms cash/card received)

#### Idempotency Key (POS):
- **Endpoint:** `POST /api/v1/admin/pos/orders`
- **Guard:** `idempotency_key` prevents duplicate invoice (CONFIRMED_FROM_CODE `PosOrderService.java`)
- **Behavior:** Same key + same request = same order returned; duplicate submit blocked

#### Price Override:
- **Permission:** `pos.price_override` (gated permission, ADMIN/SHOP_MANAGER with override flag)
- **Scope:** Individual line item price can be overridden at point of sale
- **Enforcement:** Backend validates permission before accepting override

#### Credit Order Rules (AR_RULE_001):
- **Eligibility:** Customer `creditEnabled = true` AND `creditStatus = ACTIVE`
- **Credit limit:** Enforced at POS creation (can be bypassed by `receivables.override_limit` permission)
- **Receivable creation failure:** Entire order transaction rolled back (CONFIRMED_FROM_CODE `PosOrderService.java`)

#### No POS Expiry Cleanup:
- **Status:** `NOT_FOUND_IN_REPO`
- **Note:** No scheduled job confirmed for POS order lifecycle cleanup

---

## MARKER INSPECTION

### **NEEDS_VERIFICATION Markers Found:**

1. **STATE_MACHINES.md § 2. State Machine Status Labels** (line 45):
   - Definition only; not a blocking issue per se
   - Used throughout for status labels like `NEEDS_VERIFICATION`, `CONFLICTING_EVIDENCE`, etc.

2. **STATE_MACHINES.md § 6. Order State Machine → Needs Verification** (lines 304–308):
   - Fresh tests for every allowed and forbidden transition
   - Whether order `PENDING` is used by any checkout/POS flow
   - Fulfillment status relation

3. **STATE_MACHINES.md § 9. Inventory § Forbidden Transitions** (line 501):
   - Serial lifecycle states not fully confirmed
   - Flag: `NEEDS_VERIFICATION`

4. **STATE_MACHINES.md § 10. Return State Machine → Needs Verification** (lines 624–625):
   - Customer-created return initial status and eligibility rules
   - Payment/order/report impact of return `REFUNDED` vs order refund flow

5. **STATE_MACHINES.md § 11. User / Admin User → Needs Verification** (lines 703–706):
   - Login behavior for `DISABLED`/`SUSPENDED` users
   - Production admin auth readiness (partially addressed by DevAdminAuthService enforcement)
   - UI confirmation for dangerous role/status actions

6. **BUSINESS_RULES.md § WebSocket Rules** (line 236):
   - Confirmed event type `NEW_ORDER`; `ORDER_STATUS_CHANGED` declared but needs live sender check

### **NOT_FOUND_IN_REPO Markers:**

1. **BUSINESS_RULES.md § Redirect And Integration Rules** (line 250):
   - No external shipping carrier integration confirmed

2. **BUSINESS_RULES.md § POS Rules** (line 103):
   - No POS expiry cleanup lifecycle documented

3. **STATE_MACHINES.md § 19. Missing / Not Confirmed State Machines**:
   - Payment Provider/Webhook lifecycle: `NOT_FOUND_IN_REPO`
   - Shipping Provider/Tracking lifecycle: `NOT_FOUND_IN_REPO`
   - Fulfillment status lifecycle: `STATUS_ONLY` / `NEEDS_VERIFICATION`
   - Serial lifecycle: `NEEDS_VERIFICATION`

### **CONFLICTING_EVIDENCE Markers:**

- **None explicitly found** in the read sections
- Note: `STATE_MACHINES.md § 21. Known Ambiguities` lists potential drift areas (e.g., content admin controller status regex vs shared PublishStatus enum) but these are documented as ambiguities, not CONFLICTING_EVIDENCE markers.

---

## AUDIT-FLAGGED BUGS (docs/audits/)

### **File 1:** `publish-readiness-report.md`
- **Issue:** 0 DRAFT products currently meet the 9 hard gates for publish; only 1 PUBLISHED product (already published, unaffected)
- **Bottleneck:** `short_description` missing on 99.9% of products (1230/1231)
- **Flagged bug:** Product `wp-prod-35864` has name = empty string and NULL seo_title/seo_description — WP import artifact requiring manual fix before any publish attempt
- **Status:** Not a code bug; data quality issue requiring operator action

### **File 2:** `PRODUCT_DATA_REMAINING_ISSUES_AUDIT.md`
- **Issue:** Phase 2 identified 6 data groups; 4 partially/fully resolved, 2 awaiting operator input
- **Unresolved:**
  - 73 products with `retail_price = 0` (no auto-fix due to unreliable source)
  - 1230 products missing `short_description` (cannot infer safely)
- **Resolved:**
  - 12 duplicate variant SKUs in WooCommerce import — fixed by renaming duplicates with 6-digit suffix (safety gates passed: 0 order/return references)
  - 2 products with missing image promoted from gallery (auto-fix applied)
  - 388 → 182 missing brand_id (206 assigned; 182 remain without match; 3 MEDIUM require review)
- **Status:** Data migration artifacts, not code bugs

### **File 3:** `PRODUCT_DATA_COMPLETENESS_AUDIT.md`
- **Issue:** WordPress import left products incomplete across 18 tables
- **Pre-Phase-1 state:**
  - 1211/1231 products in DRAFT (not auto-published)
  - 1230/1231 missing `short_description`
  - 1231/1231 missing `seo_canonical_url`
  - 388 missing `brand_id`
  - 212 missing images
  - 73 with `retail_price = 0`
- **No code bugs flagged** — audit is infrastructure/data cleanup

---

## SUMMARY TABLE: Evidence Paths by Area

| Area | Key Evidence Path | Status |
|------|----------|--------|
| A. Order State Machine | `STATE_MACHINES.md` § 6; `BUSINESS_RULES.md` Order Completion Rules | `CONFIRMED_BACKEND_ENFORCED` |
| B. Oversell + Idempotency | `STATE_MACHINES.md` § 9 Inventory; `BUSINESS_RULES.md` Stock State Derivation | `CONFIRMED_BACKEND_ENFORCED` |
| C. Refund | `STATE_MACHINES.md` § 6 Payment; `BUSINESS_RULES.md` Order Completion Rules | `CONFIRMED_BACKEND_ENFORCED` |
| D. Return/Exchange | `STATE_MACHINES.md` § 10; `BUSINESS_RULES.md` Returns Rules | `CONFIRMED_BACKEND_ENFORCED` |
| E. Admin Auth | `PERMISSION_MATRIX.md`; `DevAdminAuthService.java` (prod throw); `API_CONTRACT.md` Auth Models | `CONFIRMED_FROM_CODE` |
| F. POS | `BUSINESS_RULES.md` POS Rules + Order Completion Rules (ORDER_RULE_005) | `CONFIRMED_FROM_CODE` |

---

## CRITICAL OPEN QUESTIONS (NEEDS_VERIFICATION)

1. **Login blocking for DISABLED/SUSPENDED admin users:** Backend `AdminAdminUsersService` updates status, but is the auth filter (`SecurityConfig` or JWT validator) actually checking `AdminUserEntity.status` before issuing/accepting a JWT?

2. **Return REFUNDED vs Order Refund side effects:** When a return transitions `RECEIVED → REFUNDED` and triggers `RefundService.applyRefund`, does the resulting order payment status (`REFUNDED`) and refund amount update match the order-direct refund flow exactly?

3. **Serial lifecycle:** Full state transitions for `StockMovementSerialEntity` (RESERVED → SOLD → RETURNED → IN_STOCK) not modeled in STATE_MACHINES.md; only reference to "movement-log based" handling.

4. **Payment webhook/external gateway:** Docs explicitly state no automatic gateway is implemented (COD/BACS manual only), but any dormant code or future scaffold needs audit.

5. **Fulfillment status:** `fulfillmentStatus` field exists and transitions are mentioned, but no full transition map confirmed in current code.

These are areas where code, tests, or deployment configs should be audited before a major release.

================================================================================
# ENV_CONFIG
================================================================================
Perfect! Now I have all the information needed. Let me compile the comprehensive reconnaissance report:

## BigBike Environment & Deployment Configuration - QA Testing Reconnaissance

### 1. Docker Compose Services

**File:** `/C:\Users\ADMIN\OneDrive\Documents\bigbike\docker-compose.yaml`

| Service | Image | Ports | Healthcheck | Notes |
|---------|-------|-------|-------------|-------|
| **postgres** | `postgres:16-alpine` | 127.0.0.1:5432:5432 | pg_isready probe (10s interval, 5s timeout, 5 retries) | Env: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD |
| **minio** | `minio/minio:RELEASE.2025-04-22T22-12-26Z` | 0.0.0.0:9000:9000, 127.0.0.1:9001:9001 | curl health/live on port 9000 (15s interval, 5 retries) | Console on 9001 (loopback only) |
| **bigbike-backend** | built from Dockerfile | 8080:8080 | wget actuator/health (30s interval, 5 retries, 60s start period) | Spring Boot, depends_on: postgres+minio healthy |
| **bigbike-web** | Next.js, built from Dockerfile | 3000:3000 | wget root / (30s interval, 5 retries, 30s start period) | Depends_on: bigbike-backend healthy |
| **bigbike-admin** | Vite/React, built from Dockerfile | 4000:80 | wget root / (30s interval, 5 retries, 10s start period) | Depends_on: bigbike-backend healthy |
| **bigbike-web-init** | curlimages/curl:8.11.1 | none | none | One-shot init: calls bigbike-web:3000/api/revalidate with tags (depends_on: web healthy) |

**Mail Catcher Status:** ABSENT. No MailHog, GreenMail, or Mailpit service defined. Mail is configured to use a real external SMTP server (Gmail in .env).

---

### 2. Root .env and .env.example Configuration

**Files:**
- `.env` (actual, used by docker-compose)
- `.env.example` (template)

#### Environment Variable Groups:

**PostgreSQL:**
```
POSTGRES_DB=bigbike
POSTGRES_USER=bigbike
POSTGRES_PASSWORD=bigbike_dev_only
```

**MinIO (S3-compatible storage):**
```
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=minio_dev_only
MINIO_BUCKET=bigbike-media
```

**Spring Boot Profile:**
```
SPRING_PROFILES_ACTIVE=dev
BIGBIKE_SEED_ADMIN_PASSWORD=admin123
```

**JWT (required for prod, uses dev default in dev profile):**
```
BIGBIKE_JWT_SECRET=uhM/61719Rt4t4trsJQMRH3KV5Nik6iuunvY8cxI3yo+Sr/SGHqUhl7QNJDzMvHZ
```
(Min 32 chars for prod; dev profile doesn't enforce length; .env.example shows: BIGBIKE_JWT_SECRET=CHANGE_ME_IN_PRODUCTION_USE_RANDOM_32_CHARS)

**CORS:**
```
BIGBIKE_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001,http://103.1.236.148:3000,http://103.1.236.148:4000
```

**Frontend Public URLs (baked at build time):**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BIGBIKE_SITE_URL=http://localhost:3000
```

**On-demand Revalidation (backend → Next.js cache purge):**
```
WEB_REVALIDATE_SECRET=r5cmen/2ajRjxgEz6gnteN8Tm5Wktfmuah+XbzLUHuI=
WEB_REVALIDATE_URL=http://bigbike-web:3000/api/revalidate,http://host.docker.internal:3001/api/revalidate
```

**SMTP / Transactional Email:**
```
BIGBIKE_MAIL_HOST=smtp.gmail.com
BIGBIKE_MAIL_PORT=587
BIGBIKE_MAIL_USERNAME=vominhduc760@gmail.com
BIGBIKE_MAIL_PASSWORD=jgwwnvcavlptrzid
BIGBIKE_MAIL_SMTP_AUTH=true
BIGBIKE_MAIL_STARTTLS=true
BIGBIKE_MAIL_FROM=no-reply@bigbike.vn
BIGBIKE_MAIL_ADMIN=info@bigbike.vn
```

**Email Verification & Reset Base URLs (LOCALHOST POINTING):**
```
BIGBIKE_MAIL_VERIFY_BASE_URL=http://localhost:3000/xac-nhan-email
BIGBIKE_MAIL_RESET_BASE_URL=http://localhost:3000/quen-mat-khau
```

**Backend Public URLs (used in email templates):**
```
BIGBIKE_SITE_BASE_URL=http://localhost:3000
BIGBIKE_ADMIN_BASE_URL=http://localhost:4000
```

**Media URLs:**
```
BIGBIKE_MEDIA_PUBLIC_BASE_URL=http://103.1.236.148:9000/bigbike-media
BIGBIKE_LEGACY_UPLOADS_BASE=http://103.1.236.148:9000/bigbike-media/wp-uploads
BIGBIKE_MEDIA_INTERNAL_URL=http://minio:9000/bigbike-media/wp-uploads
```

**Other:**
```
NEXT_PUBLIC_GTM_ID=          (empty in dev)
SENTRY_DSN=                  (empty in dev)
NEXT_PUBLIC_SENTRY_DSN=      (empty in dev)
```

---

### 3. Backend application.properties + Profiles

**File:** `bigbike-backend/src/main/resources/application.properties`

**Base Configuration (used by all profiles):**

**Database (via env vars):**
```properties
spring.datasource.url=${BIGBIKE_DB_URL:jdbc:postgresql://localhost:5432/bigbike}
spring.datasource.username=${BIGBIKE_DB_USERNAME:bigbike}
spring.datasource.password=${BIGBIKE_DB_PASSWORD:bigbike_dev_only}
spring.datasource.driver-class-name=org.postgresql.Driver
```

**Mail Configuration (CRITICAL FOR QA):**
```properties
spring.mail.host=${BIGBIKE_MAIL_HOST:}
spring.mail.port=${BIGBIKE_MAIL_PORT:587}
spring.mail.username=${BIGBIKE_MAIL_USERNAME:}
spring.mail.password=${BIGBIKE_MAIL_PASSWORD:}
spring.mail.properties.mail.smtp.auth=${BIGBIKE_MAIL_SMTP_AUTH:true}
spring.mail.properties.mail.smtp.starttls.enable=${BIGBIKE_MAIL_STARTTLS:true}
```

When `spring.mail.host` is empty (falsy), Spring Boot does NOT create a `JavaMailSender` bean. EmailDispatchService uses `Optional<JavaMailSender>` — if absent, it logs "Mail not configured — skipped" and returns gracefully (no-op).

**Mail URLs:**
```properties
bigbike.mail.verify-base-url=${BIGBIKE_MAIL_VERIFY_BASE_URL:https://bigbike.vn/xac-nhan-email}
bigbike.mail.reset-base-url=${BIGBIKE_MAIL_RESET_BASE_URL:https://bigbike.vn/quen-mat-khau}
```

**JWT Configuration:**
```properties
bigbike.jwt.secret=${BIGBIKE_JWT_SECRET:dev-change-me-in-production-needs-32chars!!}
bigbike.jwt.access-token-ttl-seconds=${BIGBIKE_JWT_ACCESS_TTL:900}
bigbike.jwt.refresh-token-ttl-seconds=${BIGBIKE_JWT_REFRESH_TTL:604800}
```

**MinIO:**
```properties
bigbike.minio.endpoint=${MINIO_ENDPOINT:http://localhost:9000}
bigbike.minio.access-key=${MINIO_ROOT_USER:minio_admin}
bigbike.minio.secret-key=${MINIO_ROOT_PASSWORD:minio_dev_only}
bigbike.minio.bucket=${MINIO_BUCKET:bigbike-media}
```

**Dev Header Auth (CURRENTLY DISABLED):**
```properties
bigbike.auth.dev-header-enabled=false
```

#### application-dev.properties

**File:** `bigbike-backend/src/main/resources/application-dev.properties`

```properties
spring.flyway.locations=classpath:db/migration,classpath:db/migration-dev

# Dev-only seed credentials
bigbike.seed.admin-password=${BIGBIKE_SEED_ADMIN_PASSWORD:admin-dev-change-me}
spring.flyway.out-of-order=true
management.health.mail.enabled=false

# Internal redirect endpoints: open without token in local dev
bigbike.internal.allow-open=true

# Disable Secure cookie flag so session cookies work over HTTP in local dev
bigbike.cookies.secure=false

# Override verify-email URL to match actual Next.js route (localhost)
bigbike.mail.verify-base-url=http://localhost:3000/xac-nhan-email
```

**Profile behavior (@Profile("!prod")):** DataInitializer seeds a default admin user when DB is empty (email: admin@bigbike.vn, password from BIGBIKE_SEED_ADMIN_PASSWORD env var). Does NOT run in prod.

#### application-prod.properties

**File:** `bigbike-backend/src/main/resources/application-prod.properties`

```properties
# ── Production profile overrides ────────────────────────────────────────────
# Flyway: prod only runs versioned migrations, never dev-seed data
spring.flyway.locations=classpath:db/migration

# Logging: structured JSON output for log aggregators
logging.level.root=WARN
logging.level.com.bigbike=INFO

# Disable Swagger/SpringDoc
springdoc.api-docs.enabled=false
springdoc.swagger-ui.enabled=false

# Actuator: expose only health, info, metrics, prometheus
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.health.show-details=never
management.endpoint.prometheus.enabled=true

# Datasource: connection pool tuned for production
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.max-lifetime=900000

# HTTP compression
server.compression.enabled=true
server.compression.mime-types=application/json,application/javascript,text/css,text/html
```

#### application-mock.properties

**File:** `bigbike-backend/src/main/resources/application-mock.properties`

```properties
spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,org.springframework.boot.data.jpa.autoconfigure.JpaRepositoriesAutoConfiguration,org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration
```

(Disables datasource/JPA/Flyway for testing)

---

### 4. DevAdminAuthService

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java`

**Purpose:** Dev/test authentication bypass via HTTP headers (`X-Admin-Role`, `X-Admin-Permissions`). GATED BY PROFILE CHECKS.

**Key Code:**

```java
@Service
@RequiredArgsConstructor
public class DevAdminAuthService {
    private static final Set<String> DEV_MOCK_PROFILES = Set.of("dev", "mock", "test", "local");
    private static final Set<String> PROD_PROFILES = Set.of("prod", "production");

    @Value("${bigbike.auth.dev-header-enabled:false}")
    private boolean devHeaderEnabled;

    public AdminUserProfile currentAdminUser(HttpServletRequest request) {
        if (!devHeaderEnabled) {
            throw new UnauthorizedException("Dev header authentication is disabled.");
        }
        ensureDevMockProfile();
        // ... header-based auth ...
    }

    private void ensureDevMockProfile() {
        String[] activeProfiles = environment.getActiveProfiles();
        boolean explicitProd = normalizedProfiles.stream().anyMatch(PROD_PROFILES::contains);
        boolean devMock = normalizedProfiles.stream().anyMatch(DEV_MOCK_PROFILES::contains);

        if (!devMock || explicitProd) {
            throw new AuthNotImplementedException(
                    "Production authentication is not implemented yet. Use dev/mock profile for placeholder auth."
            );
        }
    }
}
```

**Fail-Fast Behavior in Production:**
1. If `SPRING_PROFILES_ACTIVE=prod` is detected AND any attempt to use dev headers is made, `ensureDevMockProfile()` throws `AuthNotImplementedException` immediately.
2. Even if header-based auth is somehow enabled, production profile presence triggers instant failure.
3. The service is ALWAYS disabled by default (`bigbike.auth.dev-header-enabled=false` in application.properties).

**Note:** Currently disabled in .env (SPRING_PROFILES_ACTIVE=dev), so header auth is available for local testing only via `X-Admin-Role` and `X-Admin-Permissions` headers (BUT only if `bigbike.auth.dev-header-enabled=true` is set, which it isn't by default).

---

### 5. Email Sending Configuration & JavaMailSender

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/email/EmailDispatchService.java`

**Mail Sender Implementation:**

```java
@Service
@Slf4j
public class EmailDispatchService {
    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final String fromAddress;

    public EmailDispatchService(
            Optional<JavaMailSender> mailSender,
            TemplateEngine templateEngine,
            @Value("${bigbike.mail.from:no-reply@bigbike.vn}") String fromAddress) {
        this.mailSender = mailSender.orElse(null);  // Graceful handling of missing bean
        this.templateEngine = templateEngine;
        this.fromAddress = fromAddress;
    }

    public boolean isEnabled() {
        return mailSender != null;
    }

    private void sendInternal(String to, String replyTo, String subject, String templateName, Context context) {
        if (mailSender == null) {
            log.info("Mail not configured — skipped: template={}, to={}", templateName, to);
            return;  // Graceful no-op when mail is not configured
        }
        // ... send via SMTP ...
    }
}
```

**How JavaMailSender Bean is Created:**

Spring Boot auto-configures `JavaMailSender` ONLY when:
1. `spring.mail.host` is set (non-empty) in properties
2. The mail autoconfiguration is not excluded

In docker-compose.yaml (lines 93-102):
```yaml
BIGBIKE_MAIL_HOST: "${BIGBIKE_MAIL_HOST:-}"  # Falls back to empty string if not set
BIGBIKE_MAIL_PORT: "${BIGBIKE_MAIL_PORT:-587}"
BIGBIKE_MAIL_USERNAME: "${BIGBIKE_MAIL_USERNAME:-}"
BIGBIKE_MAIL_PASSWORD: "${BIGBIKE_MAIL_PASSWORD:-}"
BIGBIKE_MAIL_SMTP_AUTH: "${BIGBIKE_MAIL_SMTP_AUTH:-true}"
BIGBIKE_MAIL_STARTTLS: "${BIGBIKE_MAIL_STARTTLS:-true}"
```

**Current Configuration (from .env):**
- **BIGBIKE_MAIL_HOST:** `smtp.gmail.com` (real SMTP, not a catcher)
- **BIGBIKE_MAIL_PORT:** `587`
- **BIGBIKE_MAIL_USERNAME:** `vominhduc760@gmail.com`
- **BIGBIKE_MAIL_PASSWORD:** `jgwwnvcavlptrzid` (Google App Password)
- **BIGBIKE_MAIL_SMTP_AUTH:** `true`
- **BIGBIKE_MAIL_STARTTLS:** `true`

**Verify & Reset URL Targets:**
- **BIGBIKE_MAIL_VERIFY_BASE_URL:** `http://localhost:3000/xac-nhan-email` (points to local Next.js)
- **BIGBIKE_MAIL_RESET_BASE_URL:** `http://localhost:3000/quen-mat-khau` (points to local Next.js)

These URLs are embedded in email templates and sent to users for password reset/email verification workflows.

---

### Summary for QA Mail Testing

**Current State:**
- Mail integration uses a real external SMTP (Gmail) — credentials exposed in .env
- No mail catcher service in docker-compose
- Email verification and password reset URLs correctly point to localhost:3000
- DevAdminAuthService is disabled by default but has strong profile-based protection against production misuse
- EmailDispatchService gracefully degrades if mail is not configured (falls back to log-only)

**Recommendations for QA Mail Testing:**
1. **Add a mail catcher service** (MailHog, Mailpit, or GreenMail) to docker-compose for automated testing
2. **Set BIGBIKE_MAIL_HOST to the mail catcher container hostname** (e.g., `mailpit:1025`) in .env for local testing
3. **Credentials in .env should be rotated** — vominhduc760@gmail.com App Password is exposed
4. **Verify JWT secret rotation** — the .env contains a hardcoded secret; production should use a unique, dynamically generated value

================================================================================
# API_SURFACE
================================================================================
Perfect! Now let me compile the detailed report with all findings. Let me create a comprehensive markdown report.

Based on my systematic investigation of the BigBike backend codebase, here is the detailed map of high-risk QA areas:

## 1. ADMIN AUTH: Login & JWT Issue

**Endpoint Path & HTTP Method:**
- `POST /api/v1/auth/login` (AuthController:45)
- `POST /api/v1/auth/refresh` (AuthController:55)
- `GET /api/v1/auth/me` (AuthController:87)
- `POST /api/v1/auth/logout` (AuthController:71)

**Controller Class:** `AuthController` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\api\auth\AuthController.java)

**Service Classes:**
- `AdminAuthService` (JWT + password verification)
- `DevAdminAuthService` (dev/mock header bypass + permission enforcement)
- `AdminPermissionService` (DB-driven role → permission mapping with in-memory cache)

**Key Method Names:**
- `AdminAuthService.login()` — password hash verification + JWT generation + refresh token save
- `AdminAuthService.refresh()` — refresh token rotation with revocation tracking
- `AdminAuthService.logout()` — refresh token revocation
- `JwtService.generateAccessToken()` — JWT token generation
- `DevAdminAuthService.requirePermission()` — permission guard (checks JWT OR dev headers)
- `AdminPermissionService.getPermissionsForRole()` — DB-backed, in-memory cached lookup

**Permission Mechanism (DB-Driven):**

`requirePermission()` works as follows (lines 67-97 of DevAdminAuthService):

1. **JWT Path (Production):** If a real `AdminPrincipal` exists in SecurityContext:
   - Fetch permissions from DB via `AdminPermissionService.getPermissionsForRole(role)` 
   - Check if permissions contain `*` (wildcard) OR the required permission
   - Throw `ForbiddenException` if denied
   
2. **Dev Header Bypass (Dev/Mock Only):** If no JWT but `bigbike.auth.dev-header-enabled=true`:
   - Parse `X-Admin-Role` and `X-Admin-Permissions` headers
   - Default role to `ADMIN` if header is blank (potential elevation risk)
   - Validate permissions same way

3. **Cache:** `AdminPermissionService` caches role → permission list in `ConcurrentHashMap` (line 21). Empty results are **not cached** so new roles are picked up without explicit evict() calls. Cache invalidation happens via `evict(roleId)` after role-permissions writes.

**How Admin Endpoints Are Protected:**

All protected endpoints call `devAdminAuthService.requirePermission(request, requiredPermission)` within the handler. Examples:
- `AdminOrderController.updateOrderStatus()` requires `"orders.write"` (line 86)
- `AdminInventoryController.listStock()` requires `"inventory.read"` (line 52)
- Returns `AdminUserProfile` with resolved permissions for downstream use

**Authentication Flow Risky Points:**
- Line 38: `passwordService.dummyVerify()` used to prevent timing attacks on non-existent users
- Lines 42-44: Status check enforces `"ACTIVE"` flag before allowing login
- Line 46: `lastLoginAt` updated on successful login
- Refresh token rotation: old token revoked, new pair issued (lines 80-86)
- httpOnly cookies with SameSite=Lax for refresh token (lines 104-110)

---

## 2. CHECKOUT / ORDER CREATION: Online Customer Orders

**Endpoint Path & HTTP Method:**
- `POST /api/v1/checkout` (CheckoutController:53)
- `POST /api/v1/orders/quick-buy` (CheckoutController:71)
- `GET /api/v1/checkout/options` (CheckoutController:88)

**Controller Class:** `CheckoutController` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\api\checkout\CheckoutController.java)

**Service Class:** `CheckoutService` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\service\checkout\CheckoutService.java)

**Key Method Names:**
- `CheckoutService.checkoutFromCart()` (line 117) — main order creation from cart
- `CheckoutService.quickBuy()` (line 278) — single-product quick order
- `CheckoutService.reserveIdempotency()` (line 499) — idempotency key management
- `CheckoutService.syncPricesAndValidateStock()` (line 866) — pre-checkout validation
- `CheckoutService.applyStockForLineItems()` (line 942) — stock decrement + serial reservation

**Idempotency Implementation:**

Idempotency uses a **dedicated table `checkout_idempotency_keys`** with a unique constraint on `(flow_type, scope_key, idempotency_key)` (lines 499-546):

```java
// Line 517-533: Attempt to INSERT new idempotency record
try {
    jdbcTemplate.update(
        "INSERT INTO checkout_idempotency_keys
         (id, flow_type, scope_key, customer_id, guest_session_id,
          idempotency_key, request_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        reservationId, flowType, scopeKey, customerId, guestSessionId,
        idempotencyKey, requestHash, ...
    );
    return new IdempotencyReservation(reservationId, null);
} catch (DataIntegrityViolationException ex) {
    // Key already exists — load and return existing summary
    CheckoutIdempotencyKeyEntity existing = 
        checkoutIdempotencyKeyRepo.findByFlowTypeAndScopeKeyAndIdempotencyKey(...);
    if (!existing.getRequestHash().equals(requestHash)) {
        throw new ConflictException("Idempotency key was already used for a different request payload.");
    }
    return new IdempotencyReservation(null, loadExistingSummary(existing));
}
```

**Scope Key Logic (lines 595-603):**
- Authenticated customer: `"customer:" + customerId`
- Guest with session: `"guest:" + guestSessionId`
- Full anonymous: `"anonymous"`

**Request Hash:** SHA-256 of request body toString() — validates retry has same payload (line 605-613)

**State Tracking:** After order is saved, `attachOrderToReservation()` updates the idempotency record with the `orderId` so subsequent retries return the same order.

**Oversell Prevention (Multi-Layer):**

1. **Pessimistic Lock on Product/Variant (line 295, 304):**
   ```java
   ProductEntity product = productRepo.findByIdForUpdate(req.productId().toString())
       .orElseThrow(...);
   ```
   Uses `@Lock(LockModeType.PESSIMISTIC_WRITE)` and `SELECT ... FOR UPDATE` (ProductJpaRepository line 33-35)

2. **Serial-Tracked Items (Reservation Path):**
   - Line 309-314: Serial count checked via `serialLifecycleService.countAvailable()`
   - Line 378-379: Serials reserved via `reserveForOrderLine()` which uses **FOR UPDATE SKIP LOCKED** (ProductSerialJpaRepository lines 62-76):
     ```sql
     SELECT * FROM product_serials
     WHERE product_variant_id = :variantId AND status = 'IN_STOCK'
     ORDER BY received_at ASC LIMIT :limit
     FOR UPDATE SKIP LOCKED
     ```
   - Serials transitioned from `IN_STOCK` → `RESERVED` atomically in same transaction (SerialLifecycleService line 93-97)

3. **Non-Serial Variant Stock (Decrement Path):**
   - Line 962-964: `decrementVariantStock()` called after order line item saved
   - Line 990-995: Variant `quantity_on_hand` decremented and saved; stock state recomputed:
     ```java
     int newQty = variant.getQuantityOnHand() - cartItem.getQuantity();
     variant.setQuantityOnHand(newQty);
     variant.setStockState(newQty <= 0 ? OUT_OF_STOCK : (newQty <= threshold ? LOW_STOCK : IN_STOCK));
     variantRepo.save(variant);
     ```
   - `StockMovementEntity` created for audit (line 996-1005)

4. **Product-Level (No Variant) Stock (line 978-984):**
   ```java
   int newQty = product.getStockQuantity() - cartItem.getQuantity();
   product.setStockQuantity(newQty);
   product.setStockState(newQty <= 0 ? ProductStockState.OUT_OF_STOCK : ...);
   productRepo.save(product);
   ```

**Stock Decrement Query (Most Critical):**
File: `CheckoutService.java:989-1005`
```java
private void decrementVariantStock(ProductVariantEntity variant, int qty, UUID orderId, Instant now) {
    int before = variant.getQuantityOnHand();
    int after = before - qty;
    variant.setQuantityOnHand(after);
    inventoryPolicyService.recomputeStockState(variant);
    variantRepo.save(variant);  // JPA save triggers UPDATE with optimistic lock check if @Version present

    StockMovementEntity movement = new StockMovementEntity();
    movement.setVariant(variant);
    movement.setMovementType("OUT");
    movement.setQuantityDelta(-qty);
    movement.setQuantityBefore(before);
    movement.setQuantityAfter(after);
    movement.setReferenceType("ORDER");
    movement.setReferenceId(orderId);
    movement.setCreatedAt(now);
    stockMovementRepo.save(movement);
}
```

**Locking Strategy:**
- ProductVariantEntity does **NOT** have `@Version` field → uses **pessimistic locking** (FOR UPDATE) via `findByIdForUpdate()`
- SerialEntity uses **FOR UPDATE SKIP LOCKED** for non-blocking concurrent reservation
- Coupon redemption uses conditional UPDATE with row count check (line 238):
  ```java
  int redeemed = couponRepo.attemptRedeem(coupon.getId(), now);
  if (redeemed == 0) {
      throw new ConflictException("Coupon limit exhausted concurrently");
  }
  ```

**Coupon Redemption (Line 236-249):**
File: `CouponJpaRepository.java:42`
```java
@Modifying
@Query("UPDATE CouponEntity c SET c.usageCount = c.usageCount + 1, c.updatedAt = :now "
    + "WHERE c.id = :id "
    + "AND c.status = 'ACTIVE' "
    + "AND (c.startsAt IS NULL OR c.startsAt <= :now) "
    + "AND (c.expiresAt IS NULL OR c.expiresAt >= :now) "
    + "AND (c.usageLimit IS NULL OR c.usageCount < c.usageLimit)")
int attemptRedeem(@Param("id") UUID id, @Param("now") Instant now);
```

Returns 0 rows if limit exhausted concurrently (line 238-241 CheckoutService validates).

---

## 3. ORDER STATE TRANSITIONS: Status Changes

**Endpoint Path & HTTP Method:**
- `PATCH /api/v1/admin/orders/{orderId}/status` (AdminOrderController:80)
- `PATCH /api/v1/admin/orders/{orderId}/payment-status` (AdminOrderController:95)
- `PATCH /api/v1/admin/orders/{orderId}/fulfillment` (AdminOrderController:125)

**Controller Class:** `AdminOrderController` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\api\admin\AdminOrderController.java)

**Service Class:** `AdminOrderService` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\service\admin\AdminOrderService.java)

**Key Method Names:**
- `AdminOrderService.updateOrderStatus()` (line 289)
- `AdminOrderService.updatePaymentStatus()` (line 412)
- `AdminOrderService.updateFulfillmentStatus()` (not shown, but similar pattern)
- `AdminOrderService.listAllowedTransitions()` (line 237) — returns legal target statuses for UI

**State Machine Definition (Enum-Based Maps):**

File: `AdminOrderService.java:93-140`

```java
static final Set<String> ALLOWED_ORDER_STATUSES = Set.of(
    "PENDING", "PROCESSING", "ON_HOLD", "COMPLETED", "CANCELLED", "FAILED", "REFUNDED"
);

// Structural transitions (lines 94-108)
static final Map<String, Set<String>> ALLOWED_TRANSITIONS = new HashMap<>();
static {
    ALLOWED_TRANSITIONS.put("PENDING",    Set.of("PROCESSING", "ON_HOLD", "CANCELLED", "FAILED"));
    ALLOWED_TRANSITIONS.put("ON_HOLD",    Set.of("PROCESSING", "CANCELLED", "FAILED"));
    ALLOWED_TRANSITIONS.put("PROCESSING", Set.of("COMPLETED", "CANCELLED", "FAILED"));
    // REFUND forbidden here — must go through POST /refund endpoint
    ALLOWED_TRANSITIONS.put("COMPLETED",  Set.of());  // Terminal
    ALLOWED_TRANSITIONS.put("CANCELLED",  Set.of());  // Terminal
    ALLOWED_TRANSITIONS.put("FAILED",     Set.of());  // Terminal
    ALLOWED_TRANSITIONS.put("REFUNDED",   Set.of());  // Terminal
}

// Payment status transitions (lines 110-121)
static final Map<String, Set<String>> ALLOWED_PAYMENT_TRANSITIONS = new HashMap<>();
static {
    ALLOWED_PAYMENT_TRANSITIONS.put("UNPAID",    Set.of("PAID", "CANCELLED"));
    ALLOWED_PAYMENT_TRANSITIONS.put("PAID",      Set.of("UNPAID"));
    ALLOWED_PAYMENT_TRANSITIONS.put("REFUNDED",  Set.of());  // Terminal
    ALLOWED_PAYMENT_TRANSITIONS.put("CANCELLED", Set.of());  // Terminal
}

// Fulfillment status transitions (lines 127-139)
static final Map<String, Set<String>> ALLOWED_FULFILLMENT_TRANSITIONS = new HashMap<>();
static {
    ALLOWED_FULFILLMENT_TRANSITIONS.put("UNFULFILLED", Set.of("PROCESSING", "CANCELLED"));
    ALLOWED_FULFILLMENT_TRANSITIONS.put("PROCESSING",  Set.of("SHIPPED", "CANCELLED"));
    ALLOWED_FULFILLMENT_TRANSITIONS.put("SHIPPED",     Set.of("DELIVERED", "RETURNED"));
    ALLOWED_FULFILLMENT_TRANSITIONS.put("DELIVERED",   Set.of("RETURNED"));
    ALLOWED_FULFILLMENT_TRANSITIONS.put("CANCELLED",   Set.of());
    ALLOWED_FULFILLMENT_TRANSITIONS.put("RETURNED",    Set.of());
}
```

**Guard Methods (Business Preconditions):**

File: `AdminOrderService.java:253-284`

```java
private boolean canTransitionTo(OrderEntity order, String targetStatus) {
    return switch (targetStatus) {
        case "COMPLETED" -> canComplete(order);
        case "CANCELLED" -> canCancel(order);
        default -> true;
    };
}

private boolean canComplete(OrderEntity order) {
    String fulfillmentType  = order.getFulfillmentType();
    String fulfillmentStatus = order.getFulfillmentStatus();
    String paymentMethod    = order.getPaymentMethod();
    String paymentStatus    = order.getPaymentStatus();
    
    if ("DELIVERY".equalsIgnoreCase(fulfillmentType) && !"DELIVERED".equals(fulfillmentStatus)) {
        return false;  // DELIVERY orders must reach DELIVERED before completion
    }
    if ("COD".equalsIgnoreCase(paymentMethod) && !"PAID".equals(paymentStatus)) {
        return false;  // COD orders must be marked PAID before completion
    }
    if ("UNPAID".equals(paymentStatus)) {
        boolean isCreditOrder = "CREDIT".equalsIgnoreCase(paymentMethod);
        boolean hasCustomer   = order.getCustomerId() != null;
        if (!isCreditOrder || !hasCustomer) return false;  // Only CREDIT + authenticated customer allowed UNPAID
    }
    return true;
}

private boolean canCancel(OrderEntity order) {
    return !"PAID".equals(order.getPaymentStatus());  // Cannot cancel PAID orders
}
```

**Transition Validation in updateOrderStatus (lines 288-321):**

```java
@Transactional
public AdminOrderDetailResponse updateOrderStatus(UUID orderId, UUID adminId, 
        UpdateOrderStatusRequest req, String clientIp, String userAgent) {
    String newStatus = req.status().toUpperCase(Locale.ROOT);
    if (!ALLOWED_ORDER_STATUSES.contains(newStatus)) {
        throw ValidationException.fromField("status", "INVALID", "Unknown order status: " + newStatus);
    }
    
    OrderEntity order = orderRepo.findById(orderId).orElseThrow(...);
    String currentStatus = order.getStatus();
    
    // Idempotent: same status → return current state, no write
    if (currentStatus.equals(newStatus)) {
        return toDetail(order);
    }
    
    // Structural validation: check if transition is in ALLOWED_TRANSITIONS map
    Set<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of());
    if (!allowed.contains(newStatus)) {
        throw new ConflictException("Cannot transition order from " + currentStatus + " to " + newStatus + ".");
    }
    
    // Business preconditions
    if ("COMPLETED".equals(newStatus)) {
        validateBeforeComplete(order);
    } else if ("CANCELLED".equals(newStatus)) {
        validateBeforeCancel(order);
    }
```

**Serial Lifecycle Hooks (lines 368-381):**

```java
if ("COMPLETED".equals(newStatus)) {
    // Transition serials IN_STOCK → RESERVED → SOLD + create warranty records
    serialLifecycleService.markSoldForOrder(orderId);
    webRevalidationService.revalidateProductsForOrder(orderId);
} else if ("CANCELLED".equals(newStatus) || "FAILED".equals(newStatus)) {
    // Release RESERVED serials back to IN_STOCK + restore non-serial stock
    serialLifecycleService.releaseReservationForOrder(orderId, "ORDER_" + newStatus);
    orderStockRestoreService.restoreForCancel(orderId);
    webRevalidationService.revalidateProductsForOrder(orderId);
}
```

---

## 4. REFUND: Full Order Refund Flow

**Endpoint Path & HTTP Method:**
- `POST /api/v1/admin/orders/{orderId}/refund` (AdminOrderController:110)
- `POST /api/v1/admin/pos/orders/{orderId}/refund` (AdminPosController:124) — delegates to same service

**Controller Class:** `AdminOrderController` (for admin), `AdminPosController` (for POS)

**Service Class:** `RefundService` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\service\payment\RefundService.java)

**Key Method Names:**
- `RefundService.applyRefund()` (line 64) — single authoritative refund implementation
- `AdminOrderService.createRefund()` — delegates to RefundService
- `AdminReturnService.updateStatus()` — delegates to RefundService when return reaches REFUNDED

**Refund Flow (lines 64-200):**

```java
@Transactional
public void applyRefund(UUID orderId, UUID adminId, BigDecimal refundAmount, 
        String refundReason, String noteContent, boolean customerVisible, 
        String clientIp, String userAgent) {
    
    OrderEntity order = orderRepo.findById(orderId).orElseThrow(...);
    
    String paymentStatus = order.getPaymentStatus();
    if (!"PAID".equals(paymentStatus)) {
        throw new ConflictException("Refund requires payment status PAID. Current: " + paymentStatus);
    }
    
    BigDecimal scaled = refundAmount.setScale(2, RoundingMode.HALF_UP);
    BigDecimal alreadyRefunded = order.getRefundAmount() != null ? order.getRefundAmount() : BigDecimal.ZERO;
    BigDecimal maxRefundable = order.getPaidAmount().subtract(alreadyRefunded);
    
    if (scaled.compareTo(BigDecimal.ZERO) <= 0) {
        throw ValidationException.fromField("refundAmount", "INVALID", "refundAmount must be > 0.");
    }
    // CRITICAL: Partial refunds NOT supported — must refund entire remaining amount
    if (scaled.compareTo(maxRefundable) != 0) {
        throw ValidationException.fromField("refundAmount", "INVALID",
            "refundAmount must equal the full refundable amount (" + maxRefundable + 
            "). Partial refunds are not supported.");
    }
    
    Instant now = Instant.now();
    BigDecimal newTotalRefunded = alreadyRefunded.add(scaled);
    
    order.setRefundAmount(newTotalRefunded);
    order.setRefundReason(refundReason);
    order.setRefundedAt(now);
    
    // Update payment and order status atomically
    order.setPaymentStatus("REFUNDED");
    if (!Set.of("CANCELLED", "FAILED", "REFUNDED").contains(order.getStatus())) {
        order.setStatus("REFUNDED");
    }
    order.setUpdatedAt(now);
    orderRepo.save(order);
    
    // Stock/Serial restoration (lines 125-136)
    if (wasCompleted) {
        // COMPLETED: serials are SOLD → restore them to IN_STOCK
        orderStockRestoreService.restoreForRefund(orderId);
        serialLifecycleService.restoreSoldSerialsForRefund(orderId, adminId);
        webRevalidationService.revalidateProductsForOrder(orderId);
    } else if (wasActive) {
        // PENDING/ON_HOLD/PROCESSING: serials are RESERVED → release back to IN_STOCK
        orderStockRestoreService.restoreForRefund(orderId);
        serialLifecycleService.releaseReservationForOrder(orderId, "ORDER_REFUNDED");
        webRevalidationService.revalidateProductsForOrder(orderId);
    }
    
    // Write-off outstanding receivable if AR exists (lines 140-150)
    receivableRepo.findByOrderId(orderId).ifPresent(ar -> {
        if (!"CLOSED".equals(ar.getStatus()) && !"WRITTEN_OFF".equals(ar.getStatus())) {
            ar.setWrittenOffAmount(ar.getOutstandingAmount());
            ar.setOutstandingAmount(BigDecimal.ZERO);
            ar.setStatus("WRITTEN_OFF");
            ar.setWriteOffReason("ORDER_REFUNDED");
            ar.setWrittenOffAt(now);
            ar.setUpdatedAt(now);
            receivableRepo.save(ar);
        }
    });
    
    // Create refund transaction record (lines 161-171)
    RefundTransactionEntity tx = new RefundTransactionEntity();
    tx.setOrder(order);
    tx.setPaymentId(resolvedPaymentId);
    tx.setAmount(scaled);
    tx.setReason(refundReason);
    tx.setNote(noteContent);
    tx.setAdminId(adminId);
    tx.setIpAddress(clientIp);
    tx.setUserAgent(userAgent);
    tx.setCreatedAt(now);
    refundTransactionRepo.save(tx);
    
    // Audit log (lines 186-199)
    AuditLogEntity auditLog = new AuditLogEntity();
    auditLog.setActorType("ADMIN");
    auditLog.setActorId(adminId);
    auditLog.setAction("ORDER_REFUND_CREATED");
    auditLog.setResourceType("ORDER");
    auditLog.setResourceId(orderId);
    auditLog.setBeforeData("{\"paymentStatus\":\"" + paymentStatus + "\",\"refundAmount\":\"" + alreadyRefunded + "\"}");
    auditLog.setAfterData("{\"paymentStatus\":\"" + order.getPaymentStatus() + "\",\"refundAmount\":\"" + newTotalRefunded + "\"}");
    auditLog.setIpAddress(clientIp);
    auditLog.setUserAgent(userAgent);
    auditLog.setCreatedAt(now);
    auditLogRepo.save(auditLog);
}
```

**Refund Constraints:**
- Requires payment status = `"PAID"`
- Amount must equal **entire** remaining refundable balance (partial refunds unsupported per V114)
- Order status transitions to `"REFUNDED"` unless already terminal (CANCELLED/FAILED)
- Payment status always → `"REFUNDED"`
- Serials restored based on prior state (SOLD→IN_STOCK or RESERVED→IN_STOCK)
- Outstanding receivable written off atomically

---

## 5. RETURN: Return Request Management

**Endpoint Path & HTTP Method:**
- `POST /api/v1/admin/returns` (AdminReturnController:54) — admin creates return
- `GET /api/v1/admin/returns` (AdminReturnController:33) — list returns
- `GET /api/v1/admin/returns/{returnId}` (AdminReturnController:45) — detail
- `PATCH /api/v1/admin/returns/{returnId}/status` (AdminReturnController:72) — state transition
- `PATCH /api/v1/admin/returns/{returnId}/items/{itemId}/inspect` (AdminReturnController:82) — inspection result

**Controller Class:** `AdminReturnController` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\api\admin\AdminReturnController.java)

**Service Class:** `AdminReturnService` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\service\admin\AdminReturnService.java)

**Key Method Names:**
- `AdminReturnService.listReturns()` (line 105)
- `AdminReturnService.getReturnDetail()` (line 133)
- `AdminReturnService.adminCreateReturn()` — admin initiates return request
- `AdminReturnService.updateStatus()` (line 143) — state machine
- `AdminReturnService.inspectItem()` — mark returned item PASS/FAIL

**State Machine (lines 66-83):**

```java
// Valid transitions:
//   PENDING     → APPROVED | REJECTED
//   APPROVED    → RECEIVED
//   RECEIVED    → INSPECTING | COMPLETED | REFUNDED
//   INSPECTING  → COMPLETED | REFUNDED
//
// INSPECTING is optional but required for high-risk goods (helmet, armor).
// Each ReturnItem must have inspection result (PASS/FAIL) before closing INSPECTING.

static final Map<String, Set<String>> TRANSITIONS = Map.of(
    "PENDING",    Set.of("APPROVED", "REJECTED"),
    "APPROVED",   Set.of("RECEIVED"),
    "RECEIVED",   Set.of("INSPECTING", "COMPLETED", "REFUNDED"),
    "INSPECTING", Set.of("COMPLETED", "REFUNDED")
);

static final Set<String> INSPECTION_RESULTS = Set.of("PASS", "FAIL");
```

**Inspection Guard (lines 157-167):**

```java
// When closing out of INSPECTING state, every item must have inspection result.
// Prevents unchecked goods from being restored or refunded.
if ("INSPECTING".equals(ret.getStatus())
        && ("COMPLETED".equals(newStatus) || "REFUNDED".equals(newStatus))) {
    List<ReturnItemEntity> items = itemRepo.findByReturnId(returnId);
    for (ReturnItemEntity it : items) {
        if (it.getInspectionResult() == null) {
            throw ValidationException.fromField("items", "INSPECTION_INCOMPLETE",
                    "Vẫn còn món chưa được kiểm tra (PASS/FAIL). Sản phẩm: " + it.getProductName());
        }
    }
}
```

**Full Return Coverage Validation (lines 169-193):**

When transitioning to `"REFUNDED"`, the return must cover **every** order line item in full quantity (RETURN_RULE_007):

```java
if ("REFUNDED".equals(newStatus)) {
    if (req.refundAmount() == null || req.refundAmount().compareTo(BigDecimal.ZERO) <= 0) {
        throw ValidationException.fromField("refundAmount", "REQUIRED",
                "refundAmount must be provided and > 0 when transitioning to REFUNDED.");
    }
    // RETURN_RULE_007: must cover every order line item × full quantity
    // Partial refunds are unsupported (V114) — RefundService is full-refund-only
    if (!isFullReturnCoverage(ret.getOrderId())) {
        List<OrderLineItemEntity> lineItems = lineItemRepo.findByOrderId(ret.getOrderId());
        String firstMissing = lineItems.stream()
                .filter(li -> itemRepo.sumNonRejectedQuantityByLineItemId(li.getId()) < li.getQuantity())
                .findFirst()
                .map(li -> "'" + li.getProductName() + "' còn " +
                        (li.getQuantity() - itemRepo.sumNonRejectedQuantityByLineItemId(li.getId())) +
                        " món chưa được trả")
                .orElse("một số sản phẩm chưa được trả");
        throw new ConflictException(
                "Không thể hoàn tiền: phiếu trả chưa bao phủ toàn bộ đơn hàng (" + firstMissing + 
                "). Nếu muốn hoàn tiền toàn đơn, dùng nút Hoàn tiền ở trang chi tiết đơn hàng." +
                " (RETURN_NOT_FULL_COVERAGE)");
    }
}
```

**Stock Restoration by Inspection Result:**
- Items marked `PASS`: stock restored based on serial status
- Items marked `FAIL`: stock **not** restored (deemed unsellable)

---

## 6. POS: Point-of-Sale Orders

**Endpoint Path & HTTP Method:**
- `POST /api/v1/admin/pos/orders` (AdminPosController:104) — create POS order
- `GET /api/v1/admin/pos/products/search` (AdminPosController:53) — product search for POS
- `POST /api/v1/admin/pos/orders/{orderId}/refund` (AdminPosController:124) — POS refund

**Controller Class:** `AdminPosController` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\api\admin\AdminPosController.java)

**Service Class:** `PosOrderService` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\service\pos\PosOrderService.java)

**Key Method Names:**
- `PosOrderService.createOrder()` (line 145)
- `RefundService.applyRefund()` — shared with admin order refunds

**Idempotency Key Implementation (lines 176-195):**

```java
// POS orders use orderKey field as idempotency key (differs from checkout approach)
if (req.posIdempotencyKey() != null && !req.posIdempotencyKey().isBlank()) {
    var existing = orderRepo.findByOrderKey(req.posIdempotencyKey());
    if (existing.isPresent()) {
        OrderEntity found = existing.get();
        // Return cached order with calculated change amount
        Long changeAmt = null;
        if ("CASH".equals(found.getPaymentMethod()) && req.tenderedAmount() != null) {
            changeAmt = req.tenderedAmount() - found.getTotalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
        }
        String foundCouponCode1 = appliedCouponRepo.findByOrderId(found.getId())
                .stream().findFirst().map(snap -> snap.getCode()).orElse(null);
        BigDecimal foundDiscount1 = found.getDiscountAmount() != null
                ? found.getDiscountAmount() : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        return new PosOrderResponse(
                found.getId(), found.getOrderNumber(), found.getStatus(), found.getPaymentStatus(),
                found.getPaymentMethod(), found.getTotalAmount(), req.tenderedAmount(), changeAmt,
                found.getPaidAmount(), found.getRefundAmount(),
                loadItemsForOrder(found.getId()), foundDiscount1, foundCouponCode1);
    }
}
```

**Stock Validation (lines 246-250):**

Serial-tracked variant check:
```java
if (variant.isTrackSerials()) {
    long available = serialLifecycleService.countAvailable(product.getId(), variant.getId());
    if (available < item.quantity()) {
        throw new ConflictException("Sản phẩm '" + product.getName() + "' chỉ còn " +
                available + " serial khả dụng trong kho.");
    }
}
```

**Payment Methods:**
- `"CASH"` — cash on hand, includes change calculation
- `"CARD_TERMINAL"` — card payment via POS terminal
- `"CREDIT"` — store credit (requires valid customer + eligible for credit limit)

**Credit Payment Validation (lines 154-174):**

```java
if ("CREDIT".equals(req.paymentMethod())) {
    if (req.customerId() == null || req.customerId().isBlank()) {
        throw new ConflictException("customerId là bắt buộc khi thanh toán bằng CREDIT.");
    }
    creditCustomer = customerRepo.findById(custId).orElseThrow(...);
}
// Credit policy checked after totaling items
```

---

## 7. INVENTORY / SERIAL: Stock In & Serial Tracking

**Endpoint Paths & HTTP Methods:**
- `GET /api/v1/admin/inventory` (AdminInventoryController:44) — list stock
- `GET /api/v1/admin/inventory/summary` (AdminInventoryController:68) — inventory summary
- `GET /api/v1/admin/inventory/movements` (AdminInventoryController:74) — stock movement history
- `PATCH /api/v1/admin/inventory/variants/{variantId}/adjust` — stock adjustment (not shown)
- `POST /api/v1/admin/inventory/serials/import` — batch serial import

**Controller Class:** `AdminInventoryController` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\api\admin\AdminInventoryController.java)

**Service Classes:**
- `AdminInventoryService` (stock adjustments + movements)
- `AdminSerialService` (individual serial status updates)
- `AdminSerialImportService` (batch import)
- `SerialLifecycleService` (serial state machine + reservation/release/mark sold)
- `InventoryPolicyService` (stock threshold logic)

**Serial Lifecycle State Machine (SerialLifecycleService):**

File: `SerialLifecycleService.java` (C:\Users\ADMIN\OneDrive\Documents\bigbike\bigbike-backend\src\main\java\com\bigbike\bigbike_backend\service\inventory\SerialLifecycleService.java)

Serial status enum: `ProductSerialStatus`
- `IN_STOCK` — available for sale
- `RESERVED` — picked for pending order (ttl-based, auto-release on timeout)
- `SOLD` — delivered to customer (warranty created)
- `RETURNED` — returned by customer (from SOLD)
- `DEFECTIVE` — marked unusable by admin

**Reserve Serials for Order (lines 67-108):**

```java
@Transactional
public void reserveForOrderLine(OrderLineItemEntity lineItem,
                                String productId,
                                String variantId,
                                int quantity,
                                Instant reservedUntil) {
    // Idempotent: already reserved for this line item → skip
    if (olisRepo.findByOrderLineItemId(lineItem.getId()).size() >= quantity) {
        return;
    }
    
    List<ProductSerialEntity> candidates;
    if (variantId != null) {
        // FOR UPDATE SKIP LOCKED prevents double-reservation across concurrent checkouts
        candidates = serialRepo.findAvailableForVariantWithLock(variantId, quantity);
    } else {
        candidates = serialRepo.findAvailableForProductNoVariantWithLock(productId, quantity);
    }
    
    if (candidates.size() < quantity) {
        throw new ConflictException("Không đủ serial khả dụng. Yêu cầu: " + quantity +
                ", khả dụng: " + candidates.size() + ".");
    }
    
    Instant now = Instant.now();
    for (ProductSerialEntity serial : candidates) {
        serial.setStatus(ProductSerialStatus.RESERVED);
        serial.setReservedUntil(reservedUntil);
        serial.setOrderLineItemId(lineItem.getId());
        serial.setUpdatedAt(now);
        serialRepo.save(serial);
        
        OrderLineItemSerialEntity bridge = new OrderLineItemSerialEntity();
        bridge.setOrderLineItemId(lineItem.getId());
        bridge.setSerialId(serial.getId());
        bridge.setCreatedAt(now);
        olisRepo.save(bridge);
        
        writeStockMovement(serial, ProductSerialStatus.IN_STOCK, ProductSerialStatus.RESERVED,
                "ORDER_RESERVE", lineItem.getOrder() != null ? lineItem.getOrder().getId() : null, now);
    }
}
```

**Mark Sold on Order Completion (lines 116-164):**

```java
@Transactional
public void markSoldForOrder(UUID orderId) {
    var order = orderRepo.findById(orderId).orElse(null);
    
    List<OrderLineItemSerialEntity> bridges = olisRepo.findByOrderId(orderId);
    if (bridges.isEmpty()) {
        return;
    }
    
    Instant now = Instant.now();
    int warrantyMonths = warrantyMonths();
    
    for (OrderLineItemSerialEntity bridge : bridges) {
        serialRepo.findById(bridge.getSerialId()).ifPresent(serial -> {
            if (serial.getStatus() == ProductSerialStatus.SOLD) return; // idempotent
            
            ProductSerialStatus from = serial.getStatus();
            serial.setStatus(ProductSerialStatus.SOLD);
            serial.setSoldAt(now);
            serial.setReservedUntil(null);
            serial.setUpdatedAt(now);
            serialRepo.save(serial);
            
            writeStockMovement(serial, from, ProductSerialStatus.SOLD,
                    "ORDER_COMPLETED", orderId, now);
            
            // Create warranty record (12 months default)
            if (!warrantyRepo.existsBySerialId(serial.getId())) {
                WarrantyRecordEntity warranty = new WarrantyRecordEntity();
                warranty.setSerialId(serial.getId());
                warranty.setOrderLineItemId(bridge.getOrderLineItemId());
                if (order != null) {
                    warranty.setCustomerId(order.getCustomerId());
                    warranty.setCustomerEmail(order.getCustomerEmail());
                    warranty.setCustomerPhone(order.getCustomerPhone());
                }
                LocalDate startDate = now.atZone(ZoneOffset.UTC).toLocalDate();
                warranty.setStartDate(startDate);
                warranty.setEndDate(startDate.plusMonths(warrantyMonths));
                warranty.setStatus("ACTIVE");
                warranty.setCreatedAt(now);
                warranty.setUpdatedAt(now);
                warrantyRepo.save(warranty);
            }
        });
    }
}
```

**Release Reservation on Order Cancel (lines 173-195):**

```java
@Transactional
public void releaseReservationForOrder(UUID orderId, String reason) {
    List<OrderLineItemSerialEntity> bridges = olisRepo.findByOrderId(orderId);
    if (bridges.isEmpty()) {
        return;
    }
    
    Instant now = Instant.now();
    for (OrderLineItemSerialEntity bridge : bridges) {
        serialRepo.findById(bridge.getSerialId()).ifPresent(serial -> {
            if (serial.getStatus() != ProductSerialStatus.RESERVED) return; // skip SOLD / already released
            
            serial.setStatus(ProductSerialStatus.IN_STOCK);
            serial.setReservedUntil(null);
            serial.setOrderLineItemId(null);
            serial.setUpdatedAt(now);
            serialRepo.save(serial);
            
            writeStockMovement(serial, ProductSerialStatus.RESERVED, ProductSerialStatus.IN_STOCK,
                    "ORDER_CANCEL", orderId, now);
        });
    }
}
```

**Stock Count Queries (InventoryPolicyService lines 17-30):**

```java
public int lowStockThreshold() {
    return settingRepo.findBySettingKey("low_stock_threshold")
            .map(s -> {
                try { return Integer.parseInt(s.getSettingValue()); }
                catch (NumberFormatException e) { return FALLBACK_THRESHOLD; }
            })
            .orElse(FALLBACK_THRESHOLD);  // Default: 5 units
}

public void recomputeStockState(ProductVariantEntity variant) {
    variant.setStockState(computeStockState(variant.getQuantityOnHand(), lowStockThreshold()));
}
```

---

## Summary of Concurrency & Idempotency Mechanisms

| Area | Mechanism | Implementation | Location |
|------|-----------|----------------|----------|
| **Admin Auth** | JWT + Refresh Token Rotation | Revocation-based invalidation + hash check | AdminAuthService.java:56-87 |
| **Checkout** | Idempotency Key + Pessimistic Lock | Unique constraint table + FOR UPDATE + SKIP LOCKED (serials) | CheckoutService.java:499-546, 295-304, 62-76 |
| **Order Status** | State Machine (Enum Maps) + Guards | ALLOWED_TRANSITIONS + canComplete/canCancel | AdminOrderService.java:93-284 |
| **Refund** | Atomic Multi-Step + Full-Refund-Only | Single service, validates PAID status + full amount | RefundService.java:64-200 |
| **Return** | State Machine + Inspection Guards | TRANSITIONS map + mandatory inspection results | AdminReturnService.java:78-83, 157-167 |
| **POS** | Idempotency Key via orderKey | Lookup by orderKey field + conditional create | PosOrderService.java:176-195 |
| **Serial Reserve** | FOR UPDATE SKIP LOCKED | Native SQL with row-level pessimistic lock + non-blocking | ProductSerialJpaRepository.java:62-96 |
| **Coupon Redeem** | Conditional UPDATE (Row Count Check) | UPDATE with limit check, returns 0 if exhausted | CouponJpaRepository.java:42 |

All methods are marked `@Transactional` to ensure ACID properties. High-risk transitions use pessimistic locking (FOR UPDATE) or optimistic exclusion (unique constraints + exception handling).