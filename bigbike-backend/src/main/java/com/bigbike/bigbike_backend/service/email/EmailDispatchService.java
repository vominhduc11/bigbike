package com.bigbike.bigbike_backend.service.email;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class EmailDispatchService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final String fromAddress;
    private final String fromName;

    public EmailDispatchService(
            Optional<JavaMailSender> mailSender,
            TemplateEngine templateEngine,
            @Value("${bigbike.mail.from:no-reply@bigbike.vn}") String fromAddress,
            @Value("${bigbike.mail.from-name:BigBike}") String fromName) {
        this.mailSender = mailSender.orElse(null);
        this.templateEngine = templateEngine;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
    }

    public boolean isEnabled() {
        return mailSender != null;
    }

    /**
     * Hands a rendered message to the configured mail provider.
     *
     * @return {@code true} when the provider call returned without an error; this is not a
     * delivery receipt from the recipient mailbox
     */
    public boolean send(String to, String subject, String templateName, Context context) {
        return sendInternal(to, null, subject, templateName, context);
    }

    public boolean sendWithReplyTo(String to, String replyTo, String subject, String templateName, Context context) {
        return sendInternal(to, replyTo, subject, templateName, context);
    }

    private boolean sendInternal(String to, String replyTo, String subject, String templateName, Context context) {
        if (mailSender == null) {
            log.info("Mail not configured — skipped: template={}, to={}", templateName, to);
            return false;
        }
        try {
            String html = templateEngine.process("email/" + templateName, context);
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(new InternetAddress(fromAddress, fromName, "UTF-8"));
            helper.setTo(to);
            if (replyTo != null && !replyTo.isBlank()) {
                helper.setReplyTo(replyTo);
            }
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
            log.info(
                    "Email handed off to mail provider; delivery not confirmed: template={}, to={}",
                    templateName,
                    to);
            return true;
        } catch (Exception e) {
            log.warn("Failed to send email: template={}, to={}, error={}", templateName, to, e.getMessage());
            return false;
        }
    }
}
