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
  throw new Error("Variáveis de ambiente do Supabase ausentes.");
}

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceKey);

const DeleteRequestSchema = z.object({
  employee_user_id: z.string().uuid("ID de usuário do funcionário inválido."),
});

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Autenticação do usuário que está fazendo a requisição
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return sendError("Authorization header required", 401);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return sendError(authError?.message || "Autenticação inválida", 401);
    }
    console.log("Requesting user authenticated:", requestingUser.email);

    // 2. Validação do corpo da requisição
    const body = await req.json();
    const validation = DeleteRequestSchema.safeParse(body);
    if (!validation.success) {
      return sendError(`Payload inválido: ${validation.error.flatten().fieldErrors}`, 400);
    }
    const { employee_user_id } = validation.data;
    console.log("Request to delete employee with user_id:", employee_user_id);

    // 3. Verificação de Permissão (simplificada: precisa ser admin)
    // Uma lógica mais complexa poderia verificar se o admin pertence à mesma barbearia.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return sendError("Apenas administradores podem excluir funcionários.", 403);
    }
    console.log(`User ${requestingUser.email} has permission to delete.`);

    // 4. Deletar o usuário do sistema de autenticação
    // Isso irá deletar em cascata os dados em 'profiles' e 'funcionarios'
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employee_user_id);

    if (deleteError) {
      // Tratar caso o usuário a ser deletado seja o dono de uma barbearia, etc.
      console.error("Error deleting user from auth:", deleteError);
      return sendError(deleteError.message || "Erro ao deletar usuário do sistema.", 500);
    }
    console.log("Successfully deleted user:", employee_user_id);
    
    return sendSuccess({ message: "Funcionário excluído com sucesso." });

  } catch (error: unknown) {
    return sendError(error instanceof Error ? error.message : "Ocorreu um erro inesperado.", 500);
  }
};

serve(handler);