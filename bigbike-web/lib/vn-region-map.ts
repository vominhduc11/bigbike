import { VN_PROVINCES } from "@/lib/vn-address-data";

const MB = new Set(["01","02","04","06","08","10","11","12","14","15","17","19","20","22","24","25","26","27","30","31","33","34","35","36","37"]);
const MT = new Set(["38","40","42","44","45","46","48","49","51","52","54","56","58","60","62","64","66","67","68"]);
const MN = new Set(["70","72","74","75","77","79","80","82","83","84","86","87","89","91","92","93","94","95","96"]);

const PROVINCE_TO_REGION: Record<string, string> = {};
for (const p of VN_PROVINCES) {
  if (MB.has(p.code)) PROVINCE_TO_REGION[p.name] = "MB";
  else if (MT.has(p.code)) PROVINCE_TO_REGION[p.name] = "MT";
  else if (MN.has(p.code)) PROVINCE_TO_REGION[p.name] = "MN";
}

export function getRegionForProvince(provinceName: string): string | null {
  return PROVINCE_TO_REGION[provinceName] ?? null;
}
