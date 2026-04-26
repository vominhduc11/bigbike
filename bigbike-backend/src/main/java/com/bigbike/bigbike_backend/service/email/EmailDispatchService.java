package com.bigbike.bigbike_backend.service.email;

import jakarta.mail.internet.MimeMessage;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Central HTML-email dispatcher: resolves a Thymeleaf template, renders it,
 * and sends via JavaMailSender. Degrades gracefully when SMTP is not configured.
 */
@Service
public class EmailDispatchService {

    private static final Logger log = LoggerFactory.getLogger(EmailDispatchService.class);

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final String fromAddress;

    public EmailDispatchService(
            Optional<JavaMailSender> mailSender,
            TemplateEngine templateEngine,
            @Value("${bigbike.mail.from:no-reply@bigbike.vn}") String fromAddress) {
        this.mailSender = mailSender.orElse(null);
        this.templateEngine = templateEngine;
        this.fromAddress = fromAddress;
    }

    public boolean isEnabled() {
        return mailSender != null;
    }

    public void send(String to, String subject, String templateName, Context context) {
        sendInternal(to, null, subject, templateName, context);
    }

    public void sendWithReplyTo(String to, String replyTo, String subject, String templateName, Context context) {
        sendInternal(to, replyTo, subject, templateName, context);
    }

    private void sendInternal(String to, String replyTo, String subject, String templateName, Context context) {
        if (mailSender == null) {
            log.info("Mail not configured — skipped: template={}, to={}", templateName, to);
            return;
        }
        try {
            String html = templateEngine.process("email/" + templateName, context);
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            if (replyTo != null && !replyTo.isBlank()) {
                helper.setReplyTo(replyTo);
            }
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
            log.info("Email sent: template={}, to={}", templateName, to);
        } catch (Exception e) {
            log.warn("Failed to send email: template={}, to={}, error={}", templateName, to, e.getMessage());
        }
    }
}
