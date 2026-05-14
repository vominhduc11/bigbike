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
        {/* Row 1: intro text + richtext + brand logos */}
        <div className="grid grid-cols-1 gap-6 py-10 items-start lg:grid-cols-[4fr_5fr_3fr] lg:gap-[30px]">
          <div>
            <h3 className="font-display text-[1.71rem] font-semibold uppercase text-foreground mb-4">Bigbike</h3>
            <p className="text-muted-foreground text-base leading-snug m-0">Cửa hàng chuyên phân phối phụ kiện bảo hộ moto chính hãng uy tín tại TP HCM</p>
          </div>
          <article
            className="bb-richtext text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
          {brands.length > 0 && (
            <div className="grid grid-cols-2 gap-2" aria-label="Thương hiệu phân phối">
              {brands.slice(0, 8).map((brand) => {
                const logoSrc = resolveMediaUrl(brand.logo?.url?.trim());
                return (
                  <Link
                    key={brand.id}
                    href={toBrandPath(brand.slug)}
                    className="flex items-center justify-center p-4 bg-white border border-border aspect-[4/3] no-underline transition-colors duration-150 hover:border-brand"
                  >
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoSrc} alt={brand.name} loading="lazy" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="font-display font-semibold text-xs text-foreground text-center uppercase">{brand.name}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 2: quality section */}
        <div className="grid grid-cols-1 gap-[30px] py-[60px] items-start lg:grid-cols-[4fr_8fr]">
          <div>
            <h3 className="font-display text-[1.71rem] font-semibold uppercase text-foreground mb-4 leading-tight">Chất lượng dịch vụ tạo nên sự khác biệt</h3>
            <p className="text-muted-foreground text-[15px] leading-relaxed m-0">
              Bigbike đã đồng hành cùng các sự kiện sinh nhật, kỉ niệm và từ thiện của câu lạc bộ
              xe exciter và moto Việt Nam. Chúng tôi luôn lắng nghe khách hàng để không ngừng nâng
              cao chất lượng dịch vụ. Sự hài lòng của khách hàng là sự thành công của Bigbike.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {SERVICE_TILES.map((tile) => (
              <div
                key={tile.title}
                className={`p-6 ${tile.highlight ? "bg-brand" : "bg-[#f8f8f8]"}`}
              >
                <h4 className={`font-display text-base font-semibold uppercase mb-[10px] leading-tight ${tile.highlight ? "text-white" : "text-foreground"}`}>{tile.title}</h4>
                <p className={`text-sm leading-[1.55] m-0 ${tile.highlight ? "text-white" : "text-muted-foreground"}`}>{tile.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="py-10 text-center">
          <h3 className="font-display text-[1.71rem] font-semibold uppercase text-foreground mb-3">KẾT NỐI ĐỂ CHÚNG TÔI CÓ THỂ GẦN BẠN HƠN</h3>
          <p className="text-muted-foreground mb-2">
            Bigbike hiện đã nhận được hơn 80 lượt review 5 sao trên Google map và nhận được nhiều
            lời khen ngợi khác. Đây chính là những động lực to lớn để chúng tôi tiếp tục cố gắng
            trở thành người bạn đồng hành tốt nhất của cộng đồng biker Việt Nam.
          </p>
          <p className="text-muted-foreground mb-2">
            Hãy liên hệ với chúng tôi để được tư vấn thêm về các thông tin chi tiết sản phẩm và để
            nhận được giá ưu đãi tốt nhất.
          </p>
          <div className="grid grid-cols-1 gap-[14px] mt-8 text-left md:grid-cols-3 md:gap-6">
            <div className="px-5 py-[22px] bg-card border border-border">
              <span className="inline-flex items-center justify-center w-[54px] h-[54px] mb-3 bg-brand/[0.08] text-brand rounded-full" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M13 9h.01M9 13h.01M13 13h.01M9 17h6"/></svg>
              </span>
              <p className="text-muted-foreground text-sm mb-1 leading-snug"><b className="text-foreground font-bold">Cửa hàng chính</b></p>
              <p className="text-muted-foreground text-sm mb-0 leading-snug">{address}</p>
            </div>
            <div className="px-5 py-[22px] bg-card border border-border">
              <span className="inline-flex items-center justify-center w-[54px] h-[54px] mb-3 bg-brand/[0.08] text-brand rounded-full" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              <p className="text-muted-foreground text-sm mb-1 leading-snug"><b className="text-foreground font-bold">Hotline</b></p>
              <p className="text-muted-foreground text-sm mb-0 leading-snug">{hotline}</p>
              {zalo && <p className="text-muted-foreground text-sm mb-0 leading-snug">{zalo}</p>}
            </div>
            <div className="px-5 py-[22px] bg-card border border-border">
              <span className="inline-flex items-center justify-center w-[54px] h-[54px] mb-3 bg-brand/[0.08] text-brand rounded-full" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </span>
              <p className="text-muted-foreground text-sm mb-1 leading-snug"><b className="text-foreground font-bold">Facebook</b></p>
              <p className="text-muted-foreground text-sm mb-0 leading-snug">
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bb-link">
                  {facebookHandle || "facebook.com/bigbikegear"}
                </a>
              </p>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-xs text-right mb-10">Cập nhật {formatDate(page.updatedAt)}</p>
      </div>
    </section>
  );
}
