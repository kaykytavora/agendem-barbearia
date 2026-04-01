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

const CreateEmployeeSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  especialidade: z.string().trim().optional(),
  nivel_permissao: z.enum(['admin', 'funcionario']),
  foto_url: z.string().optional().default(''),
  barbeariaId: z.string().uuid(),
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
    const validation = CreateEmployeeSchema.safeParse(body);
    if (!validation.success) return sendError("Dados inválidos", 400);
    
    const { email, password, nome, especialidade, nivel_permissao, foto_url, barbeariaId } = validation.data;

    const hasPermission = await verifyUserPermission(supabaseAdmin, user.id, barbeariaId);
    if (!hasPermission) return sendError("Sem permissão", 403);

    // Verificar se email já existe
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    if (existingUser?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())) {
      return sendError("Email já está em uso", 400);
    }

    // Criar utilizador
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        barbearia_id: barbeariaId
      }
    });

    if (createError) return sendError(`Erro ao criar conta: ${createError.message}`, 500);
    if (!newUser.user) return sendError("Erro ao criar utilizador", 500);

    // Criar funcionário
    const { error: employeeError } = await supabaseAdmin.from('funcionarios').insert({
      user_id: newUser.user.id,
      nome,
      especialidade: especialidade || '',
      nivel_permissao,
      barbearia_id: barbeariaId,
      foto_url,
      email
    });

    if (employeeError) {
      // Rollback: eliminar utilizador criado
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return sendError(`Erro ao criar funcionário: ${employeeError.message}`, 500);
    }

    return sendSuccess({ 
      message: "Funcionário criado com sucesso",
      email,
      nome
    });

  } catch (error: unknown) {
    return sendError(error instanceof Error ? error.message : "Erro", 500);
  }
};

serve(handler);