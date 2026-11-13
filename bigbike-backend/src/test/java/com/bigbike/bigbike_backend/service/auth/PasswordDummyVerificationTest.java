package com.bigbike.bigbike_backend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.Base64;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/** Checks real Argon2 work for unknown accounts without wall-clock thresholds. */
class PasswordDummyVerificationTest {

    private static final String TIMING_SENTINEL = "BigBike timing sentinel, never an account credential";
    private static final String HISTORICAL_MALFORMED_DUMMY =
            "$argon2id$v=19$m=65536,t=3,p=4$dummysaltdummysalt$dummyhashvaluedummyhashvaluedummy";

    private final PasswordService passwordService = new PasswordService();

    @Test
    void historicalDummyFailsBase64ParsingAndReturnsWithAMalformedHashWarning() {
        String[] parts = HISTORICAL_MALFORMED_DUMMY.split("\\$");
        assertThatThrownBy(() -> Base64.getDecoder().decode(parts[5]))
                .isInstanceOf(IllegalArgumentException.class);

        captureEncoderEvents(events -> {
            assertThat(Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8()
                    .matches("Incorrect submitted password", HISTORICAL_MALFORMED_DUMMY)).isFalse();
            assertThat(events.list).anySatisfy(event -> {
                assertThat(event.getLevel()).isEqualTo(Level.WARN);
                assertThat(event.getFormattedMessage()).isEqualTo("Malformed password hash");
                assertThat(event.getThrowableProxy()).isNotNull();
            });
        });
    }

    @Test
    void dummyUsesTheCurrentAccountHashParametersAndActuallyMatchesItsSentinel() {
        String dummy = dummyHash();
        String real = passwordService.hash("Synthetic existing-account password");
        String[] dummyParts = dummy.split("\\$");
        String[] realParts = real.split("\\$");

        assertThat(dummyParts).hasSize(6);
        assertThat(dummyParts[1]).isEqualTo("argon2id");
        assertThat(dummyParts[2]).isEqualTo(realParts[2]);
        assertThat(dummyParts[3]).isEqualTo(realParts[3]);
        assertThat(Base64.getDecoder().decode(dummyParts[4]))
                .hasSameSizeAs(Base64.getDecoder().decode(realParts[4]));
        assertThat(Base64.getDecoder().decode(dummyParts[5]))
                .hasSameSizeAs(Base64.getDecoder().decode(realParts[5]));
        assertThat(passwordService.verify(TIMING_SENTINEL, dummy)).isTrue();
        assertThat(passwordService.verify("Different submitted password", dummy)).isFalse();
    }

    @Test
    void dummyVerificationNeverTakesTheMalformedHashWarningPath() {
        captureEncoderEvents(events -> {
            passwordService.dummyVerify("Incorrect submitted password");
            passwordService.dummyVerify(TIMING_SENTINEL);
            passwordService.dummyVerify("");
            assertThat(events.list).noneMatch(event -> event.getLevel().isGreaterOrEqual(Level.WARN));
        });
    }

    @Test
    void dummyHashIsReusedAcrossAttemptsAndServiceInstances() {
        String initial = dummyHash();
        passwordService.dummyVerify("First synthetic attempt");
        new PasswordService().dummyVerify("Second synthetic attempt");
        assertThat(dummyHash()).isSameAs(initial);
    }

    private static String dummyHash() {
        return (String) ReflectionTestUtils.getField(PasswordService.class, "TIMING_DUMMY_HASH");
    }

    private static void captureEncoderEvents(Consumer<ListAppender<ILoggingEvent>> check) {
        Logger logger = (Logger) LoggerFactory.getLogger(Argon2PasswordEncoder.class);
        Level originalLevel = logger.getLevel();
        boolean originalAdditive = logger.isAdditive();
        ListAppender<ILoggingEvent> events = new ListAppender<>();
        events.start();
        logger.addAppender(events);
        logger.setLevel(Level.WARN);
        logger.setAdditive(false);
        try {
            check.accept(events);
        } finally {
            logger.detachAppender(events);
            logger.setLevel(originalLevel);
            logger.setAdditive(originalAdditive);
            events.stop();
        }
    }
}
