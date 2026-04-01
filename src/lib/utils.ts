import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Funções utilitárias seguras para manipulação de strings e telefones
export function toStringSafe(v: unknown): string {
  return (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
}

export function onlyDigits(input: unknown): string {
  return toStringSafe(input).replace(/\D+/g, '');
}

export function normalizeToE164(input: unknown, defaultCountry: 'BR' = 'BR'): string {
  const digits = onlyDigits(input);
  if (!digits) throw new Error('phone_empty');

  if (defaultCountry === 'BR' && (digits.length === 10 || digits.length === 11)) {
    return `+55${digits}`;
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length >= 8 && toStringSafe(input).startsWith('+')) {
    return `+${digits}`;
  }
  throw new Error('phone_invalid_format');
}

export function formatPhoneBR(input: unknown): string {
  return toStringSafe(input).replace(/\D+/g, '');
}
