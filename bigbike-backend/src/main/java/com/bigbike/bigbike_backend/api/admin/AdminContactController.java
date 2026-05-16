package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactMessageDetail;
import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactMessageListItem;
import com.bigbike.bigbike_backend.api.admin.dto.contact.UpdateContactMessageRequest;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminContactService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/contact-messages")
public class AdminContactController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminContactService service;
    private final DevAdminAuthService devAdminAuthService;

    public AdminContactController(
            AdminContactService service,
            DevAdminAuthService devAdminAuthService
    ) {
        this.service = service;
        this.devAdminAuthService = devAdminAuthService;
    }

    @GetMapping
    public PageResult<AdminContactMessageListItem> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "contact.read");
        return service.list(page, size, status, q);
    }

    @GetMapping("/{id}")
    public AdminContactMessageDetail getDetail(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "contact.read");
        return service.getDetail(id);
    }

    @PatchMapping("/{id}")
    public AdminContactMessageDetail update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateContactMessageRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "contact.write");
        return service.update(id, resolveAdminId(), req);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
