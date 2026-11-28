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

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(valor: number | string | null | undefined): string {
  const numero = Number(valor);
  return BRL.format(Number.isFinite(numero) ? numero : 0);
}

/** Endereço em uma linha. "Não informado" é o que o cadastro grava quando a cidade fica em branco. */
export function enderecoCompleto(b: { endereco?: string | null; bairro?: string | null; cidade?: string | null }): string {
  return [b.endereco, b.bairro, b.cidade]
    .map(toStringSafe)
    .filter((parte) => parte && parte !== 'Não informado')
    .join(', ');
}

/** Link do WhatsApp para um telefone brasileiro (com ou sem DDI), com mensagem opcional. */
export function whatsAppUrl(phone: string, mensagem?: string): string {
  const digitos = onlyDigits(phone);
  // Número nacional (DDD + número) recebe o DDI 55. Não dá para usar startsWith('55'): o DDD 55 (RS) também começa assim.
  const completo = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${completo}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}
