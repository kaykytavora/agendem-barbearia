import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// --- Configuração e Inicialização ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const env = {
  resendApiKey: Deno.env.get("RESEND_API_KEY"),
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  supabaseServiceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

if (!env.resendApiKey || !env.supabaseUrl || !env.supabaseServiceKey) {
  console.error("Variáveis de ambiente ausentes:", {
    hasResendKey: !!env.resendApiKey,
    hasSupabaseUrl: !!env.supabaseUrl,
    hasServiceKey: !!env.supabaseServiceKey
  });
  throw new Error("Configuração de ambiente incompleta.");
}

const resend = new Resend(env.resendApiKey);
const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);

// --- Validação de Schema ---

// Security: Enhanced input validation schema
const InviteRequestSchema = z.object({
  email: z.string()
    .trim()
    .email("Formato de e-mail inválido")
    .max(254, "Email muito longo"),
  funcionarioData: z.object({
    nome: z.string()
      .trim()
      .min(2, "Nome deve ter pelo menos 2 caracteres")
      .max(100, "Nome deve ter no máximo 100 caracteres")
      .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Nome contém caracteres inválidos"),
    especialidade: z.string()
      .trim()
      .max(200, "Especialidade muito longa")
      .optional(),
    nivel_permissao: z.enum(['admin', 'funcionario'], {
      errorMap: () => ({ message: "Nível de permissão inválido" })
    }),
    foto_url: z.string()
      .trim()
      .max(2048, "URL da foto muito longa")
      .refine(
        (val) => val === '' || /^https?:\/\/.+/.test(val),
        "URL da foto inválida"
      )
      .optional()
      .default('')
  }),
  barbeariaId: z.string().uuid("ID da barbearia inválido"),
  barbeariaName: z.string()
    .trim()
    .min(1, "Nome da barbearia é obrigatório")
    .max(200, "Nome da barbearia muito longo"),
});

// Security: HTML sanitization helper
function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

type InviteRequest = z.infer<typeof InviteRequestSchema>;

// --- Funções Auxiliares ---

const sendError = (message: string, status: number = 500) => {
  console.error(`Error (status ${status}): ${message}`);
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const sendSuccess = (data: object, status: number = 200) => {
  return new Response(JSON.stringify({ ...data, success: true }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const verifyUserPermission = async (supabase: SupabaseClient, userId: string, barbeariaId: string): Promise<boolean> => {
  // Fetch the profile of the user making the request
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, barbearia_id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error(`Erro ao buscar perfil do usuário ou perfil não encontrado: ${profileError?.message}`);
    return false;
  }
  
  // Check if the user is an admin AND belongs to the correct barbershop
  const isAuthorized = profile.role === 'admin' && profile.barbearia_id === barbeariaId;
  
  return isAuthorized;
};


// --- Handler Principal ---

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Autenticação do Usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return sendError("Authorization header required", 401);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return sendError(authError?.message || "Invalid authentication", 401);
    }
    console.log("User authenticated:", user.email);

    // 2. Validação do Corpo da Requisição
    // Security: Check payload size to prevent DoS
    const rawBody = await req.text();
    if (rawBody.length > 50000) { // 50KB limit
      return sendError("Payload muito grande", 413);
    }

    const body = JSON.parse(rawBody);
    const validation = InviteRequestSchema.safeParse(body);
    if (!validation.success) {
      return sendError(`Payload inválido: ${validation.error.flatten().fieldErrors}`, 400);
    }
    const { email, funcionarioData, barbeariaId, barbeariaName } = validation.data;
    console.log("Request data validated for:", email);

    // 3. Verificação de Permissão
    const hasPermission = await verifyUserPermission(supabase, user.id, barbeariaId);
    if (!hasPermission) {
      return sendError("Usuário não tem permissão para convidar funcionários para esta barbearia.", 403);
    }
    console.log(`User ${user.email} has permission for barbershop ${barbeariaId}`);

    // 4. Geração do Token de Convite
    const inviteToken = crypto.randomUUID() + "-" + Date.now();
    const inviteUrl = `${req.headers.get("origin") || "http://localhost:5173"}/accept-invite?token=${inviteToken}`;
    console.log("Generated invite token and URL");
    
    // 5. Envio do E-mail (antes de salvar no banco)
    console.log("Sending email via Resend...");
    try {
      const emailResponse = await resend.emails.send({
          from: "Agendem <noreply@agendem.com>",
          to: [email],
          subject: `Convite para ${barbeariaName} - ${funcionarioData.nome}`,
          html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Convite para Equipe - ${barbeariaName}</title>
              <style>
                @media only screen and (max-width: 600px) {
                  .container { max-width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
                  .header { padding: 32px 24px !important; }
                  .content { padding: 32px 24px !important; }
                  .footer { padding: 24px !important; }
                  .button { padding: 16px 24px !important; font-size: 15px !important; }
                }
              </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151;">
              <div class="container" style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">

                <!-- Header -->
                <div class="header" style="background: #1f2937; padding: 40px 32px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">agendem</h1>
                  <p style="color: #9ca3af; margin: 8px 0 0; font-size: 14px; font-weight: 500;">Sistema de Gestão para Barbearias</p>
                </div>

                <!-- Content -->
                <div class="content" style="padding: 40px 32px;">
                  <!-- Greeting -->
                  <div style="text-align: center; margin-bottom: 32px;">
                    <h2 style="color: #111827; margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.025em;">Olá, ${sanitizeHTML(funcionarioData.nome)}</h2>
                    <p style="color: #6b7280; margin: 0; font-size: 16px;">Você foi convidado para fazer parte da nossa equipe</p>
                  </div>

                  <!-- Invite Details -->
                  <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 32px; border-left: 3px solid #374151;">
                    <h3 style="color: #111827; margin: 0 0 16px; font-size: 18px; font-weight: 600;">${sanitizeHTML(barbeariaName)}</h3>
                    <div style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                      ${funcionarioData.especialidade ? `<p style="margin: 0 0 8px;"><span style="font-weight: 600;">Especialidade:</span> ${sanitizeHTML(funcionarioData.especialidade)}</p>` : ''}
                      <p style="margin: 0;"><span style="font-weight: 600;">Email:</span> ${sanitizeHTML(email)}</p>
                    </div>
                  </div>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${inviteUrl}" class="button" style="background: #111827; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s;">Aceitar Convite</a>
                  </div>

                  <!-- Expiry Notice -->
                  <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 3px solid #f59e0b;">
                    <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                      <strong>Atenção:</strong> Este convite expira em 7 dias. Certifique-se de aceitar dentro deste prazo.
                    </p>
                  </div>

                  <!-- Alternative Link -->
                  <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                    <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">Não consegue clicar no botão? Copie e cole este link:</p>
                    <p style="font-size: 13px; color: #9ca3af; word-break: break-all; margin: 0; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;">${inviteUrl}</p>
                  </div>
                </div>

                <!-- Footer -->
                <div class="footer" style="background: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px;">Se você não solicitou este convite, pode ignorar este email.</p>
                  <p style="font-size: 12px; color: #d1d5db; margin: 0;">© 2024 agendem</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });

      if (emailResponse.error) {
        console.error("Email sending failed:", emailResponse.error);
        return sendError(`Falha ao enviar e-mail: ${emailResponse.error.message || 'Erro desconhecido'}`, 502);
      }

      console.log("Email sent successfully:", emailResponse.data);
    } catch (error) {
      console.error("Exception during email sending:", error);
      return sendError(`Falha ao enviar e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 502);
    }
    console.log("Email sent successfully to:", email);

    // 6. Salvar Convite no Banco (somente após envio do e-mail)
    console.log("Saving invite to database...");
    console.log("Invite data to insert:", {
      email,
      barbearia_id: barbeariaId,
      funcionario_data: funcionarioData,
      token: inviteToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: user.id,
    });

    const insertData = {
      email,
      barbearia_id: barbeariaId,
      funcionario_data: funcionarioData,
      token: inviteToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: user.id,
      usado: false
    };

    console.log("About to insert into funcionario_convites:", insertData);

    const { data: insertResult, error: insertError } = await supabase
      .from('funcionario_convites')
      .insert(insertData)
      .select();

    if (insertError) {
      // Este é um caso problemático: o e-mail foi enviado, mas o convite não foi salvo.
      console.error("CRITICAL: Email sent but failed to save invite to DB:", insertError);
      console.error("Insert error details:", JSON.stringify(insertError, null, 2));
      console.error("Data that failed to insert:", insertData);
      return sendError(`Falha crítica: o convite foi enviado por e-mail, mas não pôde ser salvo no banco de dados. Erro: ${insertError.message || insertError.details || 'Erro desconhecido'}`);
    }
    console.log("Invite saved to database successfully.");
    console.log("Inserted invite data:", insertResult);

    if (!insertResult || insertResult.length === 0) {
      console.warn("Warning: Insert appeared successful but no data returned");
    }

    return sendSuccess({ 
      message: "Convite enviado com sucesso",
      inviteToken 
    });

  } catch (error: unknown) {
    // Erro genérico para falhas inesperadas (ex: JSON malformado)
    return sendError(error instanceof Error ? error.message : "Ocorreu um erro inesperado.", 500);
  }
};

serve(handler);