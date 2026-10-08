"use client";

import Link from "next/link";
import { Suspense, useActionState, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { forgotPasswordAction } from "../actions";

function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialActionState);
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueci minha senha</CardTitle>
        <CardDescription>Enviaremos um link para você criar uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <FormAlert state={state} />
          <Field label="E-mail" htmlFor="email" errors={state.fieldErrors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <SubmitButton className="w-full">Enviar link</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href={email ? `/login?email=${encodeURIComponent(email)}` : "/login"}
              className="font-medium text-foreground hover:underline"
            >
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
