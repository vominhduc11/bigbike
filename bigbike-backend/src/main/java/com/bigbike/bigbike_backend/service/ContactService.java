package com.bigbike.bigbike_backend.service;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.public_.dto.ContactRequest;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.persistence.entity.contact.ContactMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.contact.ContactMessageJpaRepository;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;

@Service
@Slf4j
public class ContactService {

    private static final int USER_AGENT_MAX_LENGTH = 1000;

    private final EmailDispatchService emailDispatch;
    private final ContactMessageJpaRepository contactMessageRepo;
    private final ClientIpResolver clientIpResolver;
    private final String adminEmail;

    public ContactService(
            EmailDispatchService emailDispatch,
            ContactMessageJpaRepository contactMessageRepo,
            ClientIpResolver clientIpResolver,
            @Value("${bigbike.mail.admin:info@bigbike.vn}") String adminEmail) {
        this.emailDispatch = emailDispatch;
        this.contactMessageRepo = contactMessageRepo;
        this.clientIpResolver = clientIpResolver;
        this.adminEmail = adminEmail;
    }

    @Transactional
    public void submit(ContactRequest req, HttpServletRequest httpRequest) {
        if (req.fullName() == null || req.fullName().isBlank()) {
            throw ValidationException.fromField("fullName", "REQUIRED", "Vui lòng nhập họ tên.");
        }
        if (req.phone() == null || req.phone().isBlank()) {
            throw ValidationException.fromField("phone", "REQUIRED", "Vui lòng nhập số điện thoại.");
        }
        if (req.content() == null || req.content().isBlank()) {
            throw ValidationException.fromField("content", "REQUIRED", "Vui lòng nhập nội dung.");
        }

        Instant now = Instant.now();
        ContactMessageEntity message = new ContactMessageEntity();
        message.setFullName(req.fullName().trim());
        message.setPhone(req.phone().trim());
        message.setEmail(req.email() != null && !req.email().isBlank() ? req.email().trim() : null);
        message.setContent(req.content().trim());
        message.setStatus("OPEN");
        if (httpRequest != null) {
            message.setIpAddress(clientIpResolver.resolve(httpRequest));
            String ua = httpRequest.getHeader("User-Agent");
            if (ua != null && ua.length() > USER_AGENT_MAX_LENGTH) {
                ua = ua.substring(0, USER_AGENT_MAX_LENGTH);
            }
            message.setUserAgent(ua);
        }
        message.setCreatedAt(now);
        message.setUpdatedAt(now);
        contactMessageRepo.save(message);

        log.info("Contact message saved id={} — name={}, phone={}, email={}",
                message.getId(), req.fullName(), req.phone(), req.email());

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

        try {
            emailDispatch.sendWithReplyTo(
                    adminEmail,
                    replyTo,
                    "[Liên hệ BigBike] " + req.fullName() + " — " + req.phone(),
                    "contact-admin",
                    ctx);
        } catch (Exception e) {
            // Email is best-effort — the message is already persisted in the inbox.
            log.warn("Contact admin email failed for id={}: {}", message.getId(), e.getMessage());
        }
    }
}
