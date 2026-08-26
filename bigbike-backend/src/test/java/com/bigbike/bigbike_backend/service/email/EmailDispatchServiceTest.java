package com.bigbike.bigbike_backend.service.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.util.Optional;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.springframework.mail.javamail.JavaMailSender;

class EmailDispatchServiceTest {

    @Test
    void reportsProviderHandoffWithoutClaimingFinalDelivery() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        TemplateEngine templateEngine = mock(TemplateEngine.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(templateEngine.process(eq("email/test"), any(Context.class))).thenReturn("<p>test</p>");
        when(mailSender.createMimeMessage()).thenReturn(message);

        EmailDispatchService service = new EmailDispatchService(
                Optional.of(mailSender), templateEngine, "no-reply@example.test", "BigBike");

        boolean acceptedByProvider = service.send("shop@example.test", "Subject", "test", new Context());

        assertThat(acceptedByProvider).isTrue();
        verify(mailSender).send(message);
    }

    @Test
    void reportsProviderFailureAsNotHandedOff() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        TemplateEngine templateEngine = mock(TemplateEngine.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(templateEngine.process(eq("email/test"), any(Context.class))).thenReturn("<p>test</p>");
        when(mailSender.createMimeMessage()).thenReturn(message);
        doThrow(new RuntimeException("provider unavailable")).when(mailSender).send(message);

        EmailDispatchService service = new EmailDispatchService(
                Optional.of(mailSender), templateEngine, "no-reply@example.test", "BigBike");

        assertThat(service.send("shop@example.test", "Subject", "test", new Context())).isFalse();
    }

    @Test
    void reportsDisabledMailAsNotHandedOff() {
        EmailDispatchService service = new EmailDispatchService(
                Optional.empty(), mock(TemplateEngine.class), "no-reply@example.test", "BigBike");

        assertThat(service.send("shop@example.test", "Subject", "test", new Context())).isFalse();
    }
}
