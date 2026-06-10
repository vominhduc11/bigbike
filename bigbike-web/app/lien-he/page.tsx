import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { getPageBySlug, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText, telHref } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

/* eslint-disable @next/next/no-img-element */

const T = "/wp-content/themes/bigbike";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("StaticPage")]);
  const pageResult = await getPageBySlug("lien-he", locale);
  const page = pageResult.data;

  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("contactTitle"),
    description: page?.seo?.description ?? t("contactDescription"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("lien-he"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function ContactPage() {
  const locale = await getLocale();
  const [pageResult, settingsResult] = await Promise.all([
    getPageBySlug("lien-he", locale),
    listPublicSettings(locale),
  ]);

  const page = pageResult.data;
  const settings = settingsResult.data ?? [];
  const pageTitle = safeText(page?.title, "Liên hệ");

  const hotline = pickSetting(settings, ["hotline"]);
  const hotline2 = pickSetting(settings, ["hotline_2"]);
  const address = pickSetting(settings, ["contact_address"]);
  const zaloUrl = pickSetting(settings, ["zalo_url"]);
  const facebookUrl = pickSetting(settings, ["facebook_url"]);
  const mapUrl = pickSetting(settings, ["google_maps_url"]);

  // Map embed: ưu tiên URL nhúng Google Maps trong settings, fallback theo địa chỉ.
  const canEmbedMap = /^https?:\/\/(www\.)?google\.com\/maps[/?#]/.test(mapUrl);
  const fallbackMap = address
    ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=17&output=embed`
    : "";
  const mapEmbedSrc = canEmbedMap ? mapUrl : fallbackMap;
  const sanitizedBody = page?.body ? sanitizeRichHtml(page.body) : "";

  // page-contact.php: #main-content.contact-page (KHÔNG có .page-title) > .iframe
  // (map full-width) > .container > .static-page.wyswyg > .row [.information +
  // .contact-form]. Số điện thoại / địa chỉ / kênh online lấy từ settings.
  return (
    <WpStaticShell title={pageTitle} breadcrumb={[]} showHero={false} mainClassName="pb-40 contact-page">
      {mapEmbedSrc ? (
        <div className="iframe">
          <iframe
            title={pageTitle}
            src={mapEmbedSrc}
            width="100%"
            height="375"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <div className="static-page wyswyg">
              <div className="row">
                <div className="col-md-6">
                  <div className="information">
                    <div className="title">
                      <h1 style={{ fontSize: "24px" }}>{pageTitle}</h1>
                      {sanitizedBody ? (
                        <div dangerouslySetInnerHTML={{ __html: sanitizedBody }} />
                      ) : null}
                    </div>
                    <div className="desc">
                      <ul>
                        {(hotline || hotline2) ? (
                          <li className="row">
                            <div className="icon col">
                              <img src={`${T}/images/contact-call-icon.png`} alt="Liên hệ" />
                            </div>
                            <div className="text col">
                              <p>Liên hệ với chúng tôi</p>
                              {hotline ? (
                                <p>
                                  <b>
                                    <a href={telHref(hotline)}>{hotline}</a>
                                  </b>
                                </p>
                              ) : null}
                              {hotline2 ? (
                                <p>
                                  <b>
                                    <a href={telHref(hotline2)}>{hotline2}</a>
                                  </b>
                                </p>
                              ) : null}
                            </div>
                          </li>
                        ) : null}
                        {address ? (
                          <li className="row">
                            <div className="icon col">
                              <img src={`${T}/images/contact-marker-icon.png`} alt="Địa chỉ" />
                            </div>
                            <div className="text col">
                              <p>Cửa hàng Bigbike</p>
                              <p><b>{address}</b></p>
                            </div>
                          </li>
                        ) : null}
                        <li className="row">
                          <div className="icon col">
                            <img src={`${T}/images/contact-calendar-icon.png`} alt="Giờ làm việc" />
                          </div>
                          <div className="text col">
                            <p>Giờ làm việc</p>
                            <p><b>T2 - T6: 09h00 - 21h00</b></p>
                            <p><b>T7 / CN: 09h00 - 18h00</b></p>
                            <p><b>Lễ / Tết: nghỉ</b></p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="contact-form">
                    <div className="title">
                      <h3>Liên hệ trực tuyến</h3>
                      <p>Để được tư vấn nhanh nhất, vui lòng liên hệ với Bigbike qua các kênh dưới đây.</p>
                    </div>
                    <div className="webform">
                      <ul>
                        {zaloUrl ? (
                          <li className="row">
                            <div className="text col">
                              <p>Zalo</p>
                              <p>
                                <b>
                                  <a href={zaloUrl} target="_blank" rel="noopener noreferrer">
                                    Chat qua Zalo
                                  </a>
                                </b>
                              </p>
                            </div>
                          </li>
                        ) : null}
                        {facebookUrl ? (
                          <li className="row">
                            <div className="text col">
                              <p>Facebook</p>
                              <p>
                                <b>
                                  <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                                    {facebookUrl.replace(/^https?:\/\/(www\.)?/, "")}
                                  </a>
                                </b>
                              </p>
                            </div>
                          </li>
                        ) : null}
                        {hotline ? (
                          <li className="row">
                            <div className="text col">
                              <p>Hotline</p>
                              <p>
                                <b>
                                  <a href={telHref(hotline)}>{hotline}</a>
                                </b>
                              </p>
                            </div>
                          </li>
                        ) : null}
                      </ul>
                    </div>
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
