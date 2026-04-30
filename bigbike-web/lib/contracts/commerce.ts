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
}

export type CartTotals = {
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
  couponCodes?: string[]
}

export type CheckoutAddress = {
  fullName: string
  email: string
  phone: string
  country: string
  province: string
  district: string
  ward: string
  addressLine1: string
  addressLine2?: string
}

export type QuickBuyPayload = {
  productId: string
  productVariantId?: string | null
  quantity: number
  billingAddress: CheckoutAddress
  shippingMethodId?: string | null
  paymentMethod: string
  customerNote?: string
}

export type CheckoutPayload = {
  billingAddress: CheckoutAddress
  shippingAddress?: CheckoutAddress | null
  shippingMethodId?: string | null
  paymentMethod: string
  customerNote?: string
}

export type PaymentMethodOption = {
  code: string
  title: string
}

export type ShippingMethodOption = {
  id: string
  code: string
  title: string
  cost: number
}

export type CheckoutOptions = {
  paymentMethods: PaymentMethodOption[]
  shippingMethods: ShippingMethodOption[]
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
  code: string | null
  title: string
  cost: number
}

export type OrderPayment = {
  id: string
  status: string
  method: string
  amount: number
  transactionId: string | null
  paidAt: string | null
}

export type OrderNote = {
  id: string
  type?: string  // backend CustomerOrderReadService does not return type; admin-visible only
  content: string
  createdAt: string
}

export type OrderDetail = {
  id: string
  orderNumber: string
  orderKey: string
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
}

export type CustomerAddress = {
  id: string
  type: string
  fullName: string | null
  phone: string | null
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
  province: string
  district: string
  ward: string
  addressLine1: string
  addressLine2?: string
  isDefault?: boolean
}

export type ContactPayload = {
  fullName: string
  phone: string
  email?: string
  content: string
}

export type CustomerReturnItem = {
  id: string
  productName: string
  variantName: string | null
  sku: string | null
  quantity: number
  unitPrice: number
  reason: string | null
}

export type CustomerReturnHistory = {
  fromStatus: string | null
  toStatus: string
  note: string | null
  createdAt: string
}

export type CustomerReturn = {
  id: string
  returnNumber: string
  orderId: string
  orderNumber: string | null
  status: string
  reason: string
  customerNote: string | null
  adminNote: string | null
  refundAmount: number
  items: CustomerReturnItem[]
  history: CustomerReturnHistory[]
  createdAt: string
  updatedAt: string
}

export type CreateReturnItemPayload = {
  orderLineItemId: string
  productName: string
  variantName?: string | null
  sku?: string | null
  quantity: number
  unitPrice?: number | null
  reason?: string | null
}

export type CreateReturnPayload = {
  reason: string
  customerNote?: string
  items?: CreateReturnItemPayload[]
}
