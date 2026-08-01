import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import { cn } from "@/lib/utils";
import { zaloHref } from "@/lib/utils/format";

export function CheckoutStepTitle({ step, children }: { step?: number; children: React.ReactNode }) {
  return (
    <div className="mb-6 font-body text-a2-page font-semibold">
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

export type CheckoutPaymentMethod = "COD" | "BANK_TRANSFER";

export function PaymentMethodSelector({
  value,
  onValueChange,
}: {
  value: CheckoutPaymentMethod;
  onValueChange: (value: CheckoutPaymentMethod) => void;
}) {
  const t = useTranslations("Checkout");
  return (
    <RadioGroup
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === "COD" || nextValue === "BANK_TRANSFER") {
          onValueChange(nextValue);
        }
      }}
      aria-label={t("paymentMethodTitle")}
      className="gap-3"
    >
      <div className={cn(
        "flex items-start gap-3 border p-4 transition-colors",
        value === "COD" ? "border-brand bg-secondary ring-1 ring-brand/20" : "border-border bg-background",
      )}>
        <RadioGroupItem
          id="payment-cod"
          value="COD"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        >
          {value === "COD" ? <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
        </RadioGroupItem>
        <Label htmlFor="payment-cod" className="min-w-0 flex-1 cursor-pointer text-left leading-relaxed">
          <span className="block font-semibold">{t("paymentMethod.COD")}</span>
          <span className="mt-1 block text-a5-meta font-normal text-muted-foreground">{t("codSubtitle")}</span>
        </Label>
      </div>

      <div className={cn(
        "flex items-start gap-3 border p-4 transition-colors",
        value === "BANK_TRANSFER" ? "border-brand bg-secondary ring-1 ring-brand/20" : "border-border bg-background",
      )}>
        <RadioGroupItem
          id="payment-bank-transfer"
          value="BANK_TRANSFER"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        >
          {value === "BANK_TRANSFER" ? <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
        </RadioGroupItem>
        <Label htmlFor="payment-bank-transfer" className="min-w-0 flex-1 cursor-pointer text-left leading-relaxed">
          <span className="block font-semibold">{t("paymentMethod.BANK_TRANSFER")}</span>
          <span className="mt-1 block text-a5-meta font-normal text-muted-foreground">{t("bankTransferSubtitle")}</span>
        </Label>
      </div>
    </RadioGroup>
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
