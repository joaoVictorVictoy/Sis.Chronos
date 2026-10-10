import { createAdminClient } from "@/lib/supabase/admin";

export type AuditLogEntry = {
  id: string;
  action: string;
  tenantName: string;
  tenantId?: string;
  superAdminEmail: string;
  details: string;
  timestamp: string;
};

const AUDIT_TAG = "[SYS_AUDIT_LOGS]";

/**
 * Registra um evento de auditoria no log permanente do Super Admin.
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
  try {
    const admin = createAdminClient();
    const table = (admin as any).from("system_announcements");

    const { data: record } = await table
      .select("id, message")
      .eq("title", AUDIT_TAG)
      .limit(1)
      .maybeSingle();

    let existingLogs: AuditLogEntry[] = [];
    if (record?.message) {
      try {
        existingLogs = JSON.parse(record.message);
      } catch {
        existingLogs = [];
      }
    }

    const newEntry: AuditLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Mantém os últimos 150 eventos para performance
    const updatedLogs = [newEntry, ...existingLogs].slice(0, 150);

    if (record?.id) {
      await table
        .update({
          message: JSON.stringify(updatedLogs),
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);
    } else {
      await table.insert({
        title: AUDIT_TAG,
        message: JSON.stringify(updatedLogs),
        type: "info",
        is_active: false,
      });
    }
  } catch (err) {
    // Falha em log não deve travar a ação do usuário
    console.error("Falha ao salvar audit log:", err);
  }
}

/**
 * Recupera os eventos recentes de auditoria do sistema.
 */
export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const admin = createAdminClient();
    const table = (admin as any).from("system_announcements");

    const { data: record } = await table
      .select("message")
      .eq("title", AUDIT_TAG)
      .limit(1)
      .maybeSingle();

    if (!record?.message) return [];
    return JSON.parse(record.message) as AuditLogEntry[];
  } catch {
    return [];
  }
}
