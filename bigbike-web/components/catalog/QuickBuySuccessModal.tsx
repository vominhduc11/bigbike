"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SuccessOrder = {
  orderNumber: string;
  orderKey: string;
  paymentMethod: string;
};

type Props = {
  order: SuccessOrder | null;
  onClose: () => void;
};

export function QuickBuySuccessModal({ order, onClose }: Props) {
  const t = useTranslations("Checkout.quickbuy");
  const router = useRouter();

  function handleViewOrder() {
    if (!order) return;
    onClose();
    router.push(`/don-hang/xac-nhan?so=${order.orderNumber}&key=${order.orderKey}`);
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm rounded-none">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <DialogTitle className="text-center">{t("success.title")}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-center px-2 pb-2">
          {order && (
            <p className="text-sm font-semibold text-foreground">
              {t("success.orderNumber", { orderNumber: order.orderNumber })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t("success.willContact")}</p>
          {order?.paymentMethod === "BACS" && (
            <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 border border-amber-200">
              {t("success.bacsHint")}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              className="w-full rounded-none"
              onClick={handleViewOrder}
            >
              {t("success.viewOrder")}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-none"
              onClick={onClose}
            >
              {t("success.continueShopping")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
