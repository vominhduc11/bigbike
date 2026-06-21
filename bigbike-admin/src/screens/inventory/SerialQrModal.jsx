import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '../../components/layout'
import { formatDateTime } from '../../lib/formatters'

export function SerialQrModal({ serial, onClose }) {
  const qrRef = useRef(null)
  const qrValue = serial.serialNumber || ''
  const label   = serial.serialNumber || ''

  function handlePrint() {
    const style = document.createElement('style')
    style.textContent = `
      @media print {
        body > * { visibility: hidden !important; }
        #serial-qr-print, #serial-qr-print * { visibility: visible !important; }
        #serial-qr-print {
          position: fixed !important; inset: 0 !important;
          display: flex !important; flex-direction: column !important;
          align-items: center !important; justify-content: center !important;
          gap: 10px !important; background: white !important;
        }
      }
    `
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }

  return (
    <Modal
      open
      title="Mã QR Serial"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={onClose}>Đóng</button>
          <button type="button" className="bb-btn bb-btn-primary bb-btn-sm" onClick={handlePrint} disabled={!qrValue}>In QR</button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div id="serial-qr-print" ref={qrRef} className="flex flex-col items-center gap-2">
          {qrValue ? (
            <QRCodeSVG value={qrValue} size={180} level="H" marginSize={2} />
          ) : (
            <p className="text-sm text-muted-foreground">Không có dữ liệu để tạo QR.</p>
          )}
          <p className="font-mono font-bold text-sm tracking-wide">{label}</p>
          {serial.receivedAt && (
            <p className="text-xs text-muted-foreground">Nhập kho: {formatDateTime(serial.receivedAt)}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
