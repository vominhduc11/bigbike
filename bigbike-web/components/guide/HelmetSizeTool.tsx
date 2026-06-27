"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type HelmetSizeToolProps = {
  locale: string;
};

const SIZES = [
  {
    size: "XS",
    min: 53,
    max: 54.9,
    brands: ["AGV", "Caberg", "ILM", "NIC", "LS2"],
    tipVi: "Size nhỏ nhất — vỏ ngoài (shell) XS–M. Phù hợp nữ và nam vóc nhỏ. Nếu đầu tròn đều thì XS vừa tốt.",
    tipEn: "Smallest size — shell XS-M. Suitable for women and small-framed men. If head shape is round, XS is a good fit.",
  },
  {
    size: "S",
    min: 55,
    max: 56.9,
    brands: ["AGV", "Caberg", "ILM", "NIC", "LS2"],
    tipVi: "Phổ biến với nữ và nam đầu nhỏ. Vỏ ngoài nhỏ (shell XS–M) — nhẹ hơn vỏ lớn.",
    tipEn: "Popular with women and men with small heads. Small shell (XS-M) — lighter than larger shell.",
  },
  {
    size: "M",
    min: 57,
    max: 58.9,
    brands: ["AGV", "Caberg", "ILM", "NIC", "LS2"],
    tipVi: "Size phổ biến nhất tại Việt Nam. Vỏ ngoài nhỏ (shell XS–M). Nếu đầu hơi dài theo chiều trước–sau nên thử tại shop.",
    tipEn: "Most popular size in Vietnam. Small shell (XS-M). If head is slightly oval, we recommend fitting in-store.",
  },
  {
    size: "L",
    min: 59,
    max: 60.9,
    brands: ["AGV", "Caberg", "ILM", "NIC", "LS2"],
    tipVi: "Chuyển sang vỏ ngoài lớn (shell L–XXL) — nặng hơn một chút so với XS–M. Nên thử cả M và L nếu số đo nằm ở 58–59cm.",
    tipEn: "Upgraded to large shell (L-XXL) — slightly heavier than XS-M. Try both M and L if your size is between 58-59cm.",
  },
  {
    size: "XL",
    min: 61,
    max: 62.9,
    brands: ["AGV", "Caberg", "ILM", "NIC", "LS2"],
    tipVi: "Vỏ ngoài lớn (shell L–XXL). Nếu thường xuyên đi tour xa, vỏ ngoài lớn thoải mái hơn khi đội lâu.",
    tipEn: "Large shell (L-XXL). If you tour frequently, a larger shell provides more comfort for long rides.",
  },
  {
    size: "XXL",
    min: 63,
    max: 64.9,
    brands: ["AGV", "Caberg", "ILM", "LS2"],
    tipVi: "Vỏ ngoài lớn (shell L–XXL). NIC hiện chưa có XXL — liên hệ BigBike để xác nhận.",
    tipEn: "Large shell (L-XXL). NIC does not have XXL yet — contact BigBike to verify.",
  },
];

export default function HelmetSizeTool({ locale }: HelmetSizeToolProps) {
  const isEn = locale === "en";
  const [headVal, setHeadVal] = useState("");
  const [result, setResult] = useState<{
    size: string;
    rangeText: string;
    brands: string[];
    tip: string;
    isBorder: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCalc = () => {
    setErrorMsg("");
    setResult(null);

    const val = parseFloat(headVal);
    if (!val || isNaN(val)) {
      setErrorMsg(isEn ? "Please enter your head circumference (cm)." : "Vui lòng nhập số đo vòng đầu (cm).");
      return;
    }

    if (val < 48 || val > 70) {
      const zaloContact = "0764" + "640" + "679";
      setErrorMsg(
        isEn
          ? `Measurement ${val}cm is out of range. Contact BigBike via Zalo ${zaloContact} for direct consultation.`
          : `Số đo ${val}cm ngoài phạm vi bảng size. Liên hệ BigBike qua Zalo ${zaloContact} để được tư vấn trực tiếp.`
      );
      return;
    }

    let matched = null;
    let isBorder = false;

    // Find direct match
    for (let i = 0; i < SIZES.length; i++) {
      if (val >= SIZES[i].min && val <= SIZES[i].max) {
        matched = SIZES[i];
        if (val >= SIZES[i].max - 0.4) {
          isBorder = true;
        }
        break;
      }
    }

    // Between sizes (e.g. 56.5 -> rounds up to S, border warning)
    if (!matched) {
      for (let j = 0; j < SIZES.length - 1; j++) {
        if (val > SIZES[j].max && val < SIZES[j + 1].min) {
          matched = SIZES[j + 1];
          isBorder = true;
          break;
        }
      }
    }

    // Fallback for extreme cases
    if (!matched) {
      matched = SIZES[SIZES.length - 1];
      isBorder = true;
    }

    setResult({
      size: matched.size,
      rangeText: `${matched.min}–${matched.max.toFixed(0)}cm · ${isEn ? "Your measurement" : "Số đo của bạn"}: ${val}cm`,
      brands: matched.brands,
      tip: isEn ? matched.tipEn : matched.tipVi,
      isBorder,
    });
  };

  const handleReset = () => {
    setHeadVal("");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <div className="mb-8 border border-neutral-200 bg-white p-6 max-w-xl">
      <h3 className="m-0 mb-2 font-cta text-ui-20 font-bold uppercase tracking-wide text-brand">
        {isEn ? "Helmet Size Calculator" : "Công cụ tính size mũ bảo hiểm"}
      </h3>
      <p className="m-0 mb-6 text-ui-14 text-neutral-500 leading-relaxed">
        {isEn
          ? "Enter your head circumference to find the best fit across the brands we offer."
          : "Nhập vòng đầu để biết ngay size phù hợp với các thương hiệu BigBike đang bán."}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end mb-6">
        <div className="flex-1 min-w-0">
          <label htmlFor="head-input" className="block text-ui-14 text-neutral-500 mb-2 font-cta uppercase tracking-wide">
            {isEn ? "Your head size (cm)" : "Vòng đầu của bạn (cm)"}
          </label>
          <div className="relative flex items-center">
            <Input
              id="head-input"
              type="number"
              value={headVal}
              onChange={(e) => setHeadVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCalc()}
              placeholder="e.g. 57"
              min="48"
              max="70"
              inputMode="numeric"
              className="pr-12 text-ui-18 font-body font-normal"
            />
            <span className="absolute right-4 text-ui-14 text-neutral-500 select-none">cm</span>
          </div>
        </div>
        <Button
          onClick={handleCalc}
          variant="primary"
          size="md"
          className="h-12"
        >
          {isEn ? "Calculate" : "Xem size"}
        </Button>
      </div>

      {errorMsg && (
        <div className="border border-brand bg-brand-soft/10 border-l-4 border-l-brand p-4 text-ui-14 text-brand mb-4 font-body leading-relaxed">
          {errorMsg}
        </div>
      )}

      {result && (
        <div className="border border-neutral-200 p-5 bg-neutral-50">
          <div className="font-cta text-display font-bold text-brand leading-none mb-1">
            {result.size}
          </div>
          <div className="text-ui-14 text-neutral-500 mb-4 font-body">
            {result.rangeText}
          </div>

          <div className="text-ui-14 font-bold uppercase tracking-wide text-neutral-900 mb-2 font-cta">
            {isEn ? "Suitable Brands" : "Phù hợp với thương hiệu"}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {result.brands.map((brand) => (
              <span key={brand} className="border border-neutral-300 bg-white px-3 py-1 text-ui-14 text-neutral-900 font-body">
                {brand}
              </span>
            ))}
          </div>

          <div className="border-l-3 border-brand pl-4 py-1 text-ui-14 text-neutral-700 leading-relaxed font-body">
            <p className="m-0">{result.tip}</p>
            {result.isBorder && (
              <p className="m-0 mt-2 text-brand font-bold">
                {isEn
                  ? `Your measurement is close to the size boundary — we recommend size ${result.size} or trying it in-store before purchasing.`
                  : `Số đo nằm gần ranh giới — nên lấy ${result.size} hoặc ghé shop thử trực tiếp trước khi đặt.`}
              </p>
            )}
          </div>
        </div>
      )}

      {(result || errorMsg) && (
        <button
          onClick={handleReset}
          className="mt-4 text-ui-14 text-neutral-500 hover:text-neutral-900 underline font-body bg-transparent border-none p-0 cursor-pointer"
        >
          {isEn ? "← Enter again" : "← Nhập lại"}
        </button>
      )}
    </div>
  );
}
