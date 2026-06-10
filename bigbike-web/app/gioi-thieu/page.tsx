import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Share2, Store } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, telHref, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { toBrandPath, toHomePath, toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

/* eslint-disable @next/next/no-img-element */

const T = "/wp-content/themes/bigbike";

// Khối lưới dịch vụ — copy cố định 1:1 từ page-templates/page-about.php (theme WP).
const SERVICE_GRID = [
  {
    img: `${T}/images/a-1.png`,
    redBg: true,
    title: "Các chương trình khuyến mãi hấp dẫn",
    body: "Ngoài ra, những thông tin, tin tức mới nhất về các sản phẩm moto cũng như các sự kiện nổi bật cũng luôn được chúng tôi cập nhật thường xuyên trên website chính thức của Bigbike. Ngoài ra, các biker có thể tham khảo thêm một số bài viết so sánh và đánh giá về các trang thiết bị bảo hộ phượt tại đây.",
  },
  {
    img: `${T}/images/a-2.png`,
    redBg: false,
    title: "Cập nhật xu hướng liên tục",
    body: "Những xu hướng và mẫu mã sản phẩm thịnh hành nhất trên thị trường hiện nay luôn được Bigbike cập nhật liên tục nhằm đáp ứng kịp thời thị hiếu và nhu cầu từ cơ bản đến nâng cao của khách hàng. Và chúng tôi thường xuyên có những chương trình ưu đãi và hậu mãi hấp dẫn để đem đến cho các biker nhiều cơ hội trải nghiệm sản phẩm cũng như tri ân khách hàng thân thiết.",
  },
  {
    img: `${T}/images/a-3.png`,
    redBg: false,
    title: "Chất lượng dịch vụ tạo nên sự khác biệt",
    body: "Khi đến với Bigbike, khách hàng sẽ được tư vấn kỹ lượng về mọi thông tin chi tiết sản phẩm cũng như được giải đáp các thắc mắc một cách tận tình và chu đáo. Đội ngũ nhân viên Bigbike được đào tạo chuyên nghiệp và có sự am hiểu thông tin của sản phẩm sẽ luôn sẵn sàng tư vấn và hỗ trợ khách hàng khi cần thiết. Bạn có thể trực tiếp kiểm tra chất lượng sản phẩm và lựa chọn cho mình các vật dụng bảo hộ phù hợp nhất.",
  },
  {
    img: `${T}/images/a-4.png`,
    redBg: false,
    title: "Dịch vụ hậu cần tối ưu",
    body: "Các dịch vụ hậu cần cũng luôn được thực hiện nhanh chóng. Các hoạt động giao nhận hàng hóa, các chính sách bảo hành và đổi trả sản phẩm luôn được áp dụng tiện lợi nhất cho khách hàng. Các quy trình luôn được chú trọng và được thực hiện cẩn thận, từ khâu đóng gói hàng hóa cho đến khâu vận chuyển. Nhằm đảm bảo hàng hóa được giao đến tay khách hàng với trạng thái tốt nhất.",
  },
  {
    img: `${T}/images/a-5.png`,
    redBg: true,
    title: "Các thông tin nổi bật luôn được cập nhật nhanh chóng",
    body: "Chúng tôi cung cấp đầy đủ những gì bạn cần cho một cuộc hành trình. Bigbike tự hào luôn nhận được sự tin tưởng cũng như những đánh giá tích cực từ khách hàng và là đơn vị uy tín và xứng đáng để bạn trao gửi niềm tin.",
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("StaticPage")]);
  const pageResult = await getPageBySlug("gioi-thieu", locale);
  const page = pageResult.data;

  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("aboutTitle"),
    description: page?.seo?.description ?? t("aboutDescription"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("gioi-thieu"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function AboutPage() {
  const locale = await getLocale();
  const [pageResult, brandsResult, settingsResult] = await Promise.all([
    getPageBySlug("gioi-thieu", locale),
    listBrands({ page: 1, size: 8, sort: "name:asc", lang: locale }),
    listPublicSettings(locale),
  ]);

  const page = pageResult.data;
  const pageTitle = safeText(page?.title, "Giới thiệu");
  const brands = brandsResult.data ?? [];
  const settings = settingsResult.data ?? [];

  const address = pickSetting(settings, ["contact_address"]);
  const hotline = pickSetting(settings, ["hotline"]);
  const hotline2 = pickSetting(settings, ["hotline_2"]);
  const facebookUrl = pickSetting(settings, ["facebook_url"]);
  const facebookHandle = facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  // page-about.php: .static-page.wyswyg > .about-us (row-1 giới thiệu + lưới logo
  // hãng, row-2 lưới dịch vụ, .block-contact). Copy marketing cố định theo theme;
  // logo hãng nạp động từ taxonomy thương hiệu, thông tin liên hệ lấy từ settings.
  return (
    <WpStaticShell
      title={page?.heroTitle ?? pageTitle}
      heroBgUrl={page?.heroImageUrl}
      breadcrumb={[
        { label: "Bigbike.vn", href: toHomePath() },
        { label: pageTitle },
      ]}
    >
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <div className="static-page wyswyg">
              <div className="about-us">
                <div className="row row-1">
                  <div className="col-md-4">
                    <div className="block-head">
                      <h3>Bigbike</h3>
                      <p>Cửa hàng chuyên phân phối phụ kiện bảo hộ moto chính hãng uy tín tại TP HCM</p>
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="block-text">
                      <p>
                        Thời gian gần đây, du lịch phượt đang dần trở thành trào lưu trải nghiệm mang
                        tính lan tỏa nhanh chóng, thu hút ngày càng đông mọi người tham gia, đặc biệt là
                        những người đam mê xe phân khối lớn. Và hầu hết các biker luôn mong muốn tìm
                        kiếm và trang bị các thiết bị bảo hộ moto chất lượng nhằm đảm bảo an toàn cho
                        chuyến hành trình của mình.
                      </p>
                      <p>
                        Được thành lập từ năm 2013, Bigbike hiện là một trong những nhà cung cấp đồ bảo
                        hộ moto uy tín tại TP HCM. Chúng tôi tự hào là người bạn đồng hành đáng tin cậy
                        của cộng đồng biker Việt Nam trong suốt thời gian qua.
                      </p>
                      <p>
                        Chúng tôi cung cấp các dòng sản phẩm như mũ bảo hiểm, quần - áo bảo hộ, găng tay
                        và giày bảo hộ moto chính hãng từ các thương hiệu nổi tiếng trên thế giới như
                        Alpinestars, Helite, Furygan, LS2, Scoyco, Sena và SCS. Các sản phẩm của Bigbike
                        sở hữu nhiều thiết kế đa dạng với những kiểu dáng và mẫu mã khác nhau để đáp ứng
                        mọi nhu cầu của khách hàng.
                      </p>
                      <p>
                        Đến với Bigbike, khách hàng có thể hoàn toàn yên tâm về chất lượng của các sản
                        phẩm. Những dòng sản phẩm bảo hộ đều được đảm bảo đạt đủ các tiêu chuẩn an toàn
                        nên các biker có thể hoàn toàn yên tâm khi sử dụng.
                      </p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="block-img">
                      <div className="row">
                        {brands.map((brand) => {
                          const logoUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.logo?.url?.trim()));
                          if (!logoUrl) return null;
                          return (
                            <div key={brand.id} className="col-6">
                              <Link href={toBrandPath(brand.slug)} title={brand.name}>
                                <img src={logoUrl} alt={brand.logo?.alt ?? brand.name} />
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row row-2 align-items-center">
                  <div className="col-md-4">
                    <div className="block-head">
                      <h3>Chất lượng dịch vụ tạo nên sự khác biệt</h3>
                      <p>
                        Trong suốt quá trình hoạt động của mình, Bigbike đã được hân hạnh được trở thành
                        nhà tài trợ đồng hành cho các sự kiện sinh nhật, kỉ niệm và từ thiện cùng câu
                        lạc bộ xe exciter và câu lạc bộ moto Việt Nam. Bigbike luôn lắng nghe và ghi
                        nhận những ý kiến đóng góp của khách hàng. Để từ đó, chúng tôi không ngừng nỗ
                        lực cải thiện và nâng cao chất lượng dịch vụ. Sự hài lòng của khách hàng chính
                        là sự thành công của Bigbike.
                      </p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    {SERVICE_GRID.slice(0, 2).map((tile) => (
                      <div key={tile.img} className={tile.redBg ? "block-grid red-bg" : "block-grid"}>
                        <img src={tile.img} alt="logo" />
                        <h4>{tile.title}</h4>
                        <p>{tile.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="col-md-4">
                    {SERVICE_GRID.slice(2).map((tile) => (
                      <div key={tile.img} className={tile.redBg ? "block-grid red-bg" : "block-grid"}>
                        <img src={tile.img} alt="logo" />
                        <h4>{tile.title}</h4>
                        <p>{tile.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="block-contact">
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
                  <div className="row">
                    {address ? (
                      <div className="col-md-3">
                        <div className="block-item">
                          <Store size={28} strokeWidth={1.5} aria-hidden="true" />
                          <p><b>Cửa hàng chính</b></p>
                          <p>{address}</p>
                        </div>
                      </div>
                    ) : null}
                    {(hotline || hotline2) ? (
                      <div className="col-md-3 offset-md-1">
                        <div className="block-item">
                          <Phone size={28} strokeWidth={1.5} aria-hidden="true" />
                          <p><b>Hotline</b></p>
                          {hotline ? (
                            <p>
                              <a href={telHref(hotline)}>{hotline}</a>
                            </p>
                          ) : null}
                          {hotline2 ? (
                            <p>
                              <a href={telHref(hotline2)}>{hotline2}</a>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {facebookUrl ? (
                      <div className="col-md-3 offset-md-1">
                        <div className="block-item">
                          <Share2 size={28} strokeWidth={1.5} aria-hidden="true" />
                          <p><b>Facebook</b></p>
                          <p>
                            <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                              {facebookHandle}
                            </a>
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
