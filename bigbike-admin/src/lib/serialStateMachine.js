// Canonical serial lifecycle state machine for admin UI.
// Backend source of truth: AdminSerialService.validateTransition()

export const SERIAL_STATUS_LABELS = {
  IN_STOCK:   'Có sẵn',
  RESERVED:   'Đang giữ',
  SOLD:       'Đã bán',
  RETURNED:   'Đã trả lại',
  INSPECTION: 'Đang kiểm',
  DAMAGED:    'Hỏng',
  SCRAPPED:   'Đã hủy',
}

// Tailwind utility classes — no hardcoded hex.
export const SERIAL_STATUS_CLASSES = {
  IN_STOCK:   'text-green-700 bg-green-50',
  RESERVED:   'text-blue-700 bg-blue-50',
  SOLD:       'text-violet-700 bg-violet-50',
  RETURNED:   'text-amber-700 bg-amber-50',
  INSPECTION: 'text-cyan-700 bg-cyan-50',
  DAMAGED:    'text-red-700 bg-red-50',
  SCRAPPED:   'text-muted-foreground bg-muted',
}

// Admin-visible transitions only (RESERVED is checkout-only, omitted here).
export const SERIAL_ALLOWED_TRANSITIONS = {
  IN_STOCK:   ['DAMAGED', 'INSPECTION', 'SCRAPPED'],
  RESERVED:   ['IN_STOCK'],
  SOLD:       ['RETURNED'],
  RETURNED:   ['INSPECTION'],
  INSPECTION: ['IN_STOCK', 'DAMAGED', 'SCRAPPED'],
  DAMAGED:    ['SCRAPPED'],
  SCRAPPED:   [],
}

// Statuses that require a non-empty note before the transition is accepted.
export const NOTE_REQUIRED_STATUSES = new Set(['DAMAGED', 'SCRAPPED'])
