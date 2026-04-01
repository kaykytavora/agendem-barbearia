import { z } from 'zod';

// Common validation schemas for security
export const phoneSchema = z.string()
  .min(10, 'Telefone deve ter pelo menos 10 dígitos')
  .max(15, 'Telefone deve ter no máximo 15 dígitos')
  .regex(/^\+?[\d\s()-]+$/, 'Formato de telefone inválido');

export const emailSchema = z.string()
  .email('Email inválido')
  .max(254, 'Email muito longo'); // RFC 5321 limit

export const nameSchema = z.string()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres')
  .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços');

export const passwordSchema = z.string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula e 1 número');

export const serviceNameSchema = z.string()
  .min(2, 'Nome do serviço deve ter pelo menos 2 caracteres')
  .max(100, 'Nome do serviço deve ter no máximo 100 caracteres')
  .regex(/^[a-zA-ZÀ-ÿ\s\-&]+$/, 'Nome do serviço contém caracteres inválidos');

export const priceSchema = z.number()
  .min(0.01, 'Preço deve ser maior que zero')
  .max(9999.99, 'Preço deve ser menor que R$ 10.000');

export const durationSchema = z.number()
  .min(5, 'Duração deve ser pelo menos 5 minutos')
  .max(480, 'Duração deve ser no máximo 8 horas');

// Schema para OTP
export const otpSchema = z.string()
  .length(6, 'OTP deve ter exatamente 6 dígitos')
  .regex(/^\d{6}$/, 'OTP deve conter apenas números');

// Schema para agendamento anônimo
// TODO: Reativar validação OTP quando API de SMS estiver disponível
export const anonymousBookingSchema = z.object({
  name: nameSchema,
  phone: z.string()
    .trim()
    .min(8, 'Telefone inválido')
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length >= 10, 'Telefone deve ter pelo menos 10 dígitos')
  // otp: otpSchema // Temporariamente desabilitado
});

// Sanitization functions
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+()-\s]/g, '');
}

export function sanitizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// Rate limiting helper (client-side tracking)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
}