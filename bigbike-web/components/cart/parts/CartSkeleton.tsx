import { SkelBlock, SkelText, SkelTitle } from "@/components/ui/skeleton/primitives";

/**
 * Ruột giỏ hàng khi đang tải — sao lại CartClient: lưới `md:grid-cols-12` với
 * danh sách 8 cột (dòng hàng theo CartItemRow: ảnh 80px điện thoại / 130px máy
 * tính, viền trên-dưới, đường kẻ giữa các dòng) và khối tổng tiền 4 cột.
 *
 * Dùng ở CẢ khung chờ cấp trang (/gio-hang/loading.tsx) lẫn lúc CartClient chờ dữ
 * liệu — một định nghĩa duy nhất nên khách không thấy hai khung chờ khác nhau nối
 * tiếp.
 */
export function CartSkeleton({ label }: { label?: string }) {
  return (
    <div className="grid gap-8 md:grid-cols-12" aria-busy="true" aria-label={label}>
      <div className="min-w-0 md:col-span-8">
        <div className="divide-y divide-border border-y border-border">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-5 md:grid-cols-[130px_minmax(0,1fr)_auto_auto] md:items-center"
            >
              <SkelBlock className="h-20 w-20 md:h-32.5 md:w-32.5" w={null} h={null} />
              <div className="flex min-w-0 flex-col gap-2 pr-12 md:pr-0">
                <SkelText w="75%" h="1.1em" />
                <SkelText w="35%" />
                <SkelText w="50%" />
              </div>
              <div className="col-start-2 md:col-start-auto">
                <SkelBlock w={120} h={44} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <SkelBlock w={190} h={44} />
        </div>
      </div>

      <div className="md:col-span-4">
        <div className="border border-border p-5">
          <SkelTitle w="60%" h="1.4em" />
          <div className="mt-5 flex flex-col gap-3">
            <SkelText w="100%" />
            <SkelText w="100%" />
            <SkelText w="70%" />
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <SkelTitle w="55%" h="1.4em" />
          </div>
          <div className="mt-5">
            <SkelBlock w="100%" h={52} />
          </div>
        </div>
      </div>
    </div>
  );
}
