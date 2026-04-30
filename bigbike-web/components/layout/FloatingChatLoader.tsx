import { listPublicSettings } from "@/lib/api/public-api";
import { FloatingChat } from "@/components/home/FloatingChat";

function pickSetting(
  settings: Array<{ settingKey: string; settingValue: string }>,
  keys: string[],
): string {
  for (const key of keys) {
    const found = settings.find((s) => s.settingKey === key);
    if (found && found.settingValue.trim().length > 0) {
      return found.settingValue.trim();
    }
  }
  return "";
}

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
