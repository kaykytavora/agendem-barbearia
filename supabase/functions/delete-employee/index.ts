import { createClient } from "npm:@supabase/supabase-js@2";

// Apaga a conta de um funcionário. Perfil e registro na equipe saem em cascata, e os
// agendamentos dele continuam na agenda, sem profissional definido.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responder = (corpo: object, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const erro = (mensagem: string, status: number) => responder({ success: false, error: mensagem }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return erro("Faça login novamente.", 401);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return erro("Faça login novamente.", 401);

    const { employee_user_id } = await req.json();
    if (typeof employee_user_id !== "string" || !employee_user_id) {
      return erro("Funcionário inválido.", 400);
    }
    if (employee_user_id === user.id) return erro("Você não pode excluir a própria conta aqui.", 400);

    const { data: dono } = await supabaseAdmin
      .from("profiles")
      .select("role, barbearia_id")
      .eq("user_id", user.id)
      .single();

    if (dono?.role !== "admin" || !dono.barbearia_id) {
      return erro("Só o administrador da barbearia pode excluir funcionários.", 403);
    }

    // Só alcança quem é da equipe desta barbearia, e nunca o dono dela
    const { data: funcionario } = await supabaseAdmin
      .from("funcionarios")
      .select("is_owner")
      .eq("user_id", employee_user_id)
      .eq("barbearia_id", dono.barbearia_id)
      .maybeSingle();

    if (!funcionario) return erro("Funcionário não encontrado nesta barbearia.", 404);
    if (funcionario.is_owner) return erro("O dono da barbearia não pode ser excluído.", 403);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employee_user_id);
    if (deleteError) {
      console.error("Erro ao excluir funcionário:", deleteError);
      return erro("Não foi possível excluir o funcionário.", 500);
    }

    return responder({ success: true });
  } catch (error) {
    console.error("Erro inesperado:", error);
    return erro("Não foi possível excluir o funcionário.", 500);
  }
});
