package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Streams every customer matching the Customers-screen filters without a row cap. */
@Service
@RequiredArgsConstructor
public class AdminCustomerCsvExportService {

    static final int PAGE_SIZE = 500;
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN_ZONE);

    private final CustomerJpaRepository customerRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public void writeTo(
            OutputStream outputStream,
            String q,
            String status,
            Boolean synthetic,
            Boolean emailVerified
    ) throws IOException {
        String normalizedStatus = AdminCustomerService.normalizeOptionalStatus(status);
        Specification<CustomerEntity> specification =
                AdminCustomerService.buildSpec(q, normalizedStatus, synthetic, emailVerified);
        Sort stableSort = Sort.by(
                Sort.Order.desc("createdAt"),
                Sort.Order.desc("id")
        );

        try (Writer writer = new OutputStreamWriter(outputStream, StandardCharsets.UTF_8);
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT)) {
            writer.write('\uFEFF');
            printer.printRecord(
                    "id", "email", "phone", "display_name",
                    "first_name", "last_name", "status", "gender",
                    "email_verified_at", "last_login_at", "created_at"
            );

            int pageIndex = 0;
            Page<CustomerEntity> page;
            do {
                page = customerRepository.findAll(
                        specification,
                        PageRequest.of(pageIndex, PAGE_SIZE, stableSort)
                );
                for (CustomerEntity customer : page.getContent()) {
                    printer.printRecord(
                            customer.getId(),
                            CsvExportUtil.escape(text(customer.getEmail())),
                            CsvExportUtil.escape(text(customer.getPhone())),
                            CsvExportUtil.escape(text(customer.getDisplayName())),
                            CsvExportUtil.escape(text(customer.getFirstName())),
                            CsvExportUtil.escape(text(customer.getLastName())),
                            customer.getStatus(),
                            CsvExportUtil.escape(text(customer.getGender())),
                            timestamp(customer.getEmailVerifiedAt()),
                            timestamp(customer.getLastLoginAt()),
                            timestamp(customer.getCreatedAt())
                    );
                }
                pageIndex++;
                entityManager.clear();
            } while (page.hasNext());
            printer.flush();
        }
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }

    private static String timestamp(Instant value) {
        return value == null ? "" : DATE_TIME.format(value);
    }
}
