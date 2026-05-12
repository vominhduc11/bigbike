import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toHomePath, toPagePath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Giới thiệu",
  description: "Giới thiệu BigBike — hệ thống đồ bảo hộ biker, gear touring chính hãng.",
  canonicalPath: toPagePath("gioi-thieu"),
});

// 1:1 nội dung với WP page-about.php (a-1.png … a-5.png)
const SERVICE_TILES = [
  {
    title: "Các chương trình khuyến mãi hấp dẫn",
    body: "Ngoài ra, những thông tin, tin tức mới nhất về các sản phẩm moto cũng như các sự kiện nổi bật cũng luôn được chúng tôi cập nhật thường xuyên trên website chính thức của Bigbike. Ngoài ra, các biker có thể tham khảo thêm một số bài viết so sánh và đánh giá về các trang thiết bị bảo hộ phượt tại đây.",
    highlight: true,
  },
  {
    title: "Cập nhật xu hướng liên tục",
    body: "Những xu hướng và mẫu mã sản phẩm thịnh hành nhất trên thị trường hiện nay luôn được Bigbike cập nhật liên tục nhằm đáp ứng kịp thời thị hiếu và nhu cầu từ cơ bản đến nâng cao của khách hàng. Và chúng tôi thường xuyên có những chương trình ưu đãi và hậu mãi hấp dẫn để đem đến cho các biker nhiều cơ hội trải nghiệm sản phẩm cũng như tri ân khách hàng thân thiết.",
    highlight: false,
  },
  {
    title: "Chất lượng dịch vụ tạo nên sự khác biệt",
    body: "Khi đến với Bigbike, khách hàng sẽ được tư vấn kỹ lượng về mọi thông tin chi tiết sản phẩm cũng như được giải đáp các thắc mắc một cách tận tình và chu đáo. Đội ngũ nhân viên Bigbike được đào tạo chuyên nghiệp và có sự am hiểu thông tin của sản phẩm sẽ luôn sẵn sàng tư vấn và hỗ trợ khách hàng khi cần thiết. Bạn có thể trực tiếp kiểm tra chất lượng sản phẩm và lựa chọn cho mình các vật dụng bảo hộ phù hợp nhất.",
    highlight: false,
  },
  {
    title: "Dịch vụ hậu cần tối ưu",
    body: "Các dịch vụ hậu cần cũng luôn được thực hiện nhanh chóng. Các hoạt động giao nhận hàng hóa, các chính sách bảo hành và đổi trả sản phẩm luôn được áp dụng tiện lợi nhất cho khách hàng. Các quy trình luôn được chú trọng và được thực hiện cẩn thận, từ khâu đóng gói hàng hóa cho đến khâu vận chuyển. Nhằm đảm bảo hàng hóa được giao đến tay khách hàng với trạng thái tốt nhất.",
    highlight: false,
  },
  {
    title: "Các thông tin nổi bật luôn được cập nhật nhanh chóng",
    body: "Chúng tôi cung cấp đầy đủ những gì bạn cần cho một cuộc hành trình. Bigbike tự hào luôn nhận được sự tin tưởng cũng như những đánh giá tích cực từ khách hàng và là đơn vị uy tín và xứng đáng để bạn trao gửi niềm tin.",
    highlight: true,
  },
];

function pickSetting(
  settings: Array<{ settingKey: string; settingValue: string }>,
  patterns: RegExp[],
): string {
  const match = settings.find((s) => patterns.some((p) => p.test(s.settingKey)));
  return match?.settingValue?.trim() ?? "";
}

export default async function AboutPage() {
  const [pageResult, brandsResult, settingsResult] = await Promise.all([
    getPageBySlug("gioi-thieu"),
    listBrands({ page: 1, size: 8, sort: "name:asc" }),
    listPublicSettings(),
  ]);
  if (!pageResult.data && pageResult.error?.status === 404) {
    notFound();
  }
  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? "Không tải được nội dung giới thiệu."} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const pageTitle = safeText(page.title, "Giới thiệu");
  const brands = brandsResult.data ?? [];
  const settings = settingsResult.data ?? [];
  const address = pickSetting(settings, [/address/i, /diachi/i, /dia_chi/i]) || "79/30/52 Âu Cơ, P.4, Q.11, Tp.HCM";
  const hotline = pickSetting(settings, [/hotline/i, /phone/i, /tel/i]) || "028.62797251";
  const zalo = pickSetting(settings, [/zalo/i]);
  const facebookUrl = pickSetting(settings, [/facebook/i]) || "https://www.facebook.com/bigbikegear";
  const facebookHandle = facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <section className="bb-page">
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        kicker={page.heroKicker ?? "GIỚI THIỆU"}
        title={page.heroTitle ?? pageTitle}
        description={page.heroDescription}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: pageTitle },
        ]}
      />
      <div className="bb-container">
        <div className="wp-about-row-1">
          <div className="wp-about-head">
            <h3>Bigbike</h3>
            <p>Cửa hàng chuyên phân phối phụ kiện bảo hộ moto chính hãng uy tín tại TP HCM</p>
          </div>
          <article
            className="wp-about-text bb-richtext"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
          {brands.length > 0 && (
            <div className="wp-about-brands" aria-label="Thương hiệu phân phối">
              {brands.slice(0, 8).map((brand) => {
                const logoSrc = resolveMediaUrl(brand.logo?.url?.trim());
                return (
                  <Link key={brand.id} href={toBrandPath(brand.slug)} className="wp-about-brand-cell">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoSrc} alt={brand.name} loading="lazy" />
                    ) : (
                      <span className="wp-about-brand-fallback">{brand.name}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="wp-about-row-2">
          <div className="wp-about-quality-head">
            <h3>Chất lượng dịch vụ tạo nên sự khác biệt</h3>
            <p>
              Bigbike đã đồng hành cùng các sự kiện sinh nhật, kỉ niệm và từ thiện của câu lạc bộ
              xe exciter và moto Việt Nam. Chúng tôi luôn lắng nghe khách hàng để không ngừng nâng
              cao chất lượng dịch vụ. Sự hài lòng của khách hàng là sự thành công của Bigbike.
            </p>
          </div>
          <div className="wp-about-quality-grid">
            {SERVICE_TILES.map((tile) => (
              <div
                key={tile.title}
                className={`wp-about-quality-tile${tile.highlight ? " wp-about-quality-tile--red" : ""}`}
              >
                <h4>{tile.title}</h4>
                <p>{tile.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="wp-about-contact">
          <h3>KẾT NỐI ĐỂ CHÚNG TÔI CÓ THỂ GẦN BẠN HƠN</h3>
          <p>
            Bigbike hiện đã nhận được hơn 80 lượt review 5 sao trên Google map và nhận được nhiều
            lời khen ngợi khác. Đây chính là những động lực to lớn để chúng tôi tiếp tục cố gắng
            trở thành người bạn đồng hành tốt nhất của cộng đồng biker Việt Nam.
          </p>
          <p>
            Hãy liên hệ với chúng tôi để được tư vấn thêm về các thông tin chi tiết sản phẩm và để
            nhận được giá ưu đãi tốt nhất.
          </p>
          <div className="wp-about-contact-grid">
            <div className="wp-about-contact-item">
              <span className="wp-about-contact-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M13 9h.01M9 13h.01M13 13h.01M9 17h6"/></svg>
              </span>
              <p><b>Cửa hàng chính</b></p>
              <p>{address}</p>
            </div>
            <div className="wp-about-contact-item">
              <span className="wp-about-contact-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              <p><b>Hotline</b></p>
              <p>{hotline}</p>
              {zalo && <p>{zalo}</p>}
            </div>
            <div className="wp-about-contact-item">
              <span className="wp-about-contact-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </span>
              <p><b>Facebook</b></p>
              <p>
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bb-link">
                  {facebookHandle || "facebook.com/bigbikegear"}
                </a>
              </p>
            </div>
          </div>
        </div>

        <p className="wp-about-updated">Cập nhật {formatDate(page.updatedAt)}</p>
      </div>
    </section>
  );
}
