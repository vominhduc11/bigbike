"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ClothingSizeToolProps = {
  locale: string;
};

const AO_SIZES = [
  { s: "S", ngucMin: 86, ngucMax: 90, eoMin: 72, eoMax: 76, noteVi: "Nam / nữ vóc nhỏ", noteEn: "Petite men/women" },
  { s: "M", ngucMin: 91, ngucMax: 96, eoMin: 77, eoMax: 82, noteVi: "Nam trung bình", noteEn: "Average men" },
  { s: "L", ngucMin: 97, ngucMax: 102, eoMin: 83, eoMax: 88, noteVi: "Nam to con", noteEn: "Large men" },
  { s: "XL", ngucMin: 103, ngucMax: 108, eoMin: 89, eoMax: 94, noteVi: "Nam to lớn", noteEn: "Very large men" },
  { s: "XXL", ngucMin: 109, ngucMax: 114, eoMin: 95, eoMax: 100, noteVi: "Đặc biệt", noteEn: "Special size" },
  { s: "XXXL", ngucMin: 115, ngucMax: 999, eoMin: 101, eoMax: 999, noteVi: "Đặc biệt — xác nhận với BigBike", noteEn: "Special size — confirm with BigBike" },
];

const QUAN_SIZES = [
  { s: "S", hongMin: 82, hongMax: 86, duiMin: 50, duiMax: 54 },
  { s: "M", hongMin: 87, hongMax: 92, duiMin: 55, duiMax: 59 },
  { s: "L", hongMin: 93, hongMax: 98, duiMin: 60, duiMax: 64 },
  { s: "XL", hongMin: 99, hongMax: 104, duiMin: 65, duiMax: 69 },
  { s: "XXL", hongMin: 105, hongMax: 110, duiMin: 70, duiMax: 74 },
  { s: "XXXL", hongMin: 111, hongMax: 999, duiMin: 75, duiMax: 999 },
];

const GANG_SIZES = [
  { s: "S", min: 17, max: 18.9, noteVi: "Tay nhỏ, nữ", noteEn: "Small hand, women" },
  { s: "M", min: 19, max: 20.9, noteVi: "Nam trung bình", noteEn: "Average men" },
  { s: "L", min: 21, max: 22.9, noteVi: "Nam tay lớn", noteEn: "Large hand, men" },
  { s: "XL", min: 23, max: 24.9, noteVi: "Nam tay rất lớn", noteEn: "Very large hand, men" },
  { s: "XXL", min: 25, max: 99, noteVi: "Đặc biệt", noteEn: "Special size" },
];

const GIAY_SIZES = [
  { eu: "38", min: 240, max: 245, vn: "37–38" },
  { eu: "39", min: 246, max: 251, vn: "38–39" },
  { eu: "40", min: 252, max: 257, vn: "39–40" },
  { eu: "41", min: 258, max: 263, vn: "40–41" },
  { eu: "42", min: 264, max: 269, vn: "41–42" },
  { eu: "43", min: 270, max: 275, vn: "42–43" },
  { eu: "44", min: 276, max: 281, vn: "43–44" },
  { eu: "45", min: 282, max: 999, vn: "44+" },
];

type TabType = "ao" | "quan" | "gang" | "giay";

export default function ClothingSizeTool({ locale }: ClothingSizeToolProps) {
  const isEn = locale === "en";
  const [activeTab, setActiveTab] = useState<TabType>("ao");

  // Input states
  const [aoNguc, setAoNguc] = useState("");
  const [aoEo, setAoEo] = useState("");
  const [quanHong, setQuanHong] = useState("");
  const [quanDui, setQuanDui] = useState("");
  const [gangTay, setGangTay] = useState("");
  const [giayMm, setGiayMm] = useState("");

  // Result states
  const [aoResult, setAoResult] = useState<{ size: string; basis: string; note: string; border: boolean } | null>(null);
  const [quanResult, setQuanResult] = useState<{ size: string; basis: string; border: boolean } | null>(null);
  const [gangResult, setGangResult] = useState<{ size: string; basis: string; note: string; border: boolean } | null>(null);
  const [giayResult, setGiayResult] = useState<{ eu: string; basis: string; suggest: string; border: boolean } | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearResults = (tab: TabType) => {
    setErrors((prev) => ({ ...prev, [tab]: "" }));
    if (tab === "ao") setAoResult(null);
    if (tab === "quan") setQuanResult(null);
    if (tab === "gang") setGangResult(null);
    if (tab === "giay") setGiayResult(null);
  };

  const resetFields = (tab: TabType) => {
    clearResults(tab);
    if (tab === "ao") {
      setAoNguc("");
      setAoEo("");
    }
    if (tab === "quan") {
      setQuanHong("");
      setQuanDui("");
    }
    if (tab === "gang") setGangTay("");
    if (tab === "giay") setGiayMm("");
  };

  const isBorder = (val: number, max: number) => val >= max - 0.9;

  // Calculate Áo giáp
  const calcAo = () => {
    clearResults("ao");
    const nguc = parseFloat(aoNguc);
    const eo = parseFloat(aoEo);

    if (isNaN(nguc) && isNaN(eo)) {
      setErrors((prev) => ({ ...prev, ao: isEn ? "Please enter at least one measurement." : "Vui lòng nhập ít nhất 1 số đo." }));
      return;
    }

    let matchedByNguc = null;
    let matchedByEo = null;

    if (!isNaN(nguc)) {
      for (let i = 0; i < AO_SIZES.length; i++) {
        if (nguc >= AO_SIZES[i].ngucMin && nguc <= AO_SIZES[i].ngucMax) {
          matchedByNguc = AO_SIZES[i];
          break;
        }
      }
      if (!matchedByNguc && nguc > 115) matchedByNguc = AO_SIZES[AO_SIZES.length - 1];
    }

    if (!isNaN(eo)) {
      for (let j = 0; j < AO_SIZES.length; j++) {
        if (eo >= AO_SIZES[j].eoMin && eo <= AO_SIZES[j].eoMax) {
          matchedByEo = AO_SIZES[j];
          break;
        }
      }
      if (!matchedByEo && eo > 101) matchedByEo = AO_SIZES[AO_SIZES.length - 1];
    }

    let final = null;
    let basis = "";

    if (matchedByNguc && matchedByEo) {
      const ni = AO_SIZES.indexOf(matchedByNguc);
      const ei = AO_SIZES.indexOf(matchedByEo);
      final = AO_SIZES[Math.max(ni, ei)];
      basis =
        ni === ei
          ? isEn
            ? "Both chest and waist fit perfectly"
            : "Cả ngực và eo đều khớp"
          : ni > ei
          ? isEn
            ? "Based on chest size (larger of the two)"
            : "Dựa theo vòng ngực (số lớn hơn)"
          : isEn
          ? "Based on waist size (larger of the two)"
          : "Dựa theo vòng eo (số lớn hơn)";
    } else {
      final = matchedByNguc || matchedByEo;
      basis = matchedByNguc
        ? isEn
          ? "Based on chest size"
          : "Dựa theo vòng ngực"
        : isEn
        ? "Based on waist size"
          : "Dựa theo vòng eo";
    }

    if (!final) {
      setErrors((prev) => ({ ...prev, ao: isEn ? "Measurement out of reference size chart." : "Số đo ngoài phạm vi bảng size." }));
      return;
    }

    const border =
      (!isNaN(nguc) && isBorder(nguc, matchedByNguc ? matchedByNguc.ngucMax : 999)) ||
      (!isNaN(eo) && isBorder(eo, matchedByEo ? matchedByEo.eoMax : 999));

    setAoResult({
      size: final.s,
      basis,
      note: isEn ? final.noteEn : final.noteVi,
      border,
    });
  };

  // Calculate Quần giáp
  const calcQuan = () => {
    clearResults("quan");
    const hong = parseFloat(quanHong);
    const dui = parseFloat(quanDui);

    if (isNaN(hong) && isNaN(dui)) {
      setErrors((prev) => ({ ...prev, quan: isEn ? "Please enter at least one measurement." : "Vui lòng nhập ít nhất 1 số đo." }));
      return;
    }

    let mH = null;
    let mD = null;

    if (!isNaN(hong)) {
      for (let i = 0; i < QUAN_SIZES.length; i++) {
        if (hong >= QUAN_SIZES[i].hongMin && hong <= QUAN_SIZES[i].hongMax) {
          mH = QUAN_SIZES[i];
          break;
        }
      }
      if (!mH && hong > 111) mH = QUAN_SIZES[QUAN_SIZES.length - 1];
    }

    if (!isNaN(dui)) {
      for (let j = 0; j < QUAN_SIZES.length; j++) {
        if (dui >= QUAN_SIZES[j].duiMin && dui <= QUAN_SIZES[j].duiMax) {
          mD = QUAN_SIZES[j];
          break;
        }
      }
      if (!mD && dui > 75) mD = QUAN_SIZES[QUAN_SIZES.length - 1];
    }

    let final = null;
    let basis = "";

    if (mH && mD) {
      const hi = QUAN_SIZES.indexOf(mH);
      const di = QUAN_SIZES.indexOf(mD);
      final = QUAN_SIZES[Math.max(hi, di)];
      basis =
        hi === di
          ? isEn
            ? "Both hips and thighs fit perfectly"
            : "Cả hông và đùi đều khớp"
          : hi > di
          ? isEn
            ? "Based on hips size (larger of the two)"
            : "Dựa theo vòng hông (số lớn hơn)"
          : isEn
          ? "Based on thighs size (larger of the two)"
          : "Dựa theo vòng đùi (số lớn hơn)";
    } else {
      final = mH || mD;
      basis = mH
        ? isEn
          ? "Based on hips size"
          : "Dựa theo vòng hông"
        : isEn
        ? "Based on thighs size"
          : "Dựa theo vòng đùi";
    }

    if (!final) {
      setErrors((prev) => ({ ...prev, quan: isEn ? "Measurement out of reference size chart." : "Số đo ngoài phạm vi bảng size." }));
      return;
    }

    const border =
      (!isNaN(hong) && isBorder(hong, mH ? mH.hongMax : 999)) ||
      (!isNaN(dui) && isBorder(dui, mD ? mD.duiMax : 999));

    setQuanResult({
      size: final.s,
      basis,
      border,
    });
  };

  // Calculate Găng tay
  const calcGang = () => {
    clearResults("gang");
    const v = parseFloat(gangTay);

    if (isNaN(v)) {
      setErrors((prev) => ({ ...prev, gang: isEn ? "Please enter your hand size." : "Vui lòng nhập số đo." }));
      return;
    }

    let matched = null;
    for (let i = 0; i < GANG_SIZES.length; i++) {
      if (v >= GANG_SIZES[i].min && v <= GANG_SIZES[i].max) {
        matched = GANG_SIZES[i];
        break;
      }
    }

    if (!matched) {
      setErrors((prev) => ({
        ...prev,
        gang: isEn
          ? `Measurement ${v}cm is out of reference size chart.`
          : `Số đo ${v}cm ngoài phạm vi bảng size.`,
      }));
      return;
    }

    const border = isBorder(v, matched.max);

    setGangResult({
      size: matched.s,
      basis: isEn
        ? `Hand circumference: ${v}cm · Range: ${matched.min}–${matched.max.toFixed(0)}cm`
        : `Vòng bàn tay: ${v}cm · Khung: ${matched.min}–${matched.max.toFixed(0)}cm`,
      note: isEn ? matched.noteEn : matched.noteVi,
      border,
    });
  };

  // Calculate Giày
  const calcGiay = () => {
    clearResults("giay");
    const v = parseFloat(giayMm);

    if (isNaN(v)) {
      setErrors((prev) => ({ ...prev, giay: isEn ? "Please enter your foot size." : "Vui lòng nhập số đo." }));
      return;
    }

    let matched = null;
    for (let i = 0; i < GIAY_SIZES.length; i++) {
      if (v >= GIAY_SIZES[i].min && v <= GIAY_SIZES[i].max) {
        matched = GIAY_SIZES[i];
        break;
      }
    }

    if (!matched) {
      setErrors((prev) => ({
        ...prev,
        giay: isEn
          ? `Measurement ${v}mm is out of reference size chart.`
          : `Số đo ${v}mm ngoài phạm vi bảng size.`,
      }));
      return;
    }

    const border = isBorder(v, matched.max);
    const euNum = parseInt(matched.eu);
    const bootSuggest = isEn
      ? `EU ${euNum} or ${euNum + 1} (riding boots should be roomier)`
      : `EU ${euNum} hoặc ${euNum + 1} (giày bảo hộ nên rộng hơn giày thường)`;

    setGiayResult({
      eu: matched.eu,
      basis: isEn
        ? `Foot length: ${v}mm · Equivalent VN size: ${matched.vn}`
        : `Bàn chân: ${v}mm · Size VN tương đương: ${matched.vn}`,
      suggest: bootSuggest,
      border,
    });
  };

  return (
    <div className="mb-8 border border-border bg-white p-6 max-w-xl">
      <h3 className="m-0 mb-2 font-cta text-a3-section font-bold uppercase tracking-wide text-brand">
        {isEn ? "Apparel Size Calculator" : "Công cụ tính size trang phục bảo hộ"}
      </h3>
      <p className="m-0 mb-6 text-a5-meta text-muted-foreground leading-relaxed">
        {isEn
          ? "Select the item type and enter your measurements to calculate your size."
          : "Nhập số đo để biết ngay size phù hợp. Đơn vị: cm (áo/quần/găng) hoặc mm (giày)."}
      </p>

      {/* Tabs list */}
      <div className="flex border-b border-border mb-6 overflow-x-auto gap-1">
        {(["ao", "quan", "gang", "giay"] as TabType[]).map((tab) => {
          const tabLabel = {
            ao: isEn ? "Jacket" : "Áo giáp",
            quan: isEn ? "Pants" : "Quần giáp",
            gang: isEn ? "Gloves" : "Găng tay",
            giay: isEn ? "Boots / Shoes" : "Giày",
          }[tab];

          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                clearResults(tab);
              }}
              className={`pb-3 px-4 font-cta text-b4-action font-bold uppercase tracking-wide cursor-pointer transition-all duration-[var(--bb-duration-fast)] ${
                isActive
                  ? "text-brand border-b-2 border-brand"
                  : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
              }`}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* Áo giáp Tab */}
      {activeTab === "ao" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="ao-nguc" className="block text-a5-meta text-muted-foreground mb-1 font-cta uppercase tracking-wide">
                {isEn ? "Chest circumference (cm)" : "Vòng ngực (cm)"}
              </label>
              <Input
                id="ao-nguc"
                type="number"
                value={aoNguc}
                onChange={(e) => setAoNguc(e.target.value)}
                placeholder="e.g. 92"
                inputMode="numeric"
              />
              <p className="m-0 mt-1 text-b5-label text-muted-foreground">
                {isEn ? "Widest part, breathe normally" : "Qua phần rộng nhất, thở bình thường"}
              </p>
            </div>
            <div>
              <label htmlFor="ao-eo" className="block text-a5-meta text-muted-foreground mb-1 font-cta uppercase tracking-wide">
                {isEn ? "Waist circumference (cm)" : "Vòng eo (cm)"}
              </label>
              <Input
                id="ao-eo"
                type="number"
                value={aoEo}
                onChange={(e) => setAoEo(e.target.value)}
                placeholder="e.g. 78"
                inputMode="numeric"
              />
              <p className="m-0 mt-1 text-b5-label text-muted-foreground">
                {isEn ? "Narrowest part, 2-3cm above navel" : "Phần nhỏ nhất, trên rốn 2–3cm"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            <Button onClick={calcAo} variant="primary" size="md">
              {isEn ? "Calculate" : "Xem size"}
            </Button>
            <Button onClick={() => resetFields("ao")} variant="secondary" size="md">
              {isEn ? "Clear" : "Xóa"}
            </Button>
          </div>

          {errors.ao && (
            <div className="border border-brand bg-brand-soft/10 border-l-4 border-l-brand p-4 text-a5-meta text-brand mb-4 font-body">
              {errors.ao}
            </div>
          )}

          {aoResult && (
            <div className="border border-border p-5 bg-muted">
              <div className="font-cta text-b1-display font-bold text-brand leading-none mb-1">
                {aoResult.size}
              </div>
              <div className="text-a5-meta text-muted-foreground mb-4 font-body">
                {aoResult.basis}
              </div>
              <div className="text-a5-meta font-bold uppercase tracking-wide text-foreground mb-2 font-cta">
                {aoResult.note}
              </div>
              <div className="border-l-3 border-brand pl-4 py-1 text-a5-meta text-foreground leading-relaxed font-body">
                <p className="m-0">
                  {isEn
                    ? "Komine and Taichi are usually 1 size smaller than European sizing — consider trying one size up if purchasing these brands."
                    : "Komine và Taichi thường nhỏ hơn 1 bậc so với size EU — nếu mua hãng này nên thử thêm size lớn hơn một bậc."}
                </p>
                {aoResult.border && (
                  <p className="m-0 mt-2 text-brand font-bold">
                    {isEn
                      ? "Measurement is close to boundary — we recommend fitting in-store or contacting BigBike."
                      : "Số đo gần ranh giới — nên thử tại shop hoặc liên hệ BigBike để tư vấn."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quần giáp Tab */}
      {activeTab === "quan" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="quan-hong" className="block text-a5-meta text-muted-foreground mb-1 font-cta uppercase tracking-wide">
                {isEn ? "Hip circumference (cm)" : "Vòng hông (cm)"}
              </label>
              <Input
                id="quan-hong"
                type="number"
                value={quanHong}
                onChange={(e) => setQuanHong(e.target.value)}
                placeholder="e.g. 92"
                inputMode="numeric"
              />
              <p className="m-0 mt-1 text-b5-label text-muted-foreground">
                {isEn ? "Widest part of hips + buttocks" : "Qua phần rộng nhất của hông + mông"}
              </p>
            </div>
            <div>
              <label htmlFor="quan-dui" className="block text-a5-meta text-muted-foreground mb-1 font-cta uppercase tracking-wide">
                {isEn ? "Thigh circumference (cm)" : "Vòng đùi (cm)"}
              </label>
              <Input
                id="quan-dui"
                type="number"
                value={quanDui}
                onChange={(e) => setQuanDui(e.target.value)}
                placeholder="e.g. 58"
                inputMode="numeric"
              />
              <p className="m-0 mt-1 text-b5-label text-muted-foreground">
                {isEn ? "Thickest part of thigh, below groin" : "Phần to nhất của đùi, ngay dưới bẹn"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            <Button onClick={calcQuan} variant="primary" size="md">
              {isEn ? "Calculate" : "Xem size"}
            </Button>
            <Button onClick={() => resetFields("quan")} variant="secondary" size="md">
              {isEn ? "Clear" : "Xóa"}
            </Button>
          </div>

          {errors.quan && (
            <div className="border border-brand bg-brand-soft/10 border-l-4 border-l-brand p-4 text-a5-meta text-brand mb-4 font-body">
              {errors.quan}
            </div>
          )}

          {quanResult && (
            <div className="border border-border p-5 bg-muted">
              <div className="font-cta text-b1-display font-bold text-brand leading-none mb-1">
                {quanResult.size}
              </div>
              <div className="text-a5-meta text-muted-foreground mb-4 font-body">
                {quanResult.basis}
              </div>
              <div className="text-a5-meta font-bold uppercase tracking-wide text-foreground mb-2 font-cta">
                {isEn ? "RIDING PANTS" : "QUẦN GIÁP BẢO HỘ"}
              </div>
              <div className="border-l-3 border-brand pl-4 py-1 text-a5-meta text-foreground leading-relaxed font-body">
                <p className="m-0">
                  {isEn
                    ? "When trying on: verify that knee armor sits properly when seated in a riding position. The armor should not slip down below the kneecap."
                    : "Khi mặc thử: kiểm tra giáp đầu gối đúng vị trí khi ngồi xuống tư thế lái xe. Giáp không được tụt xuống khỏi đầu gối."}
                </p>
                {quanResult.border && (
                  <p className="m-0 mt-2 text-brand font-bold">
                    {isEn
                      ? "Measurement is close to boundary — we recommend fitting in-store or contacting BigBike."
                      : "Số đo gần ranh giới — nên thử tại shop hoặc liên hệ BigBike để tư vấn."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Găng tay Tab */}
      {activeTab === "gang" && (
        <div>
          <div className="mb-6">
            <label htmlFor="gang-tay" className="block text-a5-meta text-muted-foreground mb-1 font-cta uppercase tracking-wide">
              {isEn ? "Hand circumference (cm)" : "Vòng bàn tay (cm)"}
            </label>
            <Input
              id="gang-tay"
              type="number"
              value={gangTay}
              onChange={(e) => setGangTay(e.target.value)}
              placeholder="e.g. 20"
              inputMode="numeric"
            />
            <p className="m-0 mt-1 text-b5-label text-muted-foreground">
              {isEn
                ? "Across knuckles of 4 fingers, excluding thumb, fingers naturally relaxed"
                : "Qua gốc 4 ngón, không tính ngón cái, bàn tay xòe tự nhiên"}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            <Button onClick={calcGang} variant="primary" size="md">
              {isEn ? "Calculate" : "Xem size"}
            </Button>
            <Button onClick={() => resetFields("gang")} variant="secondary" size="md">
              {isEn ? "Clear" : "Xóa"}
            </Button>
          </div>

          {errors.gang && (
            <div className="border border-brand bg-brand-soft/10 border-l-4 border-l-brand p-4 text-a5-meta text-brand mb-4 font-body">
              {errors.gang}
            </div>
          )}

          {gangResult && (
            <div className="border border-border p-5 bg-muted">
              <div className="font-cta text-b1-display font-bold text-brand leading-none mb-1">
                {gangResult.size}
              </div>
              <div className="text-a5-meta text-muted-foreground mb-4 font-body">
                {gangResult.basis}
              </div>
              <div className="text-a5-meta font-bold uppercase tracking-wide text-foreground mb-2 font-cta">
                {gangResult.note}
              </div>
              <div className="border-l-3 border-brand pl-4 py-1 text-a5-meta text-foreground leading-relaxed font-body">
                <p className="m-0">
                  {isEn
                    ? "Taichi and Komine are usually 1 size smaller than European sizing — consider taking one size larger than calculated above."
                    : "Taichi và Komine thường nhỏ hơn size EU 1 bậc — nếu mua hãng này, cân nhắc lấy size lớn hơn một bậc so với kết quả trên."}
                </p>
                {gangResult.border && (
                  <p className="m-0 mt-2 text-brand font-bold">
                    {isEn
                      ? "Measurement is close to boundary — we recommend fitting in-store or contacting BigBike."
                      : "Số đo gần ranh giới — nên thử tại shop hoặc liên hệ BigBike để tư vấn."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Giày Tab */}
      {activeTab === "giay" && (
        <div>
          <div className="mb-6">
            <label htmlFor="giay-mm" className="block text-a5-meta text-muted-foreground mb-1 font-cta uppercase tracking-wide">
              {isEn ? "Foot length (mm)" : "Chiều dài bàn chân (mm)"}
            </label>
            <Input
              id="giay-mm"
              type="number"
              value={giayMm}
              onChange={(e) => setGiayMm(e.target.value)}
              placeholder="e.g. 260"
              inputMode="numeric"
            />
            <p className="m-0 mt-1 text-b5-label text-muted-foreground">
              {isEn
                ? "From heel to longest toe. Measure both feet, use the larger value."
                : "Từ gót đến đầu ngón dài nhất. Đo cả 2 chân, lấy số lớn hơn."}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            <Button onClick={calcGiay} variant="primary" size="md">
              {isEn ? "Calculate" : "Xem size"}
            </Button>
            <Button onClick={() => resetFields("giay")} variant="secondary" size="md">
              {isEn ? "Clear" : "Xóa"}
            </Button>
          </div>

          {errors.giay && (
            <div className="border border-brand bg-brand-soft/10 border-l-4 border-l-brand p-4 text-a5-meta text-brand mb-4 font-body">
              {errors.giay}
            </div>
          )}

          {giayResult && (
            <div className="border border-border p-5 bg-muted">
              <div className="font-cta text-b1-display font-bold text-brand leading-none mb-1">
                EU {giayResult.eu}
              </div>
              <div className="text-a5-meta text-muted-foreground mb-3 font-body">
                {giayResult.basis}
              </div>
              <div className="text-a5-meta font-bold uppercase tracking-wide text-foreground mb-1 font-cta">
                {isEn ? "Suggested riding boot size" : "Gợi ý giày bảo hộ"}
              </div>
              <div className="text-a4-content font-bold text-brand mb-4 font-body">
                {giayResult.suggest}
              </div>
              <div className="border-l-3 border-brand pl-4 py-1 text-a5-meta text-foreground leading-relaxed font-body">
                <p className="m-0">
                  {isEn
                    ? "Riding boots should be 0.5–1 size larger than regular shoes to accommodate thick socks and allow ankle movement when braking."
                    : "Giày bảo hộ nên rộng hơn 0,5–1 size so với giày thường vì mang tất dày và cần không gian cho cổ chân khi phanh."}
                </p>
                {giayResult.border && (
                  <p className="m-0 mt-2 text-brand font-bold">
                    {isEn
                      ? `Close to boundary — consider taking EU ${parseInt(giayResult.eu) + 1} if feet are wide or using thick socks.`
                      : `Số đo gần ranh giới — nên chọn EU ${parseInt(giayResult.eu) + 1} nếu chân hơi rộng hoặc sẽ mang tất dày.`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
