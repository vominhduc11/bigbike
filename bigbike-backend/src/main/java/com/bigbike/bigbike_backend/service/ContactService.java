package com.bigbike.bigbike_backend.service;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.public_.dto.ContactRequest;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class ContactService {

    private static final Logger log = LoggerFactory.getLogger(ContactService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String adminEmail;

    public ContactService(
            Optional<JavaMailSender> mailSender,
            @Value("${bigbike.mail.from:no-reply@bigbike.vn}") String fromAddress,
            @Value("${bigbike.mail.admin:info@bigbike.vn}") String adminEmail) {
        this.mailSender = mailSender.orElse(null);
        this.fromAddress = fromAddress;
        this.adminEmail = adminEmail;
    }

    public void submit(ContactRequest req) {
        if (req.fullName() == null || req.fullName().isBlank()) {
            throw ValidationException.fromField("fullName", "REQUIRED", "Vui lòng nhập họ tên.");
        }
        if (req.phone() == null || req.phone().isBlank()) {
            throw ValidationException.fromField("phone", "REQUIRED", "Vui lòng nhập số điện thoại.");
        }
        if (req.content() == null || req.content().isBlank()) {
            throw ValidationException.fromField("content", "REQUIRED", "Vui lòng nhập nội dung.");
        }

        log.info("Contact form submission — name={}, phone={}, email={}",
                req.fullName(), req.phone(), req.email());

        if (mailSender == null) {
            log.info("No JavaMailSender configured — contact email skipped.");
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(adminEmail);
            message.setReplyTo(req.email() != null && !req.email().isBlank() ? req.email() : fromAddress);
            message.setSubject("[Liên hệ BigBike] " + req.fullName() + " — " + req.phone());
            message.setText(
                    "Họ tên: " + req.fullName() + "\n"
                    + "Điện thoại: " + req.phone() + "\n"
                    + "Email: " + (req.email() != null ? req.email() : "—") + "\n\n"
                    + "Nội dung:\n" + req.content()
            );
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send contact email: {}", e.getMessage());
        }
    }
}
