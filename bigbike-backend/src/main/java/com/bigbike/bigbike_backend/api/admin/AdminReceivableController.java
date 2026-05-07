package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableAgingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.RecordReceivablePaymentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.UpdateCustomerCreditRequest;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.WriteOffReceivableRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.receivable.ReceivableQueryService;
import com.bigbike.bigbike_backend.service.receivable.ReceivableService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin")
public class AdminReceivableController {

    private static final Set<String> VALID_CREDIT_STATUSES = Set.of("ACTIVE", "SUSPENDED", "BLOCKED");

    private final ReceivableQueryService queryService;
    private final ReceivableService receivableService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;
    private final CustomerJpaRepository customerRepo;

    public AdminReceivableController(
            ReceivableQueryService queryService,
            ReceivableService receivableService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory,
            CustomerJpaRepository customerRepo
    ) {
        this.queryService = queryService;
        this.receivableService = receivableService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
        this.customerRepo = customerRepo;
    }

    // ── Receivable list ───────────────────────────────────────────────────────

    @GetMapping("/receivables")
    public ApiListResponse<ReceivableListItemResponse> listReceivables(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) String q,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "receivables.read");
        return apiResponseFactory.list(
                queryService.listReceivables(page, size, status, customerId, q), request);
    }

    // ── Receivable detail ─────────────────────────────────────────────────────

    @GetMapping("/receivables/{id}")
    public ApiDataResponse<ReceivableDetailResponse> getReceivable(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "receivables.read");
        return apiResponseFactory.data(queryService.getDetail(id), request);
    }

    // ── Receivables by customer ───────────────────────────────────────────────

    @GetMapping("/customers/{customerId}/receivables")
    public ApiListResponse<ReceivableListItemResponse> listByCustomer(
            @PathVariable UUID customerId,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "receivables.read");
        return apiResponseFactory.list(queryService.listByCustomer(customerId, page, size), request);
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    @GetMapping("/receivables/summary")
    public ApiDataResponse<ReceivableSummaryResponse> getSummary(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "receivables.read");
        return apiResponseFactory.data(queryService.getSummary(), request);
    }

    // ── Aging report ──────────────────────────────────────────────────────────

    @GetMapping("/receivables/aging")
    public ApiDataResponse<ReceivableAgingResponse> getAging(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "receivables.read");
        return apiResponseFactory.data(queryService.getAging(), request);
    }

    // ── Record payment ────────────────────────────────────────────────────────

    @PostMapping("/receivables/{id}/payments")
    public ApiDataResponse<ReceivableDetailResponse> recordPayment(
            @PathVariable UUID id,
            @Valid @RequestBody RecordReceivablePaymentRequest req,
            HttpServletRequest request
    ) {
        var admin = devAdminAuthService.requirePermission(request, "receivables.record_payment");
        UUID adminId = resolveAdminId(admin);
        return apiResponseFactory.data(receivableService.recordPayment(id, req, adminId), request);
    }

    // ── Write-off ─────────────────────────────────────────────────────────────

    @PostMapping("/receivables/{id}/write-off")
    public ApiDataResponse<ReceivableDetailResponse> writeOff(
            @PathVariable UUID id,
            @Valid @RequestBody WriteOffReceivableRequest req,
            HttpServletRequest request
    ) {
        var admin = devAdminAuthService.requirePermission(request, "receivables.write_off");
        UUID adminId = resolveAdminId(admin);
        return apiResponseFactory.data(receivableService.writeOff(id, req, adminId), request);
    }

    // ── Customer credit profile management ───────────────────────────────────

    @PatchMapping("/customers/{customerId}/credit")
    public ApiDataResponse<?> updateCustomerCredit(
            @PathVariable UUID customerId,
            @Valid @RequestBody UpdateCustomerCreditRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "receivables.create");

        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found: " + customerId));

        if (req.creditEnabled() != null) customer.setCreditEnabled(req.creditEnabled());
        if (req.creditLimit() != null)   customer.setCreditLimit(req.creditLimit());
        if (req.paymentTermsDays() != null) customer.setPaymentTermsDays(req.paymentTermsDays());
        if (req.creditStatus() != null) {
            if (!VALID_CREDIT_STATUSES.contains(req.creditStatus())) {
                throw new ConflictException("creditStatus không hợp lệ: " + req.creditStatus());
            }
            customer.setCreditStatus(req.creditStatus());
        }
        if (req.creditNote() != null) customer.setCreditNote(req.creditNote());
        customer.setUpdatedAt(Instant.now());
        customerRepo.save(customer);

        return apiResponseFactory.data(toCustomerCreditProfile(customer), request);
    }

    @GetMapping("/customers/{customerId}/credit")
    public ApiDataResponse<?> getCustomerCredit(
            @PathVariable UUID customerId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "receivables.read");
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found: " + customerId));
        return apiResponseFactory.data(toCustomerCreditProfile(customer), request);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static UUID resolveAdminId(Object principal) {
        if (principal instanceof AdminPrincipal ap) {
            try { return UUID.fromString(ap.getId()); } catch (Exception ignored) {}
        }
        return null;
    }

    private record CustomerCreditProfile(
            UUID customerId,
            boolean creditEnabled,
            java.math.BigDecimal creditLimit,
            Integer paymentTermsDays,
            String creditStatus,
            String creditNote
    ) {}

    private CustomerCreditProfile toCustomerCreditProfile(CustomerEntity c) {
        return new CustomerCreditProfile(
                c.getId(), c.isCreditEnabled(), c.getCreditLimit(),
                c.getPaymentTermsDays(), c.getCreditStatus(), c.getCreditNote());
    }
}
