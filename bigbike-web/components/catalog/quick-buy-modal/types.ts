export type QuickBuyModalProps = {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  selectedVariantId?: string | null;
  variantLabel?: string | null;
  unitPrice?: number | null;
  onSuccess: (order: { orderNumber: string; orderKey: string }) => void;
};
