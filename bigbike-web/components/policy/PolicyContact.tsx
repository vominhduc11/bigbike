import { getTranslations } from "next-intl/server";
import Link from "@/i18n/StorefrontLink";
import { BUSINESS_IDENTITY, getBusinessRegistration } from "@/lib/content/business-identity";
import type { PublicSiteSetting } from "@/lib/contracts/public";
import { telHref } from "@/lib/utils/format";
import { translatePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";
import type { Locale } from "@/i18n/locale";

/** Thông tin đơn vị công bố và kênh liên hệ lấy từ nguồn chung của cửa hàng. */
export async function PolicyContact({
  locale,
  settings,
}: {
  locale: Locale;
  settings?: PublicSiteSetting[] | null;
}) {
  const t = await getTranslations({ locale, namespace: "PolicyContact" });
  const value = (key: string) => pickSetting(settings ?? [], [key]);
  const phones = [value("hotline"), value("hotline_2")].filter(Boolean);
  const email = value("contact_email");
  const address = value("contact_address");

  return (
    <section className="mt-8 border-t border-border pt-6 text-a4-content leading-body">
      <h2 className="mb-4 text-a3-section font-bold uppercase text-foreground">{t("title")}</h2>
      <p className="mb-3 text-a5-meta">{getBusinessRegistration(locale)}</p>
      <p className="mb-3">{t("representative", { name: BUSINESS_IDENTITY.representative })}</p>
      <dl className="grid gap-3">
        {address && (
          <div>
            <dt className="font-semibold">{t("address")}</dt>
            <dd>{address}</dd>
          </div>
        )}
        {phones.length > 0 && (
          <div>
            <dt className="font-semibold">{t("hotline")}</dt>
            <dd className="flex flex-col items-start gap-1">
              {phones.map((phone) => (
                <a
                  key={phone}
                  href={telHref(phone)}
                  className="inline-flex min-h-11 items-center text-brand underline underline-offset-4"
                >
                  {phone}
                </a>
              ))}
            </dd>
          </div>
        )}
        {email && (
          <div>
            <dt className="font-semibold">{t("email")}</dt>
            <dd>
              <a
                href={`mailto:${email}`}
                className="inline-flex min-h-11 items-center break-all text-brand underline underline-offset-4"
              >
                {email}
              </a>
            </dd>
          </div>
        )}
      </dl>
      {!address && phones.length === 0 && !email && (
        <p role="status" className="mb-3 text-muted-foreground">
          {t("unavailable")}
        </p>
      )}
      <Link
        href={translatePath("/lien-he/", locale)}
        className="mt-4 inline-flex min-h-11 items-center text-brand underline underline-offset-4"
      >
        {t("contactLink")}
      </Link>
    </section>
  );
}
