---
name: backend-endpoint
description: Dùng khi thêm endpoint/resource mới vào bigbike-backend (Spring Boot). Scaffold vertical slice theo đúng convention dự án — controller bọc response qua ApiResponseFactory (ApiDataResponse/ApiListResponse), request DTO @Valid (Lombok + Bean Validation), response DTO record, MapStruct mapper, JpaRepository, entity Lombok, permission DB-driven qua requirePermission (KHÔNG @PreAuthorize), và Flyway V-migration. Gọi bằng /backend-endpoint <resource>.
---

# /backend-endpoint — Scaffold vertical slice cho bigbike-backend

## Bước 0 — Docs-First (bắt buộc cho backend logic)

Chạy `/docs-first <mô tả>`: đọc `API_CONTRACT.md` (endpoint shape), `DATA_CONTRACT.md` (entity/field), `PERMISSION_MATRIX.md` (permission key), `STATE_MACHINES.md` (nếu có transition), `BUSINESS_RULES.md` (rule liên quan). Đổi shape/rule → update docs trước.

## Bước 1 — Package layout (base `com.bigbike.bigbike_backend`)

```
api/<domain>/XxxController.java          + api/<domain>/dto/{XxxRequest,XxxResponse}.java
service/<domain>/XxxService.java
repository/<domain>/XxxRepository.java            (domain interface)
persistence/repository/<domain>/XxxJpaRepository  (extends JpaRepository)
persistence/entity/<domain>/XxxEntity.java
mapper/XxxMapper.java
```

Exemplar đọc: `api/catalog/CatalogController.java`, `mapper/CustomerMapper.java`, `api/common/ApiResponseFactory.java`.

## Bước 2 — Controller: bọc response qua ApiResponseFactory

```java
@Validated
@RestController
@RequestMapping("/api/v1/admin/xxx")
@RequiredArgsConstructor
public class XxxController {
    private final XxxService xxxService;
    private final ApiResponseFactory apiResponseFactory;
    private final DevAdminAuthService devAdminAuthService;   // chỉ admin endpoint

    @GetMapping
    public ApiListResponse<XxxResponse> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "xxx.read");
        return apiResponseFactory.list(xxxService.list(page, size), request);
    }

    @PostMapping
    public ApiDataResponse<XxxResponse> create(@Valid @RequestBody XxxRequest body, HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "xxx.create");
        return apiResponseFactory.data(xxxService.create(body), request);
    }
}
```

- Bọc qua `apiResponseFactory.data(x, request)` / `.list(pageResult, request)` → record `ApiDataResponse<T>(data, meta)` / `ApiListResponse<T>(data, pagination, meta)`. **KHÔNG tự chế "ApiResponse" chung.**
- `@Valid @RequestBody` trên body; `@Min/@Max/@Pattern` trên param; luôn nhận `HttpServletRequest request` cho meta/requestId.

## Bước 3 — Permission: DB-driven, KHÔNG @PreAuthorize

- Coarse route matcher trong `config/SecurityConfig.java` (public vs authenticated vs admin).
- Fine-grained admin permission: `devAdminAuthService.requirePermission(request, "xxx.read")` ở đầu endpoint. Permission key lấy từ DB và phải khớp `PERMISSION_MATRIX.md`. 401 = chưa auth, 403 = auth nhưng không đủ quyền.

## Bước 4 — Service / Repository

```java
@Service @Transactional(readOnly = true) @RequiredArgsConstructor
public class XxxService {
    private final XxxRepository xxxRepository;
    // ghi: method riêng để @Transactional (không readOnly)
}
```

JPA: `interface XxxJpaRepository extends JpaRepository<XxxEntity, String>` trong `persistence/repository/`; custom query dùng `@Query` + `@Param`.

## Bước 5 — Entity / DTO / Mapper (Lombok + MapStruct + Bean Validation)

```java
// Entity — Lombok, KHÔNG @Data (tránh vòng lazy-load)
@Entity @Table(name = "xxx") @Getter @Setter @NoArgsConstructor
public class XxxEntity { @Id private String id; @Column(nullable = false) private String name; }

// Request DTO — class + validation tại boundary
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class XxxRequest {
    @NotBlank @Size(max = 255) private String name;
    @Valid private ImageAssetRequest image;        // cascade nested
}

// Response DTO — Java record (ưu tiên)
public record XxxResponse(String id, String name) {}

// Mapper — interface trong mapper/
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface XxxMapper {
    @Mapping(target = "name", source = "entity.displayName")
    XxxResponse toResponse(XxxEntity entity);
}
```

Validation chỉ ở boundary (`@Valid`); **không** validate lại thủ công trong service. Lỗi validation tự được `api/error/GlobalExceptionHandler` (`@RestControllerAdvice`) format thành `ApiErrorResponse { error{code:"VALIDATION_ERROR", message, details[]}, meta }`.

## Bước 6 — State transition (nếu có)

Transition có side effect → command endpoint (`POST .../{id}/cancel`, `.../status`, `.../publish`) và **backend phải validate transition theo state machine** — không tin UI. Đọc `STATE_MACHINES.md`.

## Bước 7 — Flyway migration (nếu đổi schema)

```bash
# Tìm số version cao nhất hiện tại
ls bigbike-backend/src/main/resources/db/migration | grep -oE '^V[0-9]+' | sed 's/V//' | sort -n | tail -1
```

Tạo file kế tiếp `V<n+1>__<mo_ta>.sql` (hiện cao nhất là **V149** → kế tiếp **V150**, nhưng luôn re-check bằng lệnh trên). PostgreSQL dialect, idempotent (`IF EXISTS`/`IF NOT EXISTS`), comment mô tả intent.

## Bước 8 — Đóng gate

Chạy `/preflight` (backend = `./mvnw test`; `./mvnw package` trước release). Verify response khớp `API_CONTRACT.md`.
