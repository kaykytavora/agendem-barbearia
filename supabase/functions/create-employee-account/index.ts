import { createClient } from "npm:@supabase/supabase-js@2";

// O dono cadastra o funcionário com uma senha inicial:
//
//   Confere o login de quem pediu e se é admin de uma barbearia
//        │
//        ▼
//   Cria a conta já confirmada (o funcionário entra sem precisar validar o e-mail)
//        │
//        ▼
//   Cria o funcionário; o gatilho do banco coloca o perfil na equipe
//        │
//        ▼
//   Marca a senha como provisória; o app exige a troca no primeiro login
//
// Se algo falhar depois de criar a conta, ela é apagada para o e-mail não ficar preso.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NIVEIS = ["funcionario", "gerente", "dono"];
const SENHA_MINIMA = 8;

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

    // A barbearia vem do perfil de quem pediu, nunca do corpo do pedido
    const { data: dono } = await supabaseAdmin
      .from("profiles")
      .select("role, barbearia_id")
      .eq("user_id", user.id)
      .single();

    if (dono?.role !== "admin" || !dono.barbearia_id) {
      return erro("Só o administrador da barbearia pode cadastrar funcionários.", 403);
    }

    const { email, password, nome, especialidade, nivel_permissao } = await req.json();
    const emailLimpo = String(email ?? "").trim().toLowerCase();
    const nomeLimpo = String(nome ?? "").trim();
    const nivel = NIVEIS.includes(nivel_permissao) ? nivel_permissao : "funcionario";

    if (nomeLimpo.length < 2) return erro("Informe o nome do funcionário.", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) return erro("E-mail inválido.", 400);
    if (typeof password !== "string" || password.length < SENHA_MINIMA) {
      return erro(`A senha inicial precisa ter pelo menos ${SENHA_MINIMA} caracteres.`, 400);
    }

    const { data: criado, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLimpo,
      password,
      email_confirm: true,
      user_metadata: { name: nomeLimpo, role: "funcionario" },
    });

    if (createError || !criado.user) {
      const jaExiste = createError?.code === "email_exists" || createError?.status === 422;
      return erro(jaExiste ? "Este e-mail já tem uma conta." : "Não foi possível criar a conta.", jaExiste ? 409 : 500);
    }

    const novoId = criado.user.id;

    const { error: funcionarioError } = await supabaseAdmin.from("funcionarios").insert({
      user_id: novoId,
      barbearia_id: dono.barbearia_id,
      nome: nomeLimpo,
      email: emailLimpo,
      especialidade: String(especialidade ?? "").trim() || null,
      nivel,
    });

    const { error: perfilError } = funcionarioError
      ? { error: null }
      : await supabaseAdmin
          .from("profiles")
          .update({ senha_provisoria: true, role: nivel === "funcionario" ? "funcionario" : "admin" })
          .eq("user_id", novoId);

    if (funcionarioError || perfilError) {
      console.error("Erro ao criar funcionário:", funcionarioError ?? perfilError);
      await supabaseAdmin.auth.admin.deleteUser(novoId);
      return erro("Não foi possível cadastrar o funcionário.", 500);
    }

    return responder({ success: true, email: emailLimpo, nome: nomeLimpo });
  } catch (error) {
    console.error("Erro inesperado:", error);
    return erro("Não foi possível cadastrar o funcionário.", 500);
  }
});
