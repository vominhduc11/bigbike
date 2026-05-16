package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Covers FULL-12 batch 1: customer wishlist API — auth gates, CRUD, idempotency, isolation.
 */
@SpringBootTest
class CustomerWishlistApiTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── 1. Unauthenticated access ─────────────────────────────────────────────

    @Test
    void getWishlist_withoutSession_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/customer/wishlist"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void addToWishlist_guestSession_returns401() throws Exception {
        // A guest session has a valid CSRF token but no CustomerPrincipal.
        // CSRF check passes; requireCustomerId() throws UnauthorizedException → 401.
        GuestSession guest = newGuestSession();
        mockMvc.perform(post("/api/v1/customer/wishlist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"any-product\"}")
                        .cookie(guest.cookies).header("X-CSRF-Token", guest.csrf))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. Add item ───────────────────────────────────────────────────────────

    @Test
    void addToWishlist_authenticated_returns201AndAddedTrue() throws Exception {
        AuthSession session = loginCustomer("wish-add-" + UUID.randomUUID() + "@bigbike.vn");
        String productId = "product-" + UUID.randomUUID();

        mockMvc.perform(post("/api/v1/customer/wishlist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.productId").value(productId))
                .andExpect(jsonPath("$.data.added").value(true));
    }

    // ── 3. List includes added item ───────────────────────────────────────────

    @Test
    void getWishlist_afterAdd_containsProductId() throws Exception {
        AuthSession session = loginCustomer("wish-list-" + UUID.randomUUID() + "@bigbike.vn");
        String productId = "product-" + UUID.randomUUID();
        addToWishlist(session, productId);

        MvcResult result = mockMvc.perform(get("/api/v1/customer/wishlist").cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).contains(productId);
    }

    // ── 4. Duplicate add is idempotent ────────────────────────────────────────

    @Test
    void addToWishlist_duplicate_isIdempotent_returnsAddedFalse() throws Exception {
        AuthSession session = loginCustomer("wish-dup-" + UUID.randomUUID() + "@bigbike.vn");
        String productId = "product-" + UUID.randomUUID();
        addToWishlist(session, productId);

        // Second add of same productId must return added=false (no duplicate row).
        mockMvc.perform(post("/api/v1/customer/wishlist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.added").value(false));
    }

    // ── 5. Remove item ────────────────────────────────────────────────────────

    @Test
    void removeFromWishlist_authenticated_returns204AndItemGone() throws Exception {
        AuthSession session = loginCustomer("wish-rm-" + UUID.randomUUID() + "@bigbike.vn");
        String productId = "product-" + UUID.randomUUID();
        addToWishlist(session, productId);

        mockMvc.perform(delete("/api/v1/customer/wishlist/" + productId)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/api/v1/customer/wishlist").cookie(session.cookies))
                .andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain(productId);
    }

    // ── 6. Isolation — each customer sees only their own items ────────────────

    @Test
    void getWishlist_isolation_customerACannotSeeCustomerBItems() throws Exception {
        AuthSession sessionA = loginCustomer("wish-iso-a-" + UUID.randomUUID() + "@bigbike.vn");
        AuthSession sessionB = loginCustomer("wish-iso-b-" + UUID.randomUUID() + "@bigbike.vn");
        String productA = "product-a-" + UUID.randomUUID();
        String productB = "product-b-" + UUID.randomUUID();
        addToWishlist(sessionA, productA);
        addToWishlist(sessionB, productB);

        String bodyA = mockMvc.perform(get("/api/v1/customer/wishlist").cookie(sessionA.cookies))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(bodyA).contains(productA).doesNotContain(productB);

        String bodyB = mockMvc.perform(get("/api/v1/customer/wishlist").cookie(sessionB.cookies))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(bodyB).contains(productB).doesNotContain(productA);
    }

    // ── 7. Delete is scoped to caller's customerId ────────────────────────────

    @Test
    void removeFromWishlist_sameProductId_onlyRemovesCallerEntry() throws Exception {
        String sharedProductId = "product-shared-" + UUID.randomUUID();
        AuthSession sessionA = loginCustomer("wish-del-a-" + UUID.randomUUID() + "@bigbike.vn");
        AuthSession sessionB = loginCustomer("wish-del-b-" + UUID.randomUUID() + "@bigbike.vn");
        addToWishlist(sessionA, sharedProductId);
        addToWishlist(sessionB, sharedProductId);

        // A removes the item — deleteByCustomerIdAndProductId scopes by A's customerId.
        mockMvc.perform(delete("/api/v1/customer/wishlist/" + sharedProductId)
                        .cookie(sessionA.cookies).header("X-CSRF-Token", sessionA.csrf))
                .andExpect(status().isNoContent());

        // B's entry must survive A's delete.
        String bodyB = mockMvc.perform(get("/api/v1/customer/wishlist").cookie(sessionB.cookies))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(bodyB).contains(sharedProductId);
    }

    // ── FULL-07: wishlist products endpoint ──────────────────────────────────

    @Test
    void getWishlistProducts_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/customer/wishlist/products"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getWishlistProducts_returnsWishlistedPublishedProducts() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("wl-cat-" + suffix, "WL Cat " + suffix);
        String productId = "wl-prod-" + suffix;
        seedProduct(productId, "wl-prod-slug-" + suffix, "WL Product " + suffix, cat, PublishStatus.PUBLISHED);

        AuthSession session = loginCustomer("wl-prod-" + UUID.randomUUID() + "@bigbike.vn");
        addToWishlist(session, productId);

        mockMvc.perform(get("/api/v1/customer/wishlist/products").cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.id == '" + productId + "')]").exists())
                .andExpect(jsonPath("$.pagination.totalItems").value(1));
    }

    @Test
    void getWishlistProducts_excludesDraftProducts() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("wl-dft-cat-" + suffix, "WL Dft Cat " + suffix);
        String publishedId = "wl-pub-" + suffix;
        String draftId     = "wl-dft-" + suffix;
        seedProduct(publishedId, "wl-pub-slug-" + suffix, "WL Published " + suffix, cat, PublishStatus.PUBLISHED);
        seedProduct(draftId,     "wl-dft-slug-" + suffix, "WL Draft " + suffix,     cat, PublishStatus.DRAFT);

        AuthSession session = loginCustomer("wl-dft-" + UUID.randomUUID() + "@bigbike.vn");
        addToWishlist(session, publishedId);
        addToWishlist(session, draftId);

        mockMvc.perform(get("/api/v1/customer/wishlist/products").cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(publishedId));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AuthSession loginCustomer(String email) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk());
        MvcResult loginResult = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie[] cookies = loginResult.getResponse().getCookies();
        String csrf = findCookieValue(loginResult.getResponse(), "bb_csrf");
        return new AuthSession(cookies, csrf);
    }

    private void addToWishlist(AuthSession session, String productId) throws Exception {
        mockMvc.perform(post("/api/v1/customer/wishlist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());
    }

    private GuestSession newGuestSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = result.getResponse().getCookies();
        String csrf = findCookieValue(result.getResponse(), "bb_csrf");
        return new GuestSession(cookies, csrf);
    }

    private String findCookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private CategoryEntity seedCategory(String slug, String name) {
        return categoryRepo.findBySlug(slug).orElseGet(() -> {
            CategoryEntity cat = new CategoryEntity();
            cat.setId("wl-cat-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            cat.setSlug(slug);
            cat.setName(name);
            cat.setVisible(true);
            Instant now = Instant.now();
            cat.setCreatedAt(now);
            cat.setUpdatedAt(now);
            return categoryRepo.save(cat);
        });
    }

    private void seedProduct(String id, String slug, String name, CategoryEntity cat, PublishStatus status) {
        if (productRepo.findById(id).isPresent()) return;
        ProductEntity p = new ProductEntity();
        p.setId(id);
        p.setSlug(slug);
        p.setName(name);
        p.setRetailPrice(BigDecimal.valueOf(1_000_000L));
        p.setCurrency("VND");
        p.setPublishStatus(status);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCategory(cat);
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        productRepo.save(p);
    }

    private record AuthSession(Cookie[] cookies, String csrf) {}
    private record GuestSession(Cookie[] cookies, String csrf) {}
}
