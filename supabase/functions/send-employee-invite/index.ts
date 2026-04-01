import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  supabaseServiceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

if (!env.supabaseUrl || !env.supabaseServiceKey) {
  throw new Error("Configuração incompleta.");
}

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceKey);

const InviteRequestSchema = z.object({
  email: z.string().trim().email("Email inválido").max(254),
  barbeariaId: z.string().uuid(),
  barbeariaName: z.string().trim().min(1).max(200),
  nome: z.string().trim().min(2).max(100),
  especialidade: z.string().trim().max(200).optional(),
  nivel_permissao: z.enum(['admin', 'funcionario']),
  foto_url: z.string().optional().default(''),
});

const sendError = (message: string, status: number = 500) => {
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

const verifyUserPermission = async (supabaseAdmin: SupabaseClient, userId: string, barbeariaId: string): Promise<boolean> => {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role, barbearia_id').eq('user_id', userId).single();
  return profile?.role === 'admin' && profile?.barbearia_id === barbeariaId;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return sendError("Authorization required", 401);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return sendError("Invalid authentication", 401);

    const body = JSON.parse(await req.text());
    const validation = InviteRequestSchema.safeParse(body);
    if (!validation.success) return sendError("Dados inválidos", 400);
    
    const { email, nome, especialidade, nivel_permissao, foto_url, barbeariaId, barbeariaName } = validation.data;

    const hasPermission = await verifyUserPermission(supabaseAdmin, user.id, barbeariaId);
    if (!hasPermission) return sendError("Sem permissão", 403);

    const origin = req.headers.get("origin") || "http://localhost:5173";

    // Enviar convite via Supabase Auth (envia email automaticamente via SMTP)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          nome,
          especialidade,
          nivel_permissao,
          foto_url,
          barbearia_id: barbeariaId,
          barbearia_nome: barbeariaName,
        },
        redirectTo: `${origin}/accept-invite`,
      }
    );

    if (inviteError) {
      return sendError(`Erro ao enviar convite: ${inviteError.message}`, 500);
    }

    // Salvar convite no banco (para tracking)
    const inviteToken = inviteData.user?.id || crypto.randomUUID();
    await supabaseAdmin.from('funcionarios').insert({
      user_id: inviteData.user?.id,
      nome,
      especialidade: especialidade || '',
      nivel_permissao,
      barbearia_id: barbeariaId,
      foto_url,
      email
    });

    return sendSuccess({ 
      message: "Convite enviado com sucesso!",
      email
    });

  } catch (error: unknown) {
    return sendError(error instanceof Error ? error.message : "Erro", 500);
  }
};

serve(handler);