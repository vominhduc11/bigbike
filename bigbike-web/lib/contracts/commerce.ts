export type CartItem = {
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

export type CheckoutPayload = {
  billingAddress: CheckoutAddress
  shippingAddress?: CheckoutAddress | null
  shippingMethodId?: string | null
  paymentMethod: string
  customerNote?: string
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

export type CustomerProfile = {
  id: string
  email: string
  phone: string | null
  displayName: string | null
  status: string
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
