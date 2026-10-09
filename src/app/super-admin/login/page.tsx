"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheckIcon, LockIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { superAdminLoginAction } from "./actions";
import { Suspense } from "react";

export default function SuperAdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-svh flex items-center justify-center">Carregando...</div>}>
      <SuperAdminLoginForm />
    </Suspense>
  );
}

function SuperAdminLoginForm() {
  const [state, formAction] = useActionState(superAdminLoginAction, initialActionState);
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const erroUrl = params.get("erro");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
            <ShieldCheckIcon className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Portal do Super Admin</h1>
            <p className="text-xs text-slate-400">Controle Master de Empresas & Assinaturas</p>
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <LockIcon className="size-4 text-indigo-400" />
              Acesso Administrativo
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Apenas os donos e administradores do SaaS têm autorização para acessar esta área.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form action={formAction} className="grid gap-4">
              <FormAlert state={erroUrl && !state.error ? { ...state, error: erroUrl } : state} />

              <Field label="E-mail de Super Admin" htmlFor="email" errors={state.fieldErrors?.email}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="joaovictor@binariconsultoria.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/30"
                />
              </Field>

              <Field label="Senha" htmlFor="password" errors={state.fieldErrors?.password}>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/30"
                />
              </Field>

              <SubmitButton className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20">
                Acessar Painel Master
              </SubmitButton>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Ir para o login normal de empresas
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-slate-500">
          Sis.Chronos · Plataforma de Gestão SaaS
        </p>
      </div>
    </div>
  );
}
