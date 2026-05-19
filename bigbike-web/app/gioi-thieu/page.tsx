import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AudioLines, BadgeCheck, BarChart3, Crown, Share2, Gem, Phone, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ContactInfoList } from "@/components/ui/ContactInfoList";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toPagePath } from "@/lib/utils/routes";
import { pickSettingByPattern } from "@/lib/utils/settings";

export const metadata: Metadata = buildPublicMetadata({
  title: "Giới thiệu",
  description: "Giới thiệu BigBike — hệ thống đồ bảo hộ biker, gear touring chính hãng.",
  canonicalPath: toPagePath("gioi-thieu"),
});

type ServiceTile = {
  title: string;
  body: string;
  highlight: boolean;
  icon: LucideIcon;
};

// Năm giá trị cốt lõi — nội dung 1:1 với bản thiết kế trang Giới thiệu.
// Màu xen kẽ trắng – đỏ – trắng – đỏ – trắng.
const SERVICE_TILES: ServiceTile[] = [
  {
    title: "Chế độ bảo hành và đổi trả",
    body: "Sản phẩm được bảo hành theo chính sách hãng và hỗ trợ đổi trả trong 7 ngày nếu có lỗi từ nhà sản xuất. Quy trình nhanh chóng, minh bạch, đảm bảo quyền lợi tối đa cho khách hàng.",
    highlight: false,
    icon: BadgeCheck,
  },
  {
    title: "Sản phẩm chính hãng cao cấp",
    body: "Bigbike cam kết 100% sản phẩm chính hãng từ các thương hiệu hàng đầu thế giới. Chúng tôi nói không với hàng giả, hàng nhái, hàng kém chất lượng, mang đến cho bạn sự an tâm tuyệt đối khi lựa chọn sản phẩm tại Bigbike.",
    highlight: true,
    icon: Gem,
  },
  {
    title: "Dịch vụ tư vấn tận tâm",
    body: "Đội ngũ tư vấn viên là những biker giàu kinh nghiệm, luôn sẵn sàng lắng nghe và tư vấn sản phẩm phù hợp với nhu cầu của bạn. Chúng tôi không chỉ bán sản phẩm, mà còn chia sẻ đam mê và đồng hành cùng bạn trên mọi cung đường.",
    highlight: false,
    icon: Crown,
  },
  {
    title: "Kiểm tra kỹ lưỡng & giao hàng nhanh",
    body: "Mỗi sản phẩm đều được kiểm tra kỹ càng trước khi giao đến tay khách hàng. Bigbike hỗ trợ giao hàng toàn quốc nhanh chóng, đóng gói cẩn thận, đảm bảo sản phẩm đến tay bạn nguyên vẹn và đúng hẹn.",
    highlight: true,
    icon: AudioLines,
  },
  {
    title: "Giá cả hợp lý & nhiều ưu đãi",
    body: "Bigbike luôn mang đến mức giá cạnh tranh nhất cùng nhiều chương trình ưu đãi hấp dẫn. Chúng tôi tin rằng chất lượng tốt không nhất thiết phải đi kèm với giá cao.",
    highlight: false,
    icon: BarChart3,
  },
];

function ServiceTileCard({ tile }: { tile: ServiceTile }) {
  const Icon = tile.icon;
  return (
    <div
      className={`flex gap-4 p-5 ${
        tile.highlight ? "bg-brand" : "bg-card border border-border shadow-sm"
      }`}
    >
      <Icon
        className={`w-9 h-9 shrink-0 ${tile.highlight ? "text-white" : "text-brand"}`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <h4
          className={`font-display text-base font-semibold uppercase mb-1.5 leading-tight ${
            tile.highlight ? "text-white" : "text-foreground"
          }`}
        >
          {tile.title}
        </h4>
        <p
          className={`text-sm leading-[1.55] m-0 ${
            tile.highlight ? "text-white/90" : "text-muted-foreground"
          }`}
        >
          {tile.body}
        </p>
      </div>
    </div>
  );
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
  const brands = brandsResult.data ?? [];
  const settings = settingsResult.data ?? [];
  const address = pickSettingByPattern(settings, [/address/i, /diachi/i, /dia_chi/i]) || "79/30/52 Âu Cơ, P.4, Q.11, Tp.HCM";
  const facebookUrl = pickSettingByPattern(settings, [/facebook/i]) || "https://www.facebook.com/bigbikegear";
  const facebookHandle = facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <>
      {/* Hero render ngoài .bb-page để nằm sát header và không bị rule `.bb-page h1` ghi đè. */}
      <PageHero
        variant="welcome"
        title="Chào mừng đến với BigBike"
        watermark="BigBike"
        illustration={{ src: page.heroImageUrl, alt: page.heroImageAlt }}
      />
      <section className="bb-page">
      <div className="bb-container">
        {/* Row 1: intro text + richtext + brand logos */}
        <div className="grid grid-cols-1 gap-6 pb-10 items-start lg:grid-cols-[4fr_5fr_3fr] lg:gap-[30px]">
          <div>
            <h3 className="font-display text-26 font-semibold uppercase text-foreground mb-4">Bigbike</h3>
            <p className="text-muted-foreground text-base leading-snug m-0">Cửa hàng chuyên phân phối phụ kiện bảo hộ moto chính hãng uy tín tại TP HCM</p>
          </div>
          <article
            className="bb-richtext text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
          {brands.length > 0 && (
            <div
              className="grid grid-cols-2 gap-x-6 gap-y-8 items-center justify-items-center"
              aria-label="Thương hiệu phân phối"
            >
              {brands.slice(0, 8).map((brand) => {
                const logoSrc = resolveMediaUrl(brand.logo?.url?.trim());
                return (
                  <Link
                    key={brand.id}
                    href={toBrandPath(brand.slug)}
                    className="flex items-center justify-center no-underline transition-opacity duration-150 hover:opacity-70"
                  >
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoSrc} alt={brand.name} loading="lazy" className="max-h-12 w-auto object-contain" />
                    ) : (
                      <span className="font-display font-semibold text-sm text-foreground text-center uppercase">{brand.name}</span>
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
            <h3 className="font-display text-26 font-semibold uppercase text-foreground mb-4 leading-tight">Chất lượng dịch vụ tạo nên sự khác biệt</h3>
            <p className="text-muted-foreground text-base leading-relaxed m-0">
              Trong suốt quá trình hoạt động của mình, Bigbike đã được hân hạnh trở thành nhà tài
              trợ đồng hành cho các sự kiện sinh nhật, kỉ niệm và từ thiện cùng câu lạc bộ xe
              exciter và câu lạc bộ moto Việt Nam. Bigbike luôn lắng nghe và ghi nhận những ý kiến
              đóng góp của khách hàng. Để từ đó, chúng tôi không ngừng nỗ lực cải thiện và nâng cao
              chất lượng dịch vụ. Sự hài lòng của khách hàng chính là sự thành công của Bigbike.
            </p>
          </div>
          {/* Năm thẻ giá trị cốt lõi — xếp dọc 1 cột như thiết kế */}
          <div className="flex flex-col gap-5">
            {SERVICE_TILES.map((tile) => (
              <ServiceTileCard key={tile.title} tile={tile} />
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="py-10">
          <h3 className="font-display text-26 font-semibold uppercase text-foreground mb-3">KẾT NỐI ĐỂ CHÚNG TÔI CÓ THỂ GẦN BẠN HƠN</h3>
          <p className="text-muted-foreground mb-2">
            Bigbike hiện đã nhận được hơn 80 lượt review 5 sao trên Google map và nhận được nhiều
            lời khen ngợi khác. Đây chính là những động lực to lớn để chúng tôi tiếp tục cố gắng
            trở thành người bạn đồng hành tốt nhất của cộng đồng biker Việt Nam.
          </p>
          <p className="text-muted-foreground mb-2">
            Hãy liên hệ với chúng tôi để được tư vấn thêm về các thông tin chi tiết sản phẩm và để
            nhận được giá ưu đãi tốt nhất.
          </p>
          <ContactInfoList
            className="mt-8"
            entries={[
              {
                icon: <Store className="w-[22px] h-[22px]" strokeWidth={1.5} />,
                label: "Cửa hàng chính",
                content: <p className="text-muted-foreground text-sm leading-snug m-0">{address}</p>,
              },
              {
                icon: <Phone className="w-[22px] h-[22px]" strokeWidth={1.5} />,
                label: "Hotline",
                content: (
                  <>
                    <p className="text-muted-foreground text-sm leading-snug m-0">028.62797251</p>
                    <p className="text-muted-foreground text-sm leading-snug m-0">0784.640.679 - Mrs. Thư / ZALO</p>
                    <p className="text-muted-foreground text-sm leading-snug m-0">090.690.2404 - Mr. Trí</p>
                    <p className="text-muted-foreground text-sm leading-snug mt-2 mb-0">Thứ 2 - Thứ 6: 09:00 - 21:00</p>
                    <p className="text-muted-foreground text-sm leading-snug m-0">Thứ 7, Chủ Nhật: 09:00 - 18:00</p>
                  </>
                ),
              },
              {
                icon: <Share2 className="w-[22px] h-[22px]" strokeWidth={1.5} />,
                label: "Facebook",
                content: (
                  <p className="text-muted-foreground text-sm leading-snug m-0">
                    <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bb-link">
                      {facebookHandle || "facebook.com/bigbikegear"}
                    </a>
                  </p>
                ),
              },
            ]}
          />
        </div>
      </div>
      </section>
    </>
  );
}
