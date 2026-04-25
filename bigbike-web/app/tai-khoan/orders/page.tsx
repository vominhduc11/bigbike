import { permanentRedirect } from "next/navigation";

export default function LegacyAccountOrdersRedirect() {
  permanentRedirect("/tai-khoan/don-hang/");
}
