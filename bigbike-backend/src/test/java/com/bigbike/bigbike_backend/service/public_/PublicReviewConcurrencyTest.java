package com.bigbike.bigbike_backend.service.public_;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class PublicReviewConcurrencyTest {

    private static final String PRODUCT_ID = "prod_ls2_ff800";

    @Autowired
    private PublicReviewService publicReviewService;

    @Test
    void concurrentIdenticalSubmissions_createOnlyOneReview() throws Exception {
        String author = "Concurrent-" + UUID.randomUUID();
        String comment = "Only one concurrent review may be created.";
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<String> first = executor.submit(() -> submitAfter(start, author, comment));
            Future<String> second = executor.submit(() -> submitAfter(start, author, comment));
            start.countDown();

            assertThat(List.of(first.get(), second.get()))
                    .containsExactlyInAnyOrder("CREATED", "DUPLICATE");
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void multiQueryReviewReads_useRepeatableReadSnapshots() throws Exception {
        Transactional publicRead = PublicReviewService.class.getMethod(
                        "getProductReviews",
                        String.class,
                        int.class,
                        int.class,
                        BigDecimal.class,
                        String.class)
                .getAnnotation(Transactional.class);
        Transactional adminSummary = AdminReviewService.class.getMethod("getSummary")
                .getAnnotation(Transactional.class);

        assertThat(publicRead.readOnly()).isTrue();
        assertThat(publicRead.isolation()).isEqualTo(Isolation.REPEATABLE_READ);
        assertThat(adminSummary.readOnly()).isTrue();
        assertThat(adminSummary.isolation()).isEqualTo(Isolation.REPEATABLE_READ);
    }

    private String submitAfter(CountDownLatch start, String author, String comment)
            throws InterruptedException {
        start.await();
        try {
            publicReviewService.submitReview(
                    PRODUCT_ID,
                    author,
                    null,
                    new BigDecimal("4.5"),
                    comment,
                    List.of(),
                    null);
            return "CREATED";
        } catch (ConflictException exception) {
            return "DUPLICATE";
        }
    }
}
