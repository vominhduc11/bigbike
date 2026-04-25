package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerAddressResponse;
import com.bigbike.bigbike_backend.api.customer.dto.SaveCustomerAddressRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerAddressService {

    private static final Set<String> VALID_TYPES = Set.of("BILLING", "SHIPPING");

    private final CustomerAddressJpaRepository addressRepo;
    private final CustomerJpaRepository customerRepo;

    public CustomerAddressService(CustomerAddressJpaRepository addressRepo, CustomerJpaRepository customerRepo) {
        this.addressRepo = addressRepo;
        this.customerRepo = customerRepo;
    }

    public List<CustomerAddressResponse> listAddresses(UUID customerId) {
        return addressRepo.findByCustomerId(customerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CustomerAddressResponse save(UUID customerId, SaveCustomerAddressRequest req) {
        String type = req.type() != null ? req.type().toUpperCase() : "SHIPPING";
        if (!VALID_TYPES.contains(type)) {
            throw ValidationException.fromField("type", "INVALID", "Loại địa chỉ phải là BILLING hoặc SHIPPING.");
        }

        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));

        Instant now = Instant.now();
        CustomerAddressEntity address = new CustomerAddressEntity();
        address.setCustomer(customer);
        address.setType(type);
        applyFields(address, req);
        address.setCreatedAt(now);
        address.setUpdatedAt(now);

        if (Boolean.TRUE.equals(req.isDefault())) {
            clearDefault(customerId, type);
            address.setDefault(true);
        }

        return toResponse(addressRepo.save(address));
    }

    @Transactional
    public CustomerAddressResponse update(UUID customerId, UUID addressId, SaveCustomerAddressRequest req) {
        CustomerAddressEntity address = addressRepo.findByIdAndCustomerId(addressId, customerId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy địa chỉ."));

        applyFields(address, req);
        address.setUpdatedAt(Instant.now());

        if (Boolean.TRUE.equals(req.isDefault()) && !address.isDefault()) {
            clearDefault(customerId, address.getType());
            address.setDefault(true);
        }

        return toResponse(addressRepo.save(address));
    }

    @Transactional
    public void delete(UUID customerId, UUID addressId) {
        CustomerAddressEntity address = addressRepo.findByIdAndCustomerId(addressId, customerId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy địa chỉ."));
        addressRepo.delete(address);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void applyFields(CustomerAddressEntity address, SaveCustomerAddressRequest req) {
        if (req.fullName() != null)    address.setFullName(req.fullName());
        if (req.phone() != null)       address.setPhone(req.phone());
        if (req.province() != null)    address.setProvince(req.province());
        if (req.district() != null)    address.setDistrict(req.district());
        if (req.ward() != null)        address.setWard(req.ward());
        if (req.addressLine1() != null) address.setAddressLine1(req.addressLine1());
        if (req.addressLine2() != null) address.setAddressLine2(req.addressLine2());
    }

    private void clearDefault(UUID customerId, String type) {
        addressRepo.findByCustomerIdAndType(customerId, type).forEach(a -> {
            if (a.isDefault()) {
                a.setDefault(false);
                addressRepo.save(a);
            }
        });
    }

    private CustomerAddressResponse toResponse(CustomerAddressEntity a) {
        return new CustomerAddressResponse(
                a.getId(), a.getType(), a.getFullName(), a.getPhone(),
                a.getCountry(), a.getProvince(), a.getDistrict(), a.getWard(),
                a.getAddressLine1(), a.getAddressLine2(), a.isDefault());
    }
}
