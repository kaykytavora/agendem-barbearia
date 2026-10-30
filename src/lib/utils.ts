import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CSSProperties } from "react"

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

/** Converte "#RRGGBB" em matiz/saturação/luminosidade (graus e %), ou null se inválido. */
export function hexToHslParts(hex: string | null | undefined): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(toStringSafe(hex));
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Endereço em uma linha. "Não informado" é o que o cadastro grava quando a cidade fica em branco. */
export function enderecoCompleto(b: { endereco?: string | null; bairro?: string | null; cidade?: string | null }): string {
  return [b.endereco, b.bairro, b.cidade]
    .map(toStringSafe)
    .filter((parte) => parte && parte !== 'Não informado')
    .join(', ');
}

/** Luminância relativa (WCAG) de "#RRGGBB", de 0 (preto) a 1 (branco). */
function luminancia(hex: string): number {
  const int = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cores claras (amarelo, verde-limão...) pedem texto escuro; branco nelas fica ilegível. */
export function corPedeTextoEscuro(hex: string | null | undefined): boolean {
  if (!hexToHslParts(hex)) return false;
  return luminancia(toStringSafe(hex)) > 0.3;
}

/** Variáveis CSS da classe .shop-theme para a cor da barbearia (undefined se a cor for inválida). */
export function shopThemeStyle(hex: string | null | undefined): CSSProperties | undefined {
  const cor = hexToHslParts(hex);
  if (!cor) return undefined;
  return {
    '--shop-h': `${cor.h}`,
    '--shop-s': `${cor.s}%`,
    '--shop-l': `${cor.l}%`,
    '--shop-fg': corPedeTextoEscuro(hex) ? '240 20% 10%' : '0 0% 100%',
  } as CSSProperties;
}

/** Link do WhatsApp para um telefone brasileiro (com ou sem DDI), com mensagem opcional. */
export function whatsAppUrl(phone: string, mensagem?: string): string {
  const digitos = onlyDigits(phone);
  // Número nacional (DDD + número) recebe o DDI 55. Não dá para usar startsWith('55'): o DDD 55 (RS) também começa assim.
  const completo = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${completo}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}
