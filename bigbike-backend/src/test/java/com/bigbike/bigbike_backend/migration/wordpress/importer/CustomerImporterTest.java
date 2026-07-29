package com.bigbike.bigbike_backend.migration.wordpress.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCustomerMapper.MappedCustomer;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CustomerImporterTest {

    @Mock
    private CustomerJpaRepository customerRepository;

    @Mock
    private CustomerAddressJpaRepository addressRepository;

    @InjectMocks
    private CustomerImporter importer;

    @Test
    void normalizesPhoneBeforeLegacyLookupAndStorage() {
        MappedCustomer mapped = customer("+84 (90).123-4567");
        when(customerRepository.findByLegacyId(mapped.sourceId())).thenReturn(Optional.empty());
        when(customerRepository.findFirstByNormalizedPhone("0901234567"))
                .thenReturn(Optional.empty());
        when(customerRepository.save(any(CustomerEntity.class))).thenAnswer(invocation -> {
            CustomerEntity entity = invocation.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });
        when(addressRepository.findByCustomerId(any(UUID.class))).thenReturn(List.of());

        var result = importer.importBatch(
                List.of(mapped),
                new MigrationExecutionOptions(
                        Path.of("fixture.sql"),
                        Set.of(MigrationDomain.CUSTOMERS),
                        100,
                        true,
                        false));

        ArgumentCaptor<CustomerEntity> saved = ArgumentCaptor.forClass(CustomerEntity.class);
        verify(customerRepository).findFirstByNormalizedPhone("0901234567");
        verify(customerRepository).save(saved.capture());
        assertThat(saved.getValue().getPhone()).isEqualTo("0901234567");
        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.failed()).isZero();
    }

    private static MappedCustomer customer(String phone) {
        return new MappedCustomer(
                42L,
                "legacy-customer@bigbike.test",
                "$P$Blegacyhash",
                "Legacy Customer",
                "Customer",
                "Legacy",
                phone,
                "ACTIVE",
                false,
                Instant.parse("2020-01-01T00:00:00Z"),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of());
    }
}
