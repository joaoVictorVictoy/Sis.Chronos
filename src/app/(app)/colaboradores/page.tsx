import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NewEmployeeForm, EmployeesTable, type EmployeeRow } from "./employees-client";
import { EmployeeLeavesManager } from "./employee-leaves-manager";
import type { LeaveRecord } from "../minhas-analises/leaves-dialog";

export const metadata = { title: "Colaboradores | Apontamento" };

export default async function EmployeesPage() {
  const { tenant, profile } = await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const [{ data: employeesData }, { data: leavesData }] = await Promise.all([
    supabase
      .from("employees")
      .select("*, employee_costs(hourly_cost, valid_from, valid_to, monthly_hours)")
      .order("full_name"),
    supabase
      .from("employee_leaves")
      .select("id, start_date, end_date, type, notes, employee_id")
      .order("start_date", { ascending: false }),
  ]);

  const employees = (employeesData ?? []) as EmployeeRow[];
  const leaves = (leavesData ?? []) as LeaveRecord[];
  const canSeeCosts = profile.role === "admin" || profile.can_view_costs;

  // Filtra apenas colaboradores ativos para a gestão de férias
  const activeEmployees = employees.filter((e) => e.active !== false);
  const activeEmployeeIds = new Set(activeEmployees.map((e) => e.id));
  const activeLeaves = leaves.filter((l) => !l.employee_id || activeEmployeeIds.has(l.employee_id));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Colaboradores"
        description="Quem aponta horas. O custo hora vigente é usado para calcular a rentabilidade dos contratos."
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo colaborador</CardTitle>
          <CardDescription>
            Cadastre a pessoa e depois defina áreas, custo e acesso ao sistema na página dela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewEmployeeForm defaultMonthlyHours={Number(tenant.monthly_hours)} />
        </CardContent>
      </Card>

      <Card>
        <EmployeesTable
          employees={employees}
          canSeeCosts={canSeeCosts}
          tenantMonthlyHours={tenant.monthly_hours}
        />
      </Card>

      <EmployeeLeavesManager
        employees={activeEmployees.map((e) => ({
          id: e.id,
          full_name: e.full_name,
          active: e.active,
        }))}
        leaves={activeLeaves}
      />
    </div>
  );
}
