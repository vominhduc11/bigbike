"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCheckoutOptions, submitQuickBuy } from "@/lib/api/client-api";
import type { CheckoutAddress, CheckoutOptions } from "@/lib/contracts/commerce";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { formatVnd } from "@/lib/utils/format";
import { toOrderConfirmPath } from "@/lib/utils/routes";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuickBuyModalProps = {
  productId: string;
  selectedVariantId: string;
  quantity: number;
  productName: string;
  onClose: () => void;
};

const EMPTY_ADDRESS: CheckoutAddress = {
  fullName: "",
  email: "",
  phone: "",
  country: "VN",
  province: "",
  district: "",
  ward: "",
  addressLine1: "",
  addressLine2: "",
};

export function QuickBuyModal({
  productId,
  selectedVariantId,
  quantity,
  productName,
  onClose,
}: QuickBuyModalProps) {
  const router = useRouter();
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [checkoutOptions, setCheckoutOptions] = useState<CheckoutOptions | null>(null);
  const [checkoutOptionsError, setCheckoutOptionsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchCheckoutOptions()
      .then((opts) => {
        setCheckoutOptions(opts);
        setPaymentMethod((prev) => prev || opts.paymentMethods[0]?.code || "");
        setShippingMethodId((prev) => prev || opts.shippingMethods[0]?.id || "");
      })
      .catch((err: Error) => setCheckoutOptionsError(err.message));
  }, []);

  function updateAddressField<K extends keyof CheckoutAddress>(
    key: K,
    value: string,
  ) {
    setAddress((cur) => ({ ...cur, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const order = await submitQuickBuy(
        {
          productId,
          productVariantId: selectedVariantId || null,
          quantity,
          billingAddress: {
            fullName: address.fullName.trim(),
            email: address.email.trim(),
            phone: address.phone.trim(),
            country: "VN",
            province: address.province.trim(),
            district: address.district.trim(),
            ward: address.ward.trim(),
            addressLine1: address.addressLine1.trim(),
            addressLine2: address.addressLine2?.trim() || "",
          },
          shippingMethodId: shippingMethodId || null,
          paymentMethod,
          customerNote: customerNote.trim() || undefined,
        },
        idempotencyKey.current,
      );
      setSuccess(`Đã tạo đơn #${order.orderNumber}. Đang chuyển hướng...`);
      router.push(toOrderConfirmPath(order.orderNumber, order.orderKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể mua ngay.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <SheetTitle>Mua ngay</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground line-clamp-1">
            {productName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {checkoutOptionsError && (
            <p className="mb-4 text-sm text-destructive">{checkoutOptionsError}</p>
          )}

          <form
            onSubmit={handleSubmit}
            id="qb-form"
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium font-body text-foreground">
                  Họ tên <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={address.fullName}
                  onChange={(e) => updateAddressField("fullName", e.target.value)}
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium font-body text-foreground">
                  Số điện thoại <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  type="tel"
                  inputMode="numeric"
                  pattern="0[3-9][0-9]{8}"
                  maxLength={10}
                  value={address.phone}
                  onChange={(e) => updateAddressField("phone", e.target.value)}
                  autoComplete="tel"
                  placeholder="09xxxxxxxx"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium font-body text-foreground">Email</label>
                <Input
                  type="email"
                  value={address.email}
                  onChange={(e) => updateAddressField("email", e.target.value)}
                  autoComplete="email"
                  placeholder="email@example.com"
                />
              </div>

              {/* Province / District / Ward — keeps existing VnAddressFields component */}
              <div className="sm:col-span-2">
                <VnAddressFields
                  value={{
                    province: address.province,
                    district: address.district,
                    ward: address.ward,
                  }}
                  onChange={(field, val) => updateAddressField(field, val)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium font-body text-foreground">
                  Địa chỉ <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={address.addressLine1}
                  onChange={(e) => updateAddressField("addressLine1", e.target.value)}
                  autoComplete="street-address"
                  placeholder="Số nhà, tên đường..."
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium font-body text-foreground">Ghi chú</label>
                <Textarea
                  className="min-h-20"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={3}
                  placeholder="Yêu cầu đặc biệt (không bắt buộc)"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium font-body text-foreground">
                Phương thức thanh toán <span className="text-destructive">*</span>
              </label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phương thức" />
                </SelectTrigger>
                <SelectContent>
                  {(checkoutOptions?.paymentMethods ?? []).map((m) => (
                    <SelectItem key={m.code} value={m.code}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium font-body text-foreground">
                Phương thức giao hàng <span className="text-destructive">*</span>
              </label>
              <Select value={shippingMethodId} onValueChange={setShippingMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phương thức" />
                </SelectTrigger>
                <SelectContent>
                  {(checkoutOptions?.shippingMethods ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title} — {formatVnd(m.cost)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm font-medium text-[var(--bb-state-success-text)]">{success}</p>}
          </form>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-border bg-card">
          <Button
            type="submit"
            form="qb-form"
            variant="primary"
            className="w-full"
            disabled={loading || !paymentMethod || !shippingMethodId}
          >
            {loading ? "Đang tạo đơn hàng..." : "Xác nhận mua ngay"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
