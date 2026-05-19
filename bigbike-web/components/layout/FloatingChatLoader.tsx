import { listPublicSettings } from "@/lib/api/public-api";
import { FloatingChat } from "@/components/home/FloatingChat";
import { pickSetting } from "@/lib/utils/settings";

export async function FloatingChatLoader() {
  const settingsResult = await listPublicSettings();
  const settings = settingsResult.data ?? [];

  const hotline = pickSetting(settings, ["hotline", "phone", "contact_phone"]);
  const zaloUrl = pickSetting(settings, ["zalo_url", "zalo"]);
  const messengerUrl = pickSetting(settings, ["messenger_url", "messenger"]);

  if (!hotline && !zaloUrl && !messengerUrl) return null;

  return (
    <FloatingChat
      hotline={hotline || undefined}
      zaloUrl={zaloUrl || undefined}
      messengerUrl={messengerUrl || undefined}
    />
  );
}
