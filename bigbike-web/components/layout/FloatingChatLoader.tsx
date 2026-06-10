import { listPublicSettings } from "@/lib/api/public-api";
import { FloatingChat } from "@/components/home/FloatingChat";
import { pickSetting } from "@/lib/utils/settings";

export async function FloatingChatLoader() {
  const settingsResult = await listPublicSettings();
  const settings = settingsResult.data ?? [];

  const hotline = pickSetting(settings, ["hotline", "phone", "contact_phone"]);
  const zaloUrl = pickSetting(settings, ["zalo_url", "zalo"]);
  const messengerUrl = pickSetting(settings, ["messenger_url", "messenger"]);
  // Display text shown in the popup; falls back to the URL slug when unset.
  const zaloDisplay = pickSetting(settings, ["zalo_display"]);
  const messengerDisplay = pickSetting(settings, ["messenger_display"]);

  if (!hotline && !zaloUrl && !messengerUrl) return null;

  return (
    <FloatingChat
      hotline={hotline || undefined}
      zaloUrl={zaloUrl || undefined}
      messengerUrl={messengerUrl || undefined}
      zaloDisplay={zaloDisplay || undefined}
      messengerDisplay={messengerDisplay || undefined}
    />
  );
}
