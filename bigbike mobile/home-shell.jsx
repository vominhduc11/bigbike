// home-shell.jsx — App shell, state, Tweaks, screen routing.
// LIGHT-FIRST WP-parity for the page surfaces (header/footer/drawers stay dark).

const { useState: useStateS, useEffect: useEffectS, useRef: useRefS, useMemo: useMemoS } = React;

// ─────────────────────────────────────────────────────────────
// Tweakable defaults
// ─────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroVariant": "slider",
  "categoryVariant": "grid",
  "showTabBar": true,
  "density": "comfortable",
  "screen": "home",
  "showMeta": true
}/*EDITMODE-END*/;

// Locked brand red per styleguide — no accent picker.
const ACCENT = "#ff0c09";

// ─────────────────────────────────────────────────────────────
// Inner mobile shell
// ─────────────────────────────────────────────────────────────
function MobileApp({ tweaks, setTweak }) {
  const t = bbTokens;
  const accent = ACCENT;

  // Overlays (drawers, search modal, cart bottom-sheet)
  const [menuOpen, setMenuOpen] = useStateS(false);
  const [searchOpen, setSearchOpen] = useStateS(false);
  const [cartOpen, setCartOpen] = useStateS(false);
  const [toast, setToast] = useStateS(null);

  // Bottom-tab active state
  const [tab, setTab] = useStateS("home");

  // Cart state
  const [cart, setCart] = useStateS([{ ...FEATURED[1], qty: 1 }]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // User (login state)
  const [user, setUser] = useStateS(null);

  // Screen stack — routes
  // null = home; one of: 'plp' | 'pdp' | 'cart' | 'checkout' | 'account' | 'orders' | 'wishlist' | 'login' | 'news' | 'article'
  const [screen, setScreen] = useStateS(null);
  const [pdpProduct, setPdpProduct]     = useStateS(null);
  const [plpCategory, setPlpCategory]   = useStateS(null);
  const [newsArticle, setNewsArticle]   = useStateS(null);

  const goHome = () => {
    setScreen(null);
    setPdpProduct(null); setPlpCategory(null); setNewsArticle(null);
    if (tweaks.screen !== "home") setTweak("screen", "home");
  };

  const openProduct  = (p) => { setMenuOpen(false); setSearchOpen(false); setCartOpen(false); setPdpProduct(p);  setScreen("pdp"); };
  const openCategory = (c) => { setMenuOpen(false); setSearchOpen(false); setCartOpen(false); setPlpCategory(c); setScreen("plp"); };
  const openCart     = ()  => { setScreen("cart"); };
  const openCheckout = ()  => { setScreen("checkout"); };
  const openAccount  = ()  => { setScreen("account"); };
  const openLogin    = ()  => { setScreen("login"); };
  const openNews     = ()  => { setScreen("news"); };
  const openArticle  = (a) => { setNewsArticle(a); setScreen("article"); };

  // Cart helpers
  const addToCart = (p) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === p.id);
      if (existing) return prev.map((x) => x.id === p.id ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, { ...p, qty: 1 }];
    });
    setToast(`Đã thêm "${p.name.slice(0, 28)}${p.name.length > 28 ? "…" : ""}" vào giỏ`);
  };
  const removeItem = (id) => setCart((prev) => prev.filter((x) => x.id !== id));
  const setQty = (id, delta) => setCart((prev) => prev
    .map((x) => x.id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x)
  );

  // Auto-dismiss toast
  useEffectS(() => {
    if (!toast) return;
    const i = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(i);
  }, [toast]);

  // Bottom-tab → action mapping
  useEffectS(() => {
    if (tab === "home")   { goHome(); }
    if (tab === "search") { setSearchOpen(true); setTab("home"); }
    if (tab === "cart")   { openCart();   setTab("home"); }
    if (tab === "cat")    { setMenuOpen(true);  setTab("home"); }
    if (tab === "user")   { if (user) openAccount(); else openLogin(); setTab("home"); }
  }, [tab]);

  // Tweak "screen" → force open for preview
  useEffectS(() => {
    const s = tweaks.screen;
    if (!s || s === "home") {
      if (screen !== null) goHome();
      return;
    }
    if (s === "pdp")      { setPdpProduct(FEATURED[0]); setScreen("pdp"); }
    else if (s === "plp") { setPlpCategory(CATEGORIES[0]); setScreen("plp"); }
    else if (s === "cart"){ setScreen("cart"); }
    else if (s === "checkout") { setScreen("checkout"); }
    else if (s === "account")  { setScreen("account"); }
    else if (s === "login")    { setScreen("login"); }
    else if (s === "news")     { setScreen("news"); }
    else if (s === "article")  { setNewsArticle(NEWS_LIST[0]); setScreen("article"); }
    else if (s === "wishlist") { setScreen("wishlist"); }
    else if (s === "orders")   { setScreen("orders"); }
  }, [tweaks.screen]);

  // sub-screen routing inside Account hub
  const onSubScreen = (key) => {
    if (key === "orders")    setScreen("orders");
    else if (key === "wishlist") setScreen("wishlist");
    else if (key === "logout") { setUser(null); goHome(); setToast("Đã đăng xuất"); }
    else setToast("Chức năng đang được phát triển");
  };

  // Compute home content area density
  const sectionGap = tweaks.density === "compact" ? 0 : 6;

  // Show bottom tab? Hide on most modal-ish screens
  const showTab = tweaks.showTabBar &&
    (screen === null);

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "#fff", color: t.text,
      fontFamily: t.fontBody, fontSize: 14,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* iOS status spacer */}
      <div style={{ height: 54, flexShrink: 0, background: t.dark }} />

      {/* HOME route — only mount when no other screen is active so PDP/PLP can fully cover */}
      {!screen && (
        <>
          <Header
            accent={accent}
            onMenu={() => setMenuOpen(true)}
            onSearch={() => setSearchOpen(true)}
            onCart={() => openCart()}
            cartCount={cartCount}
          />
          <div style={{
            flex: 1, overflowY: "auto", overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            background: "#fff",
          }}>
            <HeroSlider accent={accent} variant={tweaks.heroVariant} />
            <div style={{ height: sectionGap }} />
            <Categories accent={accent} variant={tweaks.categoryVariant} onOpen={openCategory} />
            <FeaturedProducts accent={accent} onAddToCart={addToCart} onOpen={openProduct} />
            <PromoBanner accent={accent} />
            <BestSellers accent={accent} onAddToCart={addToCart} onOpen={openProduct} />
            <TrustSignals accent={accent} />
            <BrandSpotlight accent={accent} />
            <BlogPreview accent={accent} onOpenNews={openNews} />
            <Footer accent={accent} />
          </div>
        </>
      )}

      {/* Bottom tab — sticky over home only */}
      {showTab && (
        <TabBar accent={accent} active={tab} onChange={setTab} cartCount={cartCount} />
      )}

      {/* OVERLAY drawers — work on top of any screen */}
      <MenuDrawer
        open={menuOpen} onClose={() => setMenuOpen(false)}
        accent={accent}
        onCategory={openCategory}
        onAccount={() => user ? openAccount() : openLogin()}
      />
      <SearchOverlay
        open={searchOpen} onClose={() => setSearchOpen(false)}
        accent={accent}
        onProduct={openProduct}
        onCategory={openCategory}
      />
      <CartSheet
        open={cartOpen} onClose={() => setCartOpen(false)}
        accent={accent}
        items={cart}
        onRemove={removeItem}
        onQty={setQty}
        onGoToCartPage={openCart}
      />
      <Toast message={toast} accent={accent} />

      {/* SCREENS */}
      {screen === "pdp" && pdpProduct && (
        <ProductDetail
          product={pdpProduct}
          onClose={goHome}
          onAddToCart={addToCart}
          accent={accent}
        />
      )}
      {screen === "plp" && plpCategory && (
        <ProductListing
          category={plpCategory}
          onClose={goHome}
          onAddToCart={addToCart}
          onOpenProduct={openProduct}
          accent={accent}
        />
      )}
      {screen === "cart" && (
        <CartPage
          items={cart}
          onRemove={removeItem}
          onQty={setQty}
          onClose={goHome}
          onContinue={goHome}
          onCheckout={openCheckout}
          accent={accent}
        />
      )}
      {screen === "checkout" && (
        <CheckoutPage
          items={cart}
          onClose={() => setScreen("cart")}
          onPlaceOrder={() => setCart([])}
          accent={accent}
        />
      )}
      {screen === "account" && (
        <AccountHub
          user={user}
          onClose={goHome}
          onSubScreen={onSubScreen}
          accent={accent}
          onLogin={(u) => { setUser(u); setToast("Đăng nhập thành công"); }}
        />
      )}
      {screen === "orders" && (
        <OrdersScreen
          onClose={user ? openAccount : goHome}
          accent={accent}
        />
      )}
      {screen === "wishlist" && (
        <WishlistScreen
          onClose={user ? openAccount : goHome}
          onOpenProduct={openProduct}
          onAddToCart={addToCart}
          accent={accent}
        />
      )}
      {screen === "login" && (
        <LoginScreen
          onClose={goHome}
          accent={accent}
          onLogin={(u) => { setUser(u); setScreen("account"); setToast("Đăng nhập thành công"); }}
        />
      )}
      {screen === "news" && (
        <NewsListScreen
          onClose={goHome}
          onOpenArticle={openArticle}
          accent={accent}
        />
      )}
      {screen === "article" && newsArticle && (
        <ArticleScreen
          article={newsArticle}
          onClose={() => setScreen("news")}
          accent={accent}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Outer App — Device frame + Tweaks panel
// ─────────────────────────────────────────────────────────────
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const DEVICE_W = 390;
  const DEVICE_H = 844;

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: "#e8e8ec",
      color: bbTokens.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
      backgroundImage: "radial-gradient(60% 50% at 50% 30%, rgba(255,12,9,0.04), transparent 65%), repeating-linear-gradient(0deg, transparent 0 39px, rgba(0,0,0,0.025) 39px 40px)",
    }}>
      {/* Meta side-card */}
      {tweaks.showMeta && (
        <div style={{
          position: "fixed", top: 24, left: 24, zIndex: 5,
          fontFamily: bbTokens.fontMono, fontSize: 11, color: bbTokens.textSec,
          letterSpacing: "0.06em", lineHeight: 1.6,
          pointerEvents: "none",
          maxWidth: 240,
        }}>
          <div style={{ color: bbTokens.text, fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
            BIGBIKE / MOBILE APP
          </div>
          <div>VN E-COMMERCE — PROTECTIVE GEAR</div>
          <div style={{ marginTop: 4 }}>390 × 844 · iPhone 14 · LIGHT-FIRST WP-PARITY</div>
          <div style={{ marginTop: 10, color: bbTokens.text, fontWeight: 600, fontSize: 10 }}>SCREENS</div>
          <div style={{ marginTop: 2, color: bbTokens.textSec, fontSize: 10 }}>
            Home · PLP · PDP · Cart · Checkout · Account · Orders · Wishlist · Login · News · Article
          </div>
          <div style={{ marginTop: 10, color: bbTokens.textSec, fontSize: 10 }}>
            Tap categories, products, cart, account icons.<br />
            Toggle <span style={{ color: bbTokens.brand, fontWeight: 700 }}>Tweaks</span> to switch screen.
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <IOSDevice width={DEVICE_W} height={DEVICE_H} dark={true}>
          <MobileApp tweaks={tweaks} setTweak={setTweak} />
        </IOSDevice>
      </div>

      <TweaksPanel title="TWEAKS">
        <TweakSection label="Screen">
          <TweakSelect
            label="View"
            value={tweaks.screen || "home"}
            options={[
              { value: "home",     label: "Home" },
              { value: "plp",      label: "Product Listing" },
              { value: "pdp",      label: "Product Detail" },
              { value: "cart",     label: "Cart" },
              { value: "checkout", label: "Checkout" },
              { value: "account",  label: "Account" },
              { value: "orders",   label: "Orders" },
              { value: "wishlist", label: "Wishlist" },
              { value: "login",    label: "Login" },
              { value: "news",     label: "News" },
              { value: "article",  label: "Article" },
            ]}
            onChange={(v) => setTweak("screen", v)}
          />
        </TweakSection>

        <TweakSection label="Home / Hero">
          <TweakRadio
            label="Variant"
            value={tweaks.heroVariant}
            options={["slider", "bold", "split"]}
            onChange={(v) => setTweak("heroVariant", v)}
          />
        </TweakSection>

        <TweakSection label="Home / Categories">
          <TweakRadio
            label="Layout"
            value={tweaks.categoryVariant}
            options={["grid", "scroll", "stack"]}
            onChange={(v) => setTweak("categoryVariant", v)}
          />
        </TweakSection>

        <TweakSection label="Chrome">
          <TweakToggle
            label="Bottom tab bar"
            value={tweaks.showTabBar}
            onChange={(v) => setTweak("showTabBar", v)}
          />
          <TweakToggle
            label="Show meta info"
            value={tweaks.showMeta}
            onChange={(v) => setTweak("showMeta", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
