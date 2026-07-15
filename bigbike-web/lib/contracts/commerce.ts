import type { ImageAsset } from "@/lib/contracts/public"

export type CartItem = {
  id: string
  productId: string | null
  productVariantId: string | null
  sku: string | null
  productName: string
  variantName: string | null
  image?: ImageAsset | null
  quantity: number
  unitPrice: number
  lineSubtotal: number
  lineDiscount: number
  lineTotal: number
  available: boolean
}

 type CartTotals = {
  subtotalAmount: number
  discountAmount: number
  shippingAmount: number
  feeAmount: number
  totalAmount: number
}

export type Cart = {
  id: string
  status: string
  currency: string
  items: CartItem[]
  totals: CartTotals
}

 type CheckoutAddress = {
  fullName: string
  email: string
  phone: string
  country: string
  province: string
  ward: string
  addressLine1: string
  addressLine2?: string
}

export type QuickBuyPayload = {
  productId: string
  productVariantId?: string | null
  quantity: number
  billingAddress: CheckoutAddress
  // COD là phương thức duy nhất trên storefront (owner decision 2026-07-15, PAY_RULE_001) —
  // checkout/quick-buy luôn gửi "COD"; backend từ chối giá trị khác.
  paymentMethod?: string
  customerNote?: string
}

export type CheckoutPayload = {
  billingAddress: CheckoutAddress
  shippingAddress?: CheckoutAddress | null
  // Luôn "COD" — see QuickBuyPayload#paymentMethod.
  paymentMethod?: string
  customerNote?: string
}

 type PaymentMethodOption = {
  code: string
  title: string
}

export type CheckoutOptions = {
  paymentMethods: PaymentMethodOption[]
}

export type PriceChange = {
  productName: string
  oldPrice: number
  newPrice: number
}

export type OrderSummary = {
  id: string
  orderNumber: string
  orderKey: string
  status: string
  paymentStatus: string
  paymentMethod: string
  subtotalAmount: number
  shippingAmount: number
  discountAmount: number
  totalAmount: number
  currency: string
  priceChanges?: PriceChange[]
}

export type OrderLineItem = {
  id: string
  productId: string | null
  productVariantId: string | null
  sku: string | null
  productName: string
  variantName: string | null
  quantity: number
  unitPrice: number
  lineSubtotal: number
  lineDiscount: number
  lineTotal: number
  /** Current catalog image of the product; null when the product no longer exists. */
  productThumbnailUrl: string | null
}

export type OrderAddress = {
  type: string
  fullName: string
  email: string | null
  phone: string | null
  country: string | null
  province: string | null
  district: string | null
  ward: string | null
  addressLine1: string | null
  addressLine2: string | null
}

 export type OrderShippingItem = {
  id: string
  methodCode: string | null
  methodTitle: string
  amount: number
}

 export type OrderPayment = {
  id: string
  paymentMethod: string
  status: string
  amount: number
  currency: string
  paidAt: string | null
}

 type OrderNote = {
  id: string
  noteType?: string
  content: string
  createdAt: string
}

export type OrderDetail = {
  id: string
  orderNumber: string
  orderKey: string | null
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  customerEmail: string | null
  customerPhone: string | null
  customerNote: string | null
  currency: string
  subtotalAmount: number
  discountAmount: number
  shippingAmount: number
  feeAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  refundAmount: number
  refundReason: string | null
  refundedAt: string | null
  placedAt: string
  channel?: string
  lineItems: OrderLineItem[]
  addresses: OrderAddress[]
  shippingItems: OrderShippingItem[]
  payments: OrderPayment[]
  notes: OrderNote[]
}

export type CustomerProfile = {
  id: string
  email: string
  phone: string | null
  displayName: string | null
  status: string
  gender?: string | null
  dob?: string | null
  emailVerified?: boolean
}

export type CustomerAuthData = {
  customer: {
    id: string
    email: string
    phone: string | null
    displayName: string | null
    status: string
  }
  csrfToken: string
}

export type OrderListItem = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  totalAmount: number
  currency: string
  placedAt: string
  itemCount: number
  productNames?: string[]
  channel?: string
}

export type CustomerAddress = {
  id: string
  type: string
  fullName: string | null
  phone: string | null
  email: string | null
  country: string
  province: string | null
  district: string | null
  ward: string | null
  addressLine1: string | null
  addressLine2: string | null
  isDefault: boolean
}

export type UpdateCustomerProfilePayload = {
  displayName?: string
  phone?: string
  email?: string
  currentPassword?: string
  newPassword?: string
  gender?: string
  dob?: string
}

export type SaveAddressPayload = {
  type: string
  fullName: string
  phone: string
  email?: string
  province: string
  ward: string
  addressLine1: string
  addressLine2?: string
  isDefault?: boolean
}

