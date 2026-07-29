package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import jakarta.persistence.EntityManager;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

@ExtendWith(MockitoExtension.class)
class AdminCustomerCsvExportServiceTest {

    @Mock
    private CustomerJpaRepository customerRepository;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private AdminCustomerCsvExportService service;

    @Test
    void writesEveryPageWithoutApplyingTheGenericReportCap() throws Exception {
        CustomerEntity first = customer("first-customer@bigbike.test");
        CustomerEntity second = customer("second-customer@bigbike.test");
        PageRequest firstPage = PageRequest.of(0, AdminCustomerCsvExportService.PAGE_SIZE);
        PageRequest secondPage = PageRequest.of(1, AdminCustomerCsvExportService.PAGE_SIZE);

        when(customerRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(
                        new PageImpl<>(List.of(first), firstPage, 501),
                        new PageImpl<>(List.of(second), secondPage, 501)
                );

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        service.writeTo(output, "customer", "active", false, true);

        String csv = output.toString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("\uFEFFid,email,phone,display_name");
        assertThat(csv).contains("first-customer@bigbike.test");
        assertThat(csv).contains("second-customer@bigbike.test");
        verify(customerRepository, times(2))
                .findAll(any(Specification.class), any(Pageable.class));
        verify(entityManager, times(2)).clear();
    }

    private static CustomerEntity customer(String email) {
        CustomerEntity customer = new CustomerEntity();
        customer.setId(UUID.randomUUID());
        customer.setEmail(email);
        customer.setPhone("0901234567");
        customer.setDisplayName("CSV Customer");
        customer.setStatus("ACTIVE");
        customer.setCreatedAt(Instant.parse("2026-07-28T00:00:00Z"));
        customer.setUpdatedAt(customer.getCreatedAt());
        return customer;
    }
}
