"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { HomeVideo } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { PlayIcon } from "./PlayIcon";

export function VideoCard({ video, onPlay, compact = false }: { video: HomeVideo; onPlay: () => void; compact?: boolean }) {
  const tA = useTranslations("A11y");
  // title = tiêu đề THẬT (rỗng nếu video chưa nhập tiêu đề) → footer để trống nhưng
  // vẫn giữ chiều cao, không in chữ "Video" placeholder gây mất chuyên nghiệp.
  // ariaTitle = giá trị dùng cho alt/aria-label, luôn có nội dung để đọc màn hình hiểu.
  const title = safeText(video.title, "");
  const ariaTitle = title || tA("watchVideoFallback");

  const thumbUrls: string[] = [];
  const custom = resolveMediaUrl(video.thumbnail?.url?.trim());
  if (custom) thumbUrls.push(custom);
  if (video.youtubeId) {
    thumbUrls.push(`https://img.youtube.com/vi/${video.youtubeId}/0.jpg`);
    thumbUrls.push(`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`);
  } else if (video.autoThumbnailUrl) {
    thumbUrls.push(video.autoThumbnailUrl);
  }

  const [thumbIdx, setThumbIdx] = useState(0);
  const thumbSrc = thumbIdx < thumbUrls.length ? thumbUrls[thumbIdx] : null;

  return (
    <button
      type="button"
      className="group block w-full cursor-pointer appearance-none bg-transparent p-0 text-left"
      onClick={onPlay}
      aria-label={tA("watchVideo", { title: ariaTitle })}
    >
      {/* Thumbnail — luôn 9:16. Trang chủ (full) để card lớn, có cap ở tablet;
          trang sản phẩm (compact) cap thấp hơn để khối video gọn, cân với tổng thể PDP. */}
      <div
        className={
          compact
            ? "relative w-full overflow-hidden bg-brand [aspect-ratio:9/16] max-[479px]:[max-height:240px] min-[480px]:[max-height:360px] min-[768px]:[max-height:300px] min-[1024px]:[max-height:340px]"
            : "relative w-full overflow-hidden bg-brand [aspect-ratio:9/16] max-[479px]:[max-height:72vw] min-[480px]:max-[1199px]:[max-height:260px]"
        }
      >
        {thumbSrc ? (
          <Image
            key={thumbSrc}
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, ariaTitle)}
            fill
            // !h-full thắng rule WP của trang chủ `body img{height:auto!important}`
            // Nếu bỏ kích thước này, ảnh fill bị ép height:auto và sụp xuống.
            className="!h-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 479px) calc(100vw - 30px), (max-width: 767px) 48vw, (max-width: 1199px) 32vw, 240px"
            onError={() => setThumbIdx((prev) => prev + 1)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-brand" aria-hidden="true">
            <span className="font-body text-a3-section font-bold text-white/80">
              BIGBIKE
            </span>
          </div>
        )}
        <PlayIcon />
        {/* Tên video đè lên góc dưới ảnh kèm lớp tối mờ (kiểu video grid chuẩn).
            Chỉ hiện khi có tiêu đề → video chưa đặt tên là ảnh sạch, không ô trống;
            mọi card vẫn cao bằng nhau vì khung ảnh cố định 9:16. */}
        {title && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-10 min-[600px]:px-4 min-[600px]:pb-4">
            <p className="m-0 overflow-hidden normal-case font-body text-a5-meta font-semibold leading-title text-white line-clamp-2">
              {title}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}
