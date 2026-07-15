import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import { zaloHref } from "@/lib/utils/format";

export function CheckoutStepTitle({ step, children }: { step?: number; children: React.ReactNode }) {
  return (
    <div className="mb-6 font-cta text-a2-page font-semibold uppercase">
      {step == null ? (
        <h3 className="m-0">{children}</h3>
      ) : (
        <h3 className="m-0 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center bg-brand text-white">{step}</span>
          {children}
        </h3>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="m-0 mt-1 text-a5-meta text-brand">{message}</p>;
}

export function CodPaymentBlock() {
  const t = useTranslations("Checkout");
  return (
    <div className="flex items-center gap-4 border border-border bg-secondary p-4">
      <div className="flex h-10 w-10 items-center justify-center bg-foreground">
        <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-white"><path d="M2 8h20v2H2zm0 4h20v2H2zm0 4h12v2H2zM18 14l2 2 4-4-1.4-1.4L20 13.2l-.6-.6z"/></svg>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <strong className="block">{t("paymentMethod.COD")}</strong>
        <span className="mt-1 block text-a5-meta text-muted-foreground">{t("codSubtitle")}</span>
      </div>
      <div className="flex h-6 w-6 items-center justify-center bg-brand">
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
    <div className="mt-5 flex items-start gap-3 text-left">
      <Checkbox
        id="confirm-cb"
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-1 h-5 w-5 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:text-white rounded-none"
      />
      <label htmlFor="confirm-cb" className="select-none text-a5-meta leading-relaxed text-foreground cursor-pointer">
        {t.rich("confirmNotice", { strong: (chunks) => <strong className="text-black">{chunks}</strong> })}
      </label>
    </div>
  );
}

export function TrustMini({ address }: { address?: string }) {
  const t = useTranslations("Checkout");
  return (
    <div className="mt-5 space-y-2 border-t border-border pt-5 text-left text-a5-meta text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rotate-45 bg-brand" />
        <span>{t("trustShipping")}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rotate-45 bg-brand" />
        <span>{t("trustReturnPolicy")}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rotate-45 bg-brand" />
        <span>{t("trustWarranty")}</span>
      </div>
      {address ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rotate-45 bg-brand" />
          <span>{address}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ZaloSupportBlock({ zaloUrl, zaloDisplay }: { zaloUrl?: string; zaloDisplay?: string }) {
  const t = useTranslations("Checkout");
  if (!zaloUrl) return null;
  return (
    <aside className="border border-border bg-secondary p-5 text-center">
      <p className="text-a5-meta text-foreground mb-2.5 font-semibold">{t("zaloSupportTitle")}</p>
      <Button asChild variant="outline" className="w-full rounded-none border-zalo text-zalo hover:text-zalo">
        <a href={zaloHref(zaloUrl)} target="_blank" rel="noopener noreferrer">
          <ZaloIcon className="h-5 w-5" aria-hidden />
          {t("zaloSupportCta")}
        </a>
      </Button>
      {zaloDisplay ? <p className="text-a5-meta text-muted-foreground mt-2">{zaloDisplay}</p> : null}
    </aside>
  );
}
