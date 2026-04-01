import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Trata a requisição pre-flight do CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[INFO] Delete client account request received - Method: ${req.method}`);

    // Verificar variáveis de ambiente
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log(`[DEBUG] Environment check - URL: ${!!supabaseUrl}, ANON_KEY: ${!!supabaseAnonKey}, SERVICE_KEY: ${!!supabaseServiceKey}`);

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Configuração do servidor incompleta - variáveis de ambiente faltando");
    }

    // 1. Extrai o token de autorização do cabeçalho da requisição.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização ausente.");
    }

    console.log(`[DEBUG] Auth header present: ${authHeader.substring(0, 20)}...`);

    // 2. Cria um cliente Supabase com service role key
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 3. Extrair user_id do JWT token
    console.log(`[DEBUG] Extracting user from JWT token...`);

    const token = authHeader.replace('Bearer ', '');
    let user;

    try {
      // Criar um cliente simples para validar o token
      const tempClient = createClient(supabaseUrl, supabaseAnonKey);

      // Definir a sessão manualmente
      const { data: { user: tokenUser }, error: tokenError } = await tempClient.auth.getUser(token);

      if (tokenError) {
        console.error(`[ERROR] Token validation error:`, tokenError);
        throw new Error(`Token inválido: ${tokenError.message}`);
      }

      if (!tokenUser) {
        console.error(`[ERROR] No user found from token`);
        throw new Error("Usuário não encontrado ou token inválido.");
      }

      user = tokenUser;
      console.log(`[INFO] Recebida solicitação para excluir conta do usuário: ${user.id} (${user.email})`);
    } catch (error) {
      console.error(`[ERROR] Failed to extract user from token:`, error);
      throw new Error("Falha ao validar token de autenticação.");
    }

    // 5. Verificar se o usuário existe antes de tentar deletar
    console.log(`[DEBUG] Checking if user exists in auth system...`);
    const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user.id);
    if (getUserError) {
      console.error(`[ERROR] Failed to check user existence:`, getUserError);
      throw new Error(`Erro ao verificar usuário: ${getUserError.message}`);
    }

    if (!existingUser.user) {
      console.log(`[WARNING] User ${user.id} not found in auth system`);
      throw new Error("Usuário não encontrado no sistema de autenticação");
    }

    console.log(`[DEBUG] User found in auth system: ${existingUser.user.email}`);

    // 6. Deleta o usuário do sistema de autenticação do Supabase.
    console.log(`[DEBUG] Attempting to delete user ${user.id}...`);
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(`[ERROR] Falha ao deletar usuário ${user.id}:`, JSON.stringify(deleteError, null, 2));
      throw new Error(`Não foi possível deletar a conta: ${deleteError.message}`);
    }

    console.log(`[SUCCESS] Conta do usuário ${user.id} foi excluída com sucesso.`);

    // 6. Retorna uma resposta de sucesso.
    return new Response(JSON.stringify({ message: "Conta excluída com sucesso." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    // Em caso de erro, retorna uma mensagem de erro com o status apropriado.
    console.error('[FATAL] Erro no processamento da função:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', JSON.stringify(error, null, 2));

    let statusCode = 400;
    let errorMessage = error.message || "Erro interno do servidor";

    // Categorizar erros por status code
    if (error.message.includes("autorização ausente") || error.message.includes("token inválido")) {
      statusCode = 401;
    } else if (error.message.includes("não encontrado")) {
      statusCode = 404;
    } else if (error.message.includes("configuração") || error.message.includes("variáveis de ambiente")) {
      statusCode = 500;
      errorMessage = "Erro de configuração do servidor";
    }

    return new Response(JSON.stringify({
      error: errorMessage,
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusCode,
    });
  }
});
