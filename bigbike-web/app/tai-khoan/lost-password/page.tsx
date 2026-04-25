import { permanentRedirect } from "next/navigation";

export default function LegacyLostPasswordRedirect() {
  permanentRedirect("/quen-mat-khau/");
}
