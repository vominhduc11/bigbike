import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";

export function CheckoutStepTitle({ step, children }: { step?: number; children: React.ReactNode }) {
  return (
    <div className="check-out-step-title">
      {step == null ? (
        <h3 className="pl-0!">{children}</h3>
      ) : (
        <h3>
          <span>
            <b>{step}</b>
          </span>{" "}
          {children}
        </h3>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="m-0 mt-1 text-ui-14 max-md:text-ui-12 text-brand">{message}</p>;
}

export function CodPaymentBlock() {
  const t = useTranslations("Checkout");
  return (
    <div className="bb-co-cod-block">
      <div className="bb-co-cod-icon">
        <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-white"><path d="M2 8h20v2H2zm0 4h20v2H2zm0 4h12v2H2zM18 14l2 2 4-4-1.4-1.4L20 13.2l-.6-.6z"/></svg>
      </div>
      <div className="bb-co-cod-text text-left">
        <strong>{t("paymentMethod.COD")}</strong>
        <span>{t("codSubtitle")}</span>
      </div>
      <div className="bb-co-cod-check">
        <svg viewBox="0 0 24 24" className="w-[13px] h-[13px] fill-white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      </div>
    </div>
  );
}

export function CheckoutConfirmRow({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const t = useTranslations("Checkout");
  return (
    <div className="bb-co-confirm-row text-left">
      <Checkbox
        id="confirm-cb"
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-1 h-5 w-5 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:text-white rounded-none"
      />
      <label htmlFor="confirm-cb" className="select-none text-ui-15 leading-relaxed text-foreground cursor-pointer">
        {t.rich("confirmNotice", { strong: (chunks) => <strong className="text-black">{chunks}</strong> })}
      </label>
    </div>
  );
}

export function TrustMini() {
  const t = useTranslations("Checkout");
  return (
    <div className="bb-co-trust-mini text-left">
      <div className="bb-co-trust-row">
        <div className="bb-co-trust-dot" />
        <span>{t("trustShipping")}</span>
      </div>
      <div className="bb-co-trust-row">
        <div className="bb-co-trust-dot" />
        <span>{t("trustReturnPolicy")}</span>
      </div>
      <div className="bb-co-trust-row">
        <div className="bb-co-trust-dot" />
        <span>{t("trustWarranty")}</span>
      </div>
      <div className="bb-co-trust-row">
        <div className="bb-co-trust-dot" />
        {/* Địa chỉ cửa hàng — dữ liệu doanh nghiệp (legacy storefront address fragment), giữ nguyên
            không dịch (allowlist trong check-no-runtime-business-data.mjs). */}
        <span>79/30/52 Âu Cơ, Phường Hòa Bình, TP.HCM</span>
      </div>
    </div>
  );
}

export function ZaloSupportBlock() {
  const t = useTranslations("Checkout");
  return (
    <div className="bb-co-zalo-block">
      <p className="text-ui-15 text-foreground mb-2.5 font-semibold">{t("zaloSupportTitle")}</p>
      <a
        href="https://zalo.me/0764640679"
        target="_blank"
        rel="noopener noreferrer"
        className="bb-co-zalo-btn"
      >
        {t("zaloSupportCta")}
      </a>
      {/* Tên nhân viên tư vấn + SĐT — dữ liệu doanh nghiệp (legacy storefront phone number), giữ
          nguyên không dịch (allowlist trong check-no-runtime-business-data.mjs). */}
      <p className="text-ui-13 text-muted-foreground mt-2">Mrs. Thư · 0764640679</p>
    </div>
  );
}
