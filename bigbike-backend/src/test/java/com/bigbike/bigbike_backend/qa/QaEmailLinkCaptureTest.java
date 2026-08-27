package com.bigbike.bigbike_backend.qa;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerRegisterRequest;
import com.bigbike.bigbike_backend.service.customer.CustomerAuthService;
import com.bigbike.bigbike_backend.service.customer.CustomerPasswordResetService;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.TestPropertySource;

/**
 * QA — Items 17/19 (🔴): transactional emails are actually dispatched and the verify/reset links
 * point to the configured base URL (localhost:3000 in local/dev). We capture the outgoing
 * MimeMessage with an in-memory JavaMailSender (no real SMTP, the approach chosen for this round).
 *
 * Oracle: CLAUDE.md/AGENTS.md §5.5 — email verify/reset links must use http://localhost:3000 locally;
 * EmailVerificationService builds verifyUrl=verifyBaseUrl+"?token="; CustomerPasswordResetService
 * builds resetUrl=resetBaseUrl+"?token=".
 */
@SpringBootTest
@TestPropertySource(properties = {
        "bigbike.mail.reset-base-url=http://localhost:3000/quen-mat-khau",
        "bigbike.mail.verify-base-url=http://localhost:3000/xac-nhan-email",
})
class QaEmailLinkCaptureTest {

    static final List<MimeMessage> CAPTURED = new CopyOnWriteArrayList<>();

    @TestConfiguration
    static class MailCfg {
        @Bean
        @Primary
        JavaMailSender capturingMailSender() {
            return new JavaMailSenderImpl() {
                @Override
                public void send(MimeMessage... mimeMessages) {
                    for (MimeMessage m : mimeMessages) CAPTURED.add(m);
                }
            };
        }
    }

    @Autowired CustomerAuthService authService;
    @Autowired CustomerPasswordResetService resetService;

    @BeforeEach
    void reset() { CAPTURED.clear(); }

    private static String dump() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (MimeMessage m : CAPTURED) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            m.writeTo(b);
            sb.append(b.toString(StandardCharsets.UTF_8)).append("\n----\n");
        }
        return sb.toString();
    }

    @Test
    @DisplayName("Registration sends a verification email whose link points to localhost:3000")
    void verificationEmailLink() throws Exception {
        String email = "qa-verify-" + System.nanoTime() + "@bigbike.test";
        String phone = "039" + String.format("%07d", Math.abs(System.nanoTime() % 10_000_000L));
        authService.register(
                new CustomerRegisterRequest(
                        email, phone, "QaPass!2345", "QA Verify", "Q", "A", true, "vi"),
                "127.0.0.1", "qa");
        String raw = dump();
        assertThat(CAPTURED).as("a verification email should be dispatched on register").isNotEmpty();
        assertThat(raw).contains("localhost:3000/xac-nhan-email");
    }

    @Test
    @DisplayName("Password reset sends an email whose reset link points to localhost:3000")
    void resetEmailLink() throws Exception {
        String email = "qa-reset-" + System.nanoTime() + "@bigbike.test";
        String phone = "039" + String.format("%07d", Math.abs(System.nanoTime() % 10_000_000L));
        authService.register(
                new CustomerRegisterRequest(
                        email, phone, "QaPass!2345", "QA Reset", "Q", "A", true, "vi"),
                "127.0.0.1", "qa");
        CAPTURED.clear(); // drop the verification email; keep only the reset email
        resetService.requestPasswordReset(email, "127.0.0.1", "qa");
        String raw = dump();
        assertThat(CAPTURED).as("a reset email should be dispatched").isNotEmpty();
        assertThat(raw).contains("localhost:3000/quen-mat-khau");
        assertThat(raw).contains("?token="); // the single-use reset token is embedded in the link
    }
}
