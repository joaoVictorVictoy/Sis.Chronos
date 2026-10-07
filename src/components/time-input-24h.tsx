"use client";

import { useEffect, useState, type ChangeEvent, type FocusEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TimeInput24hProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
}

/** Formata digitação em tempo real no formato 24 horas (HH:mm) */
export function formatTime24Digits(input: string, prevValue = ""): string {
  // Permite apagar o ':' sem reformatar imediatamente
  if (prevValue.endsWith(":") && input === prevValue.slice(0, -1)) {
    return input;
  }

  // Remove qualquer caractere que não seja dígito ou dois-pontos
  const cleaned = input.replace(/[^\d:]/g, "");
  if (!cleaned) return "";

  // Se o usuário digitou ':' manualmente
  if (cleaned.includes(":")) {
    const [hRaw, ...mRest] = cleaned.split(":");
    let h = hRaw.slice(0, 2);
    let m = mRest.join("").slice(0, 2);
    if (h.length === 2 && Number(h) > 23) h = "23";
    if (m.length === 2 && Number(m) > 59) m = "59";
    return `${h}:${m}`;
  }

  // Apenas dígitos
  const digits = cleaned.slice(0, 4);
  if (digits.length <= 2) {
    if (digits.length === 2 && Number(digits) > 23) {
      return "23:";
    }
    return digits;
  }

  let h = digits.slice(0, 2);
  let m = digits.slice(2, 4);
  if (Number(h) > 23) h = "23";
  if (m.length === 2 && Number(m) > 59) m = "59";

  return `${h}:${m}`;
}

/** Normaliza no blur para formato 24h completo (ex: "8" -> "08:00", "8:30" -> "08:30", "14" -> "14:00") */
export function normalizeTime24OnBlur(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return trimmed;

  let h = Number(match[1]);
  let m = match[2] !== undefined ? Number(match[2]) : 0;

  if (h > 23) h = 23;
  if (m > 59) m = 59;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function TimeInput24h({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  placeholder = "00:00",
  className,
  required,
  disabled,
  hasError,
}: TimeInput24hProps) {
  const isControlled = value !== undefined;
  const [internalVal, setInternalVal] = useState<string>(value ?? defaultValue);

  useEffect(() => {
    if (isControlled) {
      setInternalVal(value ?? "");
    }
  }, [isControlled, value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextFormatted = formatTime24Digits(e.target.value, internalVal);
    if (!isControlled) {
      setInternalVal(nextFormatted);
    }
    onChange?.(nextFormatted);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const normalized = normalizeTime24OnBlur(e.target.value);
    if (normalized !== e.target.value) {
      if (!isControlled) {
        setInternalVal(normalized);
      }
      onChange?.(normalized);
    }
    onBlur?.(e);
  };

  return (
    <Input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      value={isControlled ? (value ?? "") : internalVal}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={5}
      required={required}
      disabled={disabled}
      aria-invalid={hasError ? "true" : undefined}
      className={cn("font-mono text-center tracking-wider", hasError && "border-destructive", className)}
    />
  );
}
