import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// --- Configuração e Inicialização ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  supabaseServiceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

if (!env.supabaseUrl || !env.supabaseServiceKey) {
  console.error("Variáveis de ambiente ausentes. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  throw new Error("Configuração de ambiente incompleta.");
}

const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);

// --- Validação de Schema ---

const BookingActionSchema = z.object({
  agendamento_id: z.string().uuid("ID do agendamento inválido"),
  token: z.string().min(1, "Token é obrigatório"),
  action: z.enum(["cancel", "reschedule"], {
    errorMap: () => ({ message: "Ação deve ser 'cancel' ou 'reschedule'" })
  }),
  new_date_time: z.string().datetime().optional(), // Obrigatório apenas para reschedule
});

type BookingActionRequest = z.infer<typeof BookingActionSchema>;

// --- Funções Auxiliares ---

const sendError = (message: string, status: number = 500) => {
  console.error(`Error (status ${status}): ${message}`);
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const sendSuccess = (data: any) => {
  return new Response(JSON.stringify({ ...data, success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

// --- Função para gerar hash SHA-256 ---
const generateSHA256Hash = async (text: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- Função para verificar token ---
const verifyTokenHash = async (agendamentoId: string, token: string): Promise<boolean> => {
  try {
    const tokenHash = await generateSHA256Hash(token);
    
    const { data: agendamento, error } = await supabase
      .from("agendamentos")
      .select("booking_token_hash, created_at")
      .eq("id", agendamentoId)
      .single();

    if (error || !agendamento) {
      console.error("Agendamento não encontrado:", error);
      return false;
    }

    // Verificar se o hash do token confere
    if (agendamento.booking_token_hash !== tokenHash) {
      console.error("Hash do token não confere");
      return false;
    }

    // Verificar janela temporal (14 dias)
    const createdAt = new Date(agendamento.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 14) {
      console.error("Token expirado (mais de 14 dias)");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao verificar token:", error);
    return false;
  }
};

// --- Função para cancelar agendamento ---
const cancelAppointment = async (agendamentoId: string): Promise<any> => {
  const { data, error } = await supabase
    .from("agendamentos")
    .update({ 
      status: "cancelado",
      booking_token_hash: null // Invalidar token após uso
    })
    .eq("id", agendamentoId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// --- Função para reagendar agendamento ---
const rescheduleAppointment = async (agendamentoId: string, newDateTime: string): Promise<any> => {
  // Gerar novo token para o reagendamento
  const newToken = crypto.randomUUID() + crypto.randomUUID(); // 64 bytes aleatórios
  const newTokenHash = await generateSHA256Hash(newToken);
  
  const { data, error } = await supabase
    .from("agendamentos")
    .update({ 
      data_hora: newDateTime,
      booking_token_hash: newTokenHash // Novo token para futuras alterações
    })
    .eq("id", agendamentoId)
    .select()
    .single();

  if (error) throw error;
  
  return {
    agendamento: data,
    new_token: newToken // Retornar novo token para o cliente
  };
};

// --- Função para verificar disponibilidade de horário ---
const checkTimeAvailability = async (barbeariaId: string, funcionarioId: string, newDateTime: string, excludeAgendamentoId: string): Promise<boolean> => {
  const { data: conflictingAppointments, error } = await supabase
    .from("agendamentos")
    .select("id")
    .eq("barbearia_id", barbeariaId)
    .eq("funcionario_id", funcionarioId)
    .eq("data_hora", newDateTime)
    .neq("id", excludeAgendamentoId)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao verificar disponibilidade:", error);
    return false;
  }

  return conflictingAppointments.length === 0;
};

// --- Handler Principal ---

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return sendError("Método não permitido. Use POST.", 405);
  }

  try {
    const body = await req.json();
    console.log("Request body:", body);

    // Validar entrada
    const validatedData = BookingActionSchema.parse(body);
    
    // Validar se reschedule tem new_date_time
    if (validatedData.action === "reschedule" && !validatedData.new_date_time) {
      return sendError("new_date_time é obrigatório para ação 'reschedule'", 400);
    }

    // Verificar token
    const isValidToken = await verifyTokenHash(validatedData.agendamento_id, validatedData.token);
    if (!isValidToken) {
      return sendError("Token inválido ou expirado", 401);
    }

    let result;

    if (validatedData.action === "cancel") {
      result = await cancelAppointment(validatedData.agendamento_id);
      console.log("Agendamento cancelado:", result);
      
      return sendSuccess({
        message: "Agendamento cancelado com sucesso",
        agendamento: result
      });
      
    } else if (validatedData.action === "reschedule") {
      // Buscar dados do agendamento para verificar disponibilidade
      const { data: currentAgendamento, error: fetchError } = await supabase
        .from("agendamentos")
        .select("barbearia_id, funcionario_id")
        .eq("id", validatedData.agendamento_id)
        .single();

      if (fetchError || !currentAgendamento) {
        return sendError("Agendamento não encontrado", 404);
      }

      // Verificar disponibilidade do novo horário
      const isAvailable = await checkTimeAvailability(
        currentAgendamento.barbearia_id,
        currentAgendamento.funcionario_id,
        validatedData.new_date_time!,
        validatedData.agendamento_id
      );

      if (!isAvailable) {
        return sendError("Horário não disponível", 409);
      }

      result = await rescheduleAppointment(validatedData.agendamento_id, validatedData.new_date_time!);
      console.log("Agendamento reagendado:", result);
      
      return sendSuccess({
        message: "Agendamento reagendado com sucesso",
        agendamento: result.agendamento,
        new_token: result.new_token
      });
    }

  } catch (error) {
    console.error("Erro no processamento:", error);
    
    if (error instanceof z.ZodError) {
      return sendError(
        `Dados inválidos: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    return sendError(
      error.message || "Erro interno do servidor",
      500
    );
  }
});

console.log("Edge Function 'booking-action' iniciada.");