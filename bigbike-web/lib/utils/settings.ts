export type SettingEntry = { settingKey: string; settingValue: string };

/** Look up the first setting whose key exactly matches one of the given keys (in order). */
export function pickSetting(
  settings: SettingEntry[] | undefined,
  keys: string[],
): string {
  if (!settings) return "";
  for (const key of keys) {
    const v = settings.find((s) => s.settingKey === key)?.settingValue?.trim();
    if (v) return v;
  }
  return "";
}

/** Look up the first setting whose key matches any of the given regular expressions. */
export function pickSettingByPattern(
  settings: SettingEntry[] | undefined,
  patterns: RegExp[],
): string {
  if (!settings) return "";
  const match = settings.find((s) => patterns.some((p) => p.test(s.settingKey)));
  return match?.settingValue?.trim() ?? "";
}
