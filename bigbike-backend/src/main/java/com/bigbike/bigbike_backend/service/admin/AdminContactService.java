package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactMessageDetail;
import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactMessageListItem;
import com.bigbike.bigbike_backend.api.admin.dto.contact.UpdateContactMessageRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.mapper.ContactMessageMapper;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.contact.ContactMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.contact.ContactMessageJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminContactService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private static final Set<String> VALID_STATUSES =
            Set.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED");
    private static final Set<String> TERMINAL_STATUSES =
            Set.of("RESOLVED", "CLOSED");

    private final ContactMessageJpaRepository contactRepo;
    private final AdminUserJpaRepository adminUserRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final ContactMessageMapper contactMessageMapper;

    // ── List (paginated) ──────────────────────────────────────────────────────

    public PageResult<AdminContactMessageListItem> list(
            int page, int size, String status, String q
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Specification<ContactMessageEntity> spec = buildSpec(status, q);
        PageRequest pageable = PageRequest.of(pg, sz, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ContactMessageEntity> result = contactRepo.findAll(spec, pageable);

        List<AdminContactMessageListItem> items = result.getContent().stream()
                .map(this::toListItem)
                .toList();

        return new PageResult<>(
                items,
                result.getNumber() + 1,
                result.getSize(),
                (int) result.getTotalElements(),
                result.getTotalPages()
        );
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminContactMessageDetail getDetail(UUID id) {
        ContactMessageEntity m = contactRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Contact message not found."));
        return toDetail(m);
    }

    // ── Patch (status / note / assignee) ─────────────────────────────────────

    @Transactional
    public AdminContactMessageDetail update(UUID id, UUID adminId, UpdateContactMessageRequest req) {
        ContactMessageEntity m = contactRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Contact message not found."));

        // Snapshot before-state for the audit log (only status/assignee — never
        // the customer's message body, email or phone).
        String oldStatus = m.getStatus();
        UUID oldAssignee = m.getAssignedAdminId();

        Instant now = Instant.now();
        boolean changed = false;

        if (req.status() != null) {
            String newStatus = req.status().toUpperCase(Locale.ROOT);
            if (!VALID_STATUSES.contains(newStatus)) {
                throw ValidationException.fromField("status", "INVALID",
                        "status phải là một trong: " + VALID_STATUSES);
            }
            m.setStatus(newStatus);
            // Stamp resolvedAt the first time the message enters a terminal state.
            if (TERMINAL_STATUSES.contains(newStatus) && m.getResolvedAt() == null) {
                m.setResolvedAt(now);
            }
            // Reopening clears resolvedAt so resolution-time metrics stay honest.
            if (!TERMINAL_STATUSES.contains(newStatus)
                    && TERMINAL_STATUSES.contains(oldStatus)) {
                m.setResolvedAt(null);
            }
            changed = true;
        }

        if (req.adminNote() != null) {
            m.setAdminNote(req.adminNote());
            changed = true;
        }

        if (req.assignedAdminId() != null) {
            m.setAssignedAdminId(req.assignedAdminId());
            changed = true;
        }

        if (changed) {
            m.setUpdatedAt(now);
            contactRepo.save(m);
            auditLogRepo.save(buildAudit(
                    adminId, m.getId(),
                    auditSnapshot(oldStatus, oldAssignee, false),
                    auditSnapshot(m.getStatus(), m.getAssignedAdminId(), req.adminNote() != null)));
        }

        return toDetail(m);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminContactMessageListItem toListItem(ContactMessageEntity m) {
        return contactMessageMapper.toListItem(m);
    }

    private AdminContactMessageDetail toDetail(ContactMessageEntity m) {
        String assignedName = null;
        if (m.getAssignedAdminId() != null) {
            assignedName = adminUserRepo.findById(m.getAssignedAdminId())
                    .map(a -> a.getDisplayName())
                    .orElse(null);
        }
        return contactMessageMapper.toDetail(m, assignedName);
    }

    // ── Audit log ─────────────────────────────────────────────────────────────

    private AuditLogEntity buildAudit(UUID adminId, UUID resourceId,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction("CONTACT_MESSAGE_UPDATED");
        log.setResourceType("CONTACT_MESSAGE");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    /**
     * Audit snapshot — only workflow metadata (status, assignee) and a flag for
     * whether the internal note changed. The customer's message body, email and
     * phone are deliberately never written to the audit log.
     */
    private static String auditSnapshot(String status, UUID assignedAdminId, boolean adminNoteChanged) {
        return "{\"status\":\"" + status
                + "\",\"assignedAdminId\":"
                + (assignedAdminId != null ? "\"" + assignedAdminId + "\"" : "null")
                + ",\"adminNoteChanged\":" + adminNoteChanged + "}";
    }

    // ── Spec builder ──────────────────────────────────────────────────────────

    private Specification<ContactMessageEntity> buildSpec(String status, String q) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.toUpperCase(Locale.ROOT)));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("fullName")), pattern),
                        cb.like(cb.lower(root.get("phone")), pattern),
                        cb.like(cb.lower(root.get("email")), pattern),
                        cb.like(cb.lower(root.get("content")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
