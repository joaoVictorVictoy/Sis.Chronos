import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformSettings = {
  supportWhatsapp: string;
  supportEmail: string;
  defaultTrialDays: number;
  allowPublicSignup: boolean;
};

const SETTINGS_TAG = "[SYS_PLATFORM_SETTINGS]";

const DEFAULT_SETTINGS: PlatformSettings = {
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "",
  supportEmail: "suporte@sis-chronos.com.br",
  defaultTrialDays: 14,
  allowPublicSignup: true,
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const admin = createAdminClient();
    const table = (admin as any).from("system_announcements");

    const { data: record } = await table
      .select("message")
      .eq("title", SETTINGS_TAG)
      .limit(1)
      .maybeSingle();

    if (!record?.message) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(record.message);
    return {
      supportWhatsapp: parsed.supportWhatsapp ?? DEFAULT_SETTINGS.supportWhatsapp,
      supportEmail: parsed.supportEmail ?? DEFAULT_SETTINGS.supportEmail,
      defaultTrialDays: Number(parsed.defaultTrialDays) || DEFAULT_SETTINGS.defaultTrialDays,
      allowPublicSignup: parsed.allowPublicSignup ?? DEFAULT_SETTINGS.allowPublicSignup,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePlatformSettings(settings: Partial<PlatformSettings>): Promise<void> {
  const current = await getPlatformSettings();
  const updated: PlatformSettings = {
    ...current,
    ...settings,
  };

  const admin = createAdminClient();
  const table = (admin as any).from("system_announcements");

  const { data: record } = await table
    .select("id")
    .eq("title", SETTINGS_TAG)
    .limit(1)
    .maybeSingle();

  if (record?.id) {
    await table
      .update({
        message: JSON.stringify(updated),
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);
  } else {
    await table.insert({
      title: SETTINGS_TAG,
      message: JSON.stringify(updated),
      type: "info",
      is_active: false,
    });
  }
}
