import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ClockIcon, LockIcon, PlusIcon } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_STATUS_LABELS, PERIODICITY_LABELS, PERIODICITY_MONTHS, monthsBetween } from "@/lib/contracts";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import { ClientActivitiesSection, ClientAreasForm, ClientDetailsForm } from "../clients-client";
import { DeleteContractButton } from "@/app/(app)/contratos/delete-contract-button";
import { TerminateContractDialog } from "@/app/(app)/contratos/[id]/contract-termination";

export const metadata = { title: "Cliente | Apontamento" };

export default async function ClientPage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const { profile } = await requireRole(["admin", "gestor"]);
  const isAdmin = profile.role === "admin";
  const today = todayISO();
  const supabase = await createClient();

  const [{ data: client }, { data: areas }, { data: clientAreas }, { data: contracts }, { data: clientActivities }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("areas").select("id, name, active").order("name"),
      supabase.from("client_areas").select("area_id").eq("client_id", id),
      supabase.from("contracts").select("*").eq("client_id", id).order("start_date", { ascending: false }),
      supabase.from("activities").select("*, areas(name)").eq("client_id", id).order("name"),
    ]);

  if (!client) notFound();

  const activeContracts = ((contracts ?? []) as Tables<"contracts">[]).filter((c) => c.status === "ativo");
  const assignedAreaIds = (clientAreas ?? []).map((a) => a.area_id);
  const assignedAreas = (areas ?? []).filter((a) => assignedAreaIds.includes(a.id) && a.active);

  return (
    <div className="grid gap-6">
      <Link href="/clientes" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Clientes
      </Link>

      <PageHeader
        title={client.trade_name || client.legal_name}
        description={client.trade_name ? client.legal_name : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          {!client.active ? <Badge variant="secondary">inativo</Badge> : null}
          <Button
            nativeButton={false}
            render={<Link href={`/dashboard?aba=horas-cliente&cliente=${client.id}`} />}
            variant="outline"
            size="sm"
          >
            <ClockIcon />
            Ver extrato de horas
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dados do cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientDetailsForm
              client={client as Tables<"clients">}
              activeContracts={activeContracts}
              today={today}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle>Áreas de atuação</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientAreasForm
                clientId={client.id}
                areas={(areas ?? []) as Pick<Tables<"areas">, "id" | "name" | "active">[]}
                selected={(clientAreas ?? []).map((a) => a.area_id)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Atividades vinculadas a este cliente */}
      <Card>
        <ClientActivitiesSection
          clientId={client.id}
          clientAreas={assignedAreas.length > 0 ? assignedAreas : (areas ?? [])}
          activities={(clientActivities ?? []) as (Tables<"activities"> & { areas?: { name: string } | null })[]}
        />
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle>Contratos</CardTitle>
              <CardDescription>Cada contrato tem sua própria margem desejada e gastos extras.</CardDescription>
            </div>
            <Button nativeButton={false} render={<Link href={`/contratos/novo?cliente=${client.id}`} />} size="sm">
              <PlusIcon />
              Novo contrato
            </Button>
          </CardHeader>
          <CardContent>
            {(contracts ?? []).length === 0 ? (
              <EmptyState>Nenhum contrato cadastrado para este cliente.</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Equivalente/mês</TableHead>
                    <TableHead>Margem desejada</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((contracts ?? []) as Tables<"contracts">[]).map((contract) => {
                    const months =
                      PERIODICITY_MONTHS[contract.periodicity] ??
                      (contract.end_date ? monthsBetween(contract.start_date, contract.end_date) : null);
                    return (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <Link href={`/contratos/${contract.id}`} className="font-medium hover:underline">
                            {contract.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {PERIODICITY_LABELS[contract.periodicity]}
                            {Number(contract.tax_rate) > 0
                              ? ` · impostos ${Number(contract.tax_rate).toLocaleString("pt-BR")}%`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell>{formatCurrency(Number(contract.amount))}</TableCell>
                        <TableCell>
                          {months ? formatCurrency(Number(contract.amount) / months) : "—"}
                        </TableCell>
                        <TableCell>{Number(contract.desired_margin).toLocaleString("pt-BR")}%</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(contract.start_date)}
                          {contract.end_date ? ` — ${formatDate(contract.end_date)}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contract.status === "ativo" ? "default" : "secondary"}>
                            {CONTRACT_STATUS_LABELS[contract.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {contract.status !== "encerrado" ? (
                              <TerminateContractDialog
                                contract={contract}
                                otherActiveContractsCount={Math.max(
                                  0,
                                  activeContracts.filter((c) => c.id !== contract.id).length
                                )}
                                today={today}
                                trigger={
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                                  >
                                    <LockIcon className="size-3.5" />
                                    Encerrar
                                  </Button>
                                }
                              />
                            ) : null}
                            <DeleteContractButton
                              contractId={contract.id}
                              contractName={contract.name}
                              iconOnly
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
