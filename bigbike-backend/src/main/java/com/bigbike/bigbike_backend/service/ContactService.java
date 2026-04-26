package com.bigbike.bigbike_backend.service;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.public_.dto.ContactRequest;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;

@Service
public class ContactService {

    private static final Logger log = LoggerFactory.getLogger(ContactService.class);

    private final EmailDispatchService emailDispatch;
    private final String adminEmail;

    public ContactService(
            EmailDispatchService emailDispatch,
            @Value("${bigbike.mail.admin:info@bigbike.vn}") String adminEmail) {
        this.emailDispatch = emailDispatch;
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

        if (!emailDispatch.isEnabled()) {
            log.info("Mail not configured — contact email skipped.");
            return;
        }

        Context ctx = new Context();
        ctx.setVariable("fullName", req.fullName());
        ctx.setVariable("phone", req.phone());
        ctx.setVariable("email", req.email() != null && !req.email().isBlank() ? req.email() : null);
        ctx.setVariable("content", req.content());

        String replyTo = req.email() != null && !req.email().isBlank() ? req.email() : null;

        emailDispatch.sendWithReplyTo(
                adminEmail,
                replyTo,
                "[Liên hệ BigBike] " + req.fullName() + " — " + req.phone(),
                "contact-admin",
                ctx);
    }
}
