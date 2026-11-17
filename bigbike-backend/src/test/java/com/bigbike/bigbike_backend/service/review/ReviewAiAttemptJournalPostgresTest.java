package com.bigbike.bigbike_backend.service.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real PostgreSQL transactions and locks; every provider response is a test double. */
// The PostgreSQL container is disposable; do not schedule schema drops after it stops.
@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create"}, showSql = false)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(ReviewAiAttemptJournalPostgresTest.Config.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Testcontainers(disabledWithoutDocker = true)
class ReviewAiAttemptJournalPostgresTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @TestConfiguration
    @Import(AuditLogWriter.class)
    @ComponentScan(basePackageClasses = AuditLogWriter.class, useDefaultFilters = false,
            includeFilters = @ComponentScan.Filter(type = FilterType.REGEX, pattern = ".*AuditLogPersister"))
    static class Config {
        @Bean org.springframework.cache.CacheManager cacheManager() {
            return new org.springframework.cache.concurrent.ConcurrentMapCacheManager();
        }
        @Bean MutableClock clock() { return new MutableClock(); }
        @Bean ReviewAiAttemptJournal journal(SiteSettingJpaRepository settings, AuditLogJpaRepository audits,
                ReviewJpaRepository reviews, AuditLogWriter writer, MutableClock clock) {
            return new ReviewAiAttemptJournal(settings, audits, reviews, writer, clock);
        }
    }

    static class MutableClock extends Clock {
        final AtomicReference<Instant> now = new AtomicReference<>();
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(instant(), zone); }
        @Override public Instant instant() { return now.get(); }
    }

    @Autowired ReviewAiAttemptJournal journal;
    @Autowired SiteSettingJpaRepository settings;
    @Autowired AuditLogJpaRepository audits;
    @Autowired ReviewJpaRepository reviews;
    @Autowired AuditLogWriter writer;
    @Autowired MutableClock clock;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    AiReviewModerationClient provider;
    AdminReviewService admin;
    ReviewModerationService moderator;

    @BeforeEach
    void reset() {
        audits.deleteAll(); reviews.deleteAll(); settings.deleteAll();
        clock.now.set(Instant.parse("2026-11-15T18:00:00Z"));
        limit("1");
        provider = mock(AiReviewModerationClient.class);
        admin = mock(AdminReviewService.class);
        when(provider.isConfigured()).thenReturn(true);
        when(provider.classify(anyString(), any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return Optional.of(new AiReviewModerationClient.AiVerdict(false, List.of(), ""));
        });
        moderator = new ReviewModerationService(reviews, new ReviewModerationSettings(settings), provider, admin, journal);
    }

    @Test
    void concurrentDistinctReviewsLimitOneAllowsExactlyOneProviderCall() throws Exception {
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < 8; i++) ids.add(review().getId());
        ExecutorService pool = Executors.newFixedThreadPool(ids.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (Long id : ids) futures.add(pool.submit(() -> {
                try { assertThat(start.await(10, TimeUnit.SECONDS)).isTrue(); }
                catch (InterruptedException e) { throw new IllegalStateException(e); }
                moderator.moderate(id);
            }));
            start.countDown();
            for (Future<?> future : futures) future.get(30, TimeUnit.SECONDS);
        } finally { pool.shutdownNow(); }
        verify(provider, times(1)).classify(anyString(), any());
        assertThat(audits.count()).isEqualTo(1);
        assertThat(spent()).isEqualTo(1);
    }

    @Test
    void concurrentDuplicatePreservesFirstInFlightResult() throws Exception {
        limit("8");
        Long id = review().getId();
        CountDownLatch inProvider = new CountDownLatch(1), release = new CountDownLatch(1);
        when(provider.classify(anyString(), any())).thenAnswer(call -> {
            inProvider.countDown();
            assertThat(release.await(10, TimeUnit.SECONDS)).isTrue();
            return Optional.of(new AiReviewModerationClient.AiVerdict(false, List.of(), ""));
        });
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<?> first = pool.submit(() -> moderator.moderate(id));
            assertThat(inProvider.await(10, TimeUnit.SECONDS)).isTrue();
            moderator.moderate(id);
            verifyNoInteractions(admin);
            release.countDown(); first.get(15, TimeUnit.SECONDS);
        } finally { release.countDown(); pool.shutdownNow(); }
        verify(provider, times(1)).classify(anyString(), any());
        verify(admin, times(1)).applyAutoModeration(eq(id), any());
        assertThat(audits.count()).isEqualTo(1);
    }

    @Test
    void failureAndTimeoutConsumeSlotsWithoutRetry() {
        limit("2");
        Long first = review().getId(), second = review().getId();
        when(provider.classify(anyString(), any())).thenReturn(Optional.empty()).thenThrow(new IllegalStateException("timeout"));
        moderator.moderate(first); moderator.moderate(second);
        moderator.moderate(first); moderator.moderate(second); moderator.moderate(review().getId());
        verify(provider, times(2)).classify(anyString(), any());
        assertThat(spent()).isEqualTo(2);
        var captor = org.mockito.ArgumentCaptor.forClass(ReviewModerationOutcome.class);
        verify(admin, times(3)).applyAutoModeration(any(), captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(outcome -> {
            assertThat(outcome.source()).isEqualTo("SKIPPED");
            assertThat(outcome.blocked()).isFalse();
            assertThat(outcome.resolvedTargetStatus()).isEmpty();
        });
    }

    @Test
    void deletionAndRecreationCannotRestoreBudgetAndMetadataIsSafe() {
        ReviewEntity row = review(); moderator.moderate(row.getId()); reviews.deleteById(row.getId());
        ReviewAiAttemptJournal recreated = new ReviewAiAttemptJournal(settings, audits, reviews, writer, clock);
        Long next = review().getId();
        var result = new TransactionTemplate(transactions).execute(status -> recreated.reserve(next));
        assertThat(result.state()).isEqualTo(ReviewAiAttemptJournal.State.LIMIT_REACHED);
        assertThat(spent()).isEqualTo(1);
        assertThat(audits.findAll()).singleElement().satisfies(entry -> {
            assertThat(entry.getResourceId()).isEqualTo(ReviewAiAttemptJournal.resourceId(row.getId()));
            assertThat(entry.getAfterData()).isEqualTo("{\"version\":1,\"reviewId\":" + row.getId() + ",\"reservationDay\":\"2026-11-16\"}");
            assertThat(entry.getBeforeData()).isNull(); assertThat(entry.getActorId()).isNull();
        });
    }

    @Test
    void databaseAuditFailureRollsBackBeforeHttp() {
        jdbc.execute("alter table audit_logs add constraint test_reject_attempt check (action <> 'REVIEW_AI_ATTEMPT_RESERVED')");
        try {
            moderator.moderate(review().getId());
            verify(provider, never()).classify(anyString(), any());
            assertThat(audits.count()).isZero();
        } finally { jdbc.execute("alter table audit_logs drop constraint test_reject_attempt"); }
        moderator.moderate(review().getId());
        verify(provider, times(1)).classify(anyString(), any()); assertThat(spent()).isEqualTo(1);
    }

    @Test
    void zeroLoweredInvalidAndMissingCurrentSettingsFailClosed() {
        limit("0"); moderator.moderate(review().getId());
        limit("2"); moderator.moderate(review().getId());
        limit("1"); moderator.moderate(review().getId());
        for (String invalid : List.of("", "-1", "invalid")) {
            limit(invalid); moderator.moderate(review().getId());
        }
        settings.deleteAll(); moderator.moderate(review().getId());
        verify(provider, times(1)).classify(anyString(), any());
        assertThat(audits.count()).isEqualTo(1); assertThat(settings.count()).isZero();
    }

    @Test
    void vietnamDayRolloverAllowsNewReviewWithoutReplayingOldReservation() {
        clock.now.set(Instant.parse("2026-11-16T16:59:59Z"));
        Long first = review().getId(); var reservation = journal.reserve(first);
        assertThat(reservation.day()).isEqualTo(LocalDate.parse("2026-11-16"));
        clock.now.set(Instant.parse("2026-11-16T17:00:00Z"));
        assertThat(journal.isCurrentDay(reservation)).isFalse();
        moderator.moderate(first); moderator.moderate(review().getId());
        verify(provider, times(1)).classify(anyString(), any());
        assertThat(audits.count()).isEqualTo(2); assertThat(spent()).isEqualTo(1);
    }

    @Test
    void globalLockRereadsLoweredLimitAfterDayRollover() throws Exception {
        limit("2"); clock.now.set(Instant.parse("2026-11-16T16:59:59Z"));
        Long id = review().getId();
        CountDownLatch locked = new CountDownLatch(1), release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> holder = pool.submit(() -> new TransactionTemplate(transactions).execute(status -> {
                SiteSettingEntity row = settings.findBySettingKeyForUpdate(ReviewModerationSettings.KEY_DAILY_LIMIT).orElseThrow();
                locked.countDown();
                try { assertThat(release.await(10, TimeUnit.SECONDS)).isTrue(); }
                catch (InterruptedException e) { throw new IllegalStateException(e); }
                row.setSettingValue("0"); settings.save(row); return null;
            }));
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();
            Future<?> waiting = pool.submit(() -> moderator.moderate(id));
            await().atMost(Duration.ofSeconds(5)).until(() -> jdbc.queryForObject(
                    "select count(*) from pg_stat_activity where datname = current_database() "
                            + "and wait_event_type = 'Lock' and query like '%site_settings%'", Long.class) > 0);
            clock.now.set(Instant.parse("2026-11-16T17:00:00Z")); release.countDown();
            holder.get(15, TimeUnit.SECONDS); waiting.get(15, TimeUnit.SECONDS);
            verify(provider, never()).classify(anyString(), any()); assertThat(audits.count()).isZero();
            limit("1"); assertThat(journal.reserve(review().getId()).day()).isEqualTo(LocalDate.parse("2026-11-17"));
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test
    void legacySuccessAndFailureCountWithoutDoubleCountingJournaledResults() {
        limit("3");
        for (String source : List.of("AI", "SKIPPED")) {
            ReviewEntity row = review(); row.setModerationSource(source);
            row.setModerationReason("AI_UNAVAILABLE"); row.setModerationCheckedAt(clock.instant()); reviews.save(row);
            moderator.moderate(row.getId());
        }
        ReviewEntity row = review(); moderator.moderate(row.getId());
        row.setModerationSource("AI"); row.setModerationCheckedAt(clock.instant()); reviews.save(row);
        AuditLogEntity legacy = new AuditLogEntity(); legacy.setAction("REVIEW_STATUS_CHANGED");
        legacy.setResourceType("REVIEW"); legacy.setAfterData("not JSON"); legacy.setCreatedAt(clock.instant()); audits.save(legacy);
        assertThat(spent()).isEqualTo(3); moderator.moderate(review().getId());
        verify(provider, times(1)).classify(anyString(), any());
    }

    @Test
    void retentionKeepsOnlyUnresolvedReservationsUntilReviewDeletionOrKnownResult() {
        clock.now.set(Instant.parse("2024-11-15T18:00:00Z"));
        limit("8");
        ReviewEntity unresolved = review(), success = review(), failure = review(), deleted = review();
        for (ReviewEntity row : List.of(unresolved, success, failure, deleted)) {
            assertThat(journal.reserve(row.getId()).state()).isEqualTo(ReviewAiAttemptJournal.State.RESERVED);
        }
        success.setModerationSource("AI");
        success.setModerationCheckedAt(clock.instant());
        reviews.save(success);
        failure.setModerationSource("SKIPPED");
        failure.setModerationReason("AI_UNAVAILABLE");
        failure.setModerationCheckedAt(clock.instant());
        reviews.save(failure);
        reviews.deleteById(deleted.getId());
        AuditLogEntity ordinary = new AuditLogEntity();
        ordinary.setAction("RETENTION_TEST");
        ordinary.setCreatedAt(clock.instant());
        audits.save(ordinary);
        clock.now.set(Instant.parse("2026-11-15T18:00:00Z"));
        Instant cutoff = clock.instant().atZone(ReviewAiAttemptJournal.VN_ZONE).minusMonths(12).toInstant();
        Integer purged = new TransactionTemplate(transactions).execute(
                status -> audits.deleteOlderThanBatch(cutoff, 500));
        assertThat(purged).isEqualTo(4);
        assertThat(audits.findAll()).singleElement().satisfies(entry ->
                assertThat(entry.getResourceId()).isEqualTo(ReviewAiAttemptJournal.resourceId(unresolved.getId())));
        moderator.moderate(unresolved.getId());
        moderator.moderate(success.getId());
        moderator.moderate(failure.getId());
        verify(provider, never()).classify(anyString(), any());
        reviews.deleteById(unresolved.getId());
        Integer finalPurge = new TransactionTemplate(transactions).execute(
                status -> audits.deleteOlderThanBatch(cutoff, 500));
        assertThat(finalPurge).isEqualTo(1);
        assertThat(audits.count()).isZero();
    }

    private void limit(String value) {
        SiteSettingEntity row = settings.findBySettingKey(ReviewModerationSettings.KEY_DAILY_LIMIT).orElseGet(SiteSettingEntity::new);
        row.setSettingKey(ReviewModerationSettings.KEY_DAILY_LIMIT); row.setSettingValue(value);
        row.setSettingGroup("review_moderation"); settings.saveAndFlush(row);
    }
    private ReviewEntity review() {
        ReviewEntity row = new ReviewEntity(); row.setProductId("test-review-product");
        row.setBody("Nội dung riêng tư không được ghi vào nhật ký."); row.setAuthorEmail("private@example.test");
        row.setRating(BigDecimal.valueOf(5)); row.setStatus("PENDING");
        row.setCreatedAt(clock.instant()); row.setUpdatedAt(clock.instant()); return reviews.saveAndFlush(row);
    }
    private long spent() {
        LocalDate day = clock.instant().atZone(ReviewAiAttemptJournal.VN_ZONE).toLocalDate();
        return audits.countReviewAiAttempts(day.atStartOfDay(ReviewAiAttemptJournal.VN_ZONE).toInstant(),
                day.plusDays(1).atStartOfDay(ReviewAiAttemptJournal.VN_ZONE).toInstant());
    }
}
