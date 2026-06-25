"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogGrabber,
  DialogHeader,
  DialogTitle,
  dialogMobileBottomSheet,
} from "@/components/ui/dialog";
import { WriteReviewForm } from "@/components/catalog/ReviewsSection";
import { WRITE_REVIEW_EVENT } from "@/components/catalog/writeReviewBus";

// Modal viết đánh giá — mount MỘT lần ở ProductView. Khối đánh giá phía dưới chỉ
// để XEM; mọi nút "Viết đánh giá" (trên khối mua hàng + trong khối đánh giá) chỉ
// bắn sự kiện mở modal này, không còn cuộn xuống form inline.
export function WriteReviewDialog({ productId }: { productId: string }) {
  const t = useTranslations("Product.reviews");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(WRITE_REVIEW_EVENT, onOpen);
    return () => window.removeEventListener(WRITE_REVIEW_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Desktop: thẻ căn giữa (kế thừa từ DialogContent). Mobile (<md): bottom sheet
          dock đáy, trượt lên từ dưới — ngón cái dễ thao tác, vẫn lộ một phần trang
          phía trên để người dùng biết đang ở đâu. */}
      <DialogContent className={dialogMobileBottomSheet}>
        <DialogGrabber />
        <DialogHeader>
          <DialogTitle>{t("formTitle")}</DialogTitle>
          <DialogDescription>{t("formIntro")}</DialogDescription>
        </DialogHeader>
        {/* Mount mới mỗi lần mở để form luôn sạch (reset sao/ảnh/trạng thái đã gửi).
            onSuccess làm tươi danh sách đánh giá phía dưới ngay khi gửi xong. */}
        {open && (
          <WriteReviewForm
            productId={productId}
            variant="dialog"
            onSuccess={() => {
              void queryClient.invalidateQueries({
                queryKey: ["product-reviews", productId],
              });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
