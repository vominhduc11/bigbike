/* Bigbike UI Kit — Homepage */
const { useState: useStateHome, useEffect: useEffectHome } = React;

function HeroSlider() {
  const slides = window.BB_HERO_SLIDES;
  const [i, setI] = useStateHome(0);
  useEffectHome(() => {
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, []);
  const s = slides[i];
  return (
    <div className="wp-hero-slider">
      <div className="wp-hero-slide">
        <div className="wp-hero-slide-content">
          <span className="wp-hero-kicker">{s.kicker}</span>
          <h1 className="wp-hero-title">{s.title.split("\n").map((l, k) => <React.Fragment key={k}>{k > 0 && <br />}{k === 1 ? <em>{l}</em> : l}</React.Fragment>)}</h1>
          <p className="wp-hero-sub">{s.sub}</p>
          <button className="wp-hero-cta">{s.cta} <span style={{ fontSize: 16 }}>→</span></button>
        </div>
        <div className="wp-hero-mascot">
          <img src={s.mascot} alt="" />
        </div>
        <div className="wp-hero-dots">
          {slides.map((_, k) => (
            <button
              key={k}
              className={`wp-hero-dot ${k === i ? "active" : ""}`}
              onClick={() => setI(k)}
              aria-label={`Slide ${k + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureRow() {
  const feats = [
    { icon: "../../assets/icons/bigbike-icon-17.svg", title: "100% Chính Hãng", sub: "Bảo hành theo hãng" },
    { icon: "../../assets/icons/bigbike-icon-19.svg", title: "Giao Hàng Toàn Quốc", sub: "Miễn phí từ 2 triệu" },
    { icon: "../../assets/icons/bigbike-icon-21.svg", title: "Tư Vấn Trực Tiếp", sub: "Hotline 0903 123 456" },
  ];
  return (
    <div className="wp-feature-row">
      {feats.map((f) => (
        <div className="wp-feature-tile" key={f.title}>
          <div className="wp-feat-icon"><img src={f.icon} alt="" /></div>
          <div className="wp-feat-text"><b>{f.title}</b><span>{f.sub}</span></div>
        </div>
      ))}
    </div>
  );
}

function CategoryGrid({ onCategory }) {
  return (
    <section className="wp-section">
      <div className="wp-section-head">
        <div>
          <span className="wp-kicker">Danh mục</span>
          <h2 className="wp-section-title">Gear theo từng nhu cầu</h2>
        </div>
        <a className="wp-section-link" onClick={() => onCategory && onCategory()}>Xem tất cả →</a>
      </div>
      <div className="wp-category-grid">
        {window.BB_CATEGORIES.map((c) => (
          <div className="wp-category-card" key={c.id} onClick={() => onCategory && onCategory(c)}>
            <img src={c.icon} alt={c.name} />
            <span className="wp-category-name">{c.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedProducts({ onAdd, onViewAll }) {
  return (
    <section className="wp-section">
      <div className="wp-section-head">
        <div>
          <span className="wp-kicker">Sản phẩm nổi bật</span>
          <h2 className="wp-section-title">Sản phẩm nổi bật tại BigBike</h2>
        </div>
        <a className="wp-section-link" onClick={() => onViewAll && onViewAll()}>Xem tất cả →</a>
      </div>
      <div className="wp-product-grid">
        {window.BB_PRODUCTS.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

function PromoBanner() {
  return (
    <section className="wp-section">
      <div className="wp-promo-banner">
        <div className="wp-promo-banner-text">
          <b>LS2 MX436 Pioneer</b>
          <p>Mũ bảo hiểm dual sport bán chạy nhất BigBike — ưu đãi 20% đến hết tháng 04.2026. Còn đủ size M / L / XL tại kho TP.HCM.</p>
          <button className="wp-promo-banner-cta">Đặt mua ngay</button>
        </div>
        <div className="wp-promo-banner-price">
          <b>-20%</b>
          <span>2.590.000 ₫ · chỉ còn 5 ngày</span>
        </div>
      </div>
    </section>
  );
}

function AboutBlock() {
  return (
    <section className="wp-about">
      <div className="wp-about-inner">
        <div className="wp-about-mark">
          <img src="../../assets/logo/bigbike-logo-primary.png" alt="BigBike mascot" />
        </div>
        <div className="wp-about-text">
          <div className="kicker">Về Bigbike · Est. 2013</div>
          <h2>Đồ bảo hộ biker —<br /> đồng hành cùng rider.</h2>
          <p>Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP HCM — phân phối chính hãng các thương hiệu LS2, Alpinestars, Scoyco, Sena, Furygan, Helite cùng nhiều thương hiệu quốc tế khác.</p>
          <p>Với tinh thần <b style={{ color: "#fff" }}>tư vấn kỹ</b> và <b style={{ color: "#fff" }}>đáng tin</b>, team Bigbike lắng nghe từng rider để giúp anh em chọn đúng gear cho mỗi hành trình — từ phố xá hằng ngày đến phượt dài Đà Lạt, Hà Giang, xuyên Việt.</p>
          <div className="wp-about-stats">
            <div className="wp-about-stat"><b>13+</b><span>Năm đồng hành</span></div>
            <div className="wp-about-stat"><b>20K+</b><span>Khách hàng</span></div>
            <div className="wp-about-stat"><b>50+</b><span>Thương hiệu</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LatestArticles() {
  return (
    <section className="wp-section">
      <div className="wp-section-head">
        <div>
          <span className="wp-kicker">Tin tức &amp; hướng dẫn</span>
          <h2 className="wp-section-title">Kiến thức cho rider</h2>
        </div>
        <a className="wp-section-link">Xem tất cả →</a>
      </div>
      <div className="wp-article-grid">
        {window.BB_ARTICLES.map((a) => (
          <article className="wp-article-card" key={a.id}>
            <div className="wp-article-image"><img src={a.img} alt="" /></div>
            <div className="wp-article-body">
              <div className="wp-article-meta">{a.meta}</div>
              <h3 className="wp-article-title">{a.title}</h3>
              <p className="wp-article-excerpt">{a.excerpt}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BrandStrip() {
  return (
    <section className="wp-section">
      <div className="wp-section-head">
        <div>
          <span className="wp-kicker">Thương hiệu</span>
          <h2 className="wp-section-title">Đối tác chính hãng</h2>
        </div>
        <a className="wp-section-link">Tất cả hãng →</a>
      </div>
      <div className="wp-brand-strip">
        {window.BB_BRANDS.slice(0, 6).map((b) => (
          <div className="wp-brand-chip" key={b}>{b}</div>
        ))}
      </div>
    </section>
  );
}

function HomePage({ onAdd, onCategory, onViewAll }) {
  return (
    <>
      <HeroSlider />
      <FeatureRow />
      <FeaturedProducts onAdd={onAdd} onViewAll={onViewAll} />
      <CategoryGrid onCategory={onCategory} />
      <PromoBanner />
      <AboutBlock />
      <LatestArticles />
      <BrandStrip />
    </>
  );
}

Object.assign(window, { HomePage });
