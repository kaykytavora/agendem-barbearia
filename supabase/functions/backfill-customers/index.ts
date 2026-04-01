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

const BackfillRequestSchema = z.object({
  batch_size: z.number().min(1).max(1000).default(100),
  dry_run: z.boolean().default(false),
  force: z.boolean().default(false) // Para forçar reprocessamento
});

type BackfillRequest = z.infer<typeof BackfillRequestSchema>;

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

// --- Função para normalizar telefone para E.164 ---
const normalizePhoneToE164 = (phone: string): string | null => {
  if (!phone) return null;
  
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) return null;
  
  // Se já tem código do país (+55), mantém
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return `+${cleaned}`;
  }
  
  // Se tem 11 dígitos (celular brasileiro), adiciona +55
  if (cleaned.length === 11 && cleaned.startsWith('9')) {
    return `+55${cleaned}`;
  }
  
  // Se tem 10 dígitos (telefone fixo brasileiro), adiciona +55
  if (cleaned.length === 10) {
    return `+55${cleaned}`;
  }
  
  // Se tem 9 dígitos (celular sem DDD), assume DDD 11 (São Paulo)
  if (cleaned.length === 9 && cleaned.startsWith('9')) {
    return `+5511${cleaned}`;
  }
  
  // Se tem 8 dígitos (fixo sem DDD), assume DDD 11 (São Paulo)
  if (cleaned.length === 8) {
    return `+5511${cleaned}`;
  }
  
  console.warn(`Telefone não pôde ser normalizado: ${phone} (${cleaned})`);
  return null;
};

// --- Função para encontrar ou criar customer ---
const findOrCreateCustomer = async (phone: string, name: string): Promise<string | null> => {
  const normalizedPhone = normalizePhoneToE164(phone);
  if (!normalizedPhone) {
    console.warn(`Telefone inválido: ${phone}`);
    return null;
  }
  
  try {
    // Tentar encontrar customer existente
    const { data: existingCustomer, error: findError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone_e164', normalizedPhone)
      .single();
    
    if (existingCustomer) {
      return existingCustomer.id;
    }
    
    // Se não encontrou, criar novo customer
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        phone_e164: normalizedPhone,
        name: name || 'Cliente',
        verified_at: new Date().toISOString() // Considerar como verificado para dados legados
      })
      .select('id')
      .single();
    
    if (createError) {
      console.error(`Erro ao criar customer para ${normalizedPhone}:`, createError);
      return null;
    }
    
    console.log(`Customer criado: ${newCustomer.id} para ${normalizedPhone}`);
    return newCustomer.id;
    
  } catch (error) {
    console.error(`Erro ao processar customer para ${phone}:`, error);
    return null;
  }
};

// --- Função para processar batch de agendamentos ---
const processBatch = async (batchSize: number, offset: number, dryRun: boolean, force: boolean) => {
  const whereClause = force ? {} : { customer_id: null };
  
  const { data: agendamentos, error: fetchError } = await supabase
    .from('agendamentos')
    .select('id, cliente_telefone, cliente_nome, customer_id')
    .match(whereClause)
    .not('cliente_telefone', 'is', null)
    .range(offset, offset + batchSize - 1)
    .order('created_at', { ascending: true });
  
  if (fetchError) {
    throw new Error(`Erro ao buscar agendamentos: ${fetchError.message}`);
  }
  
  if (!agendamentos || agendamentos.length === 0) {
    return { processed: 0, updated: 0, errors: 0, hasMore: false };
  }
  
  let updated = 0;
  let errors = 0;
  
  for (const agendamento of agendamentos) {
    try {
      const customerId = await findOrCreateCustomer(
        agendamento.cliente_telefone,
        agendamento.cliente_nome
      );
      
      if (customerId && !dryRun) {
        const { error: updateError } = await supabase
          .from('agendamentos')
          .update({ customer_id: customerId })
          .eq('id', agendamento.id);
        
        if (updateError) {
          console.error(`Erro ao atualizar agendamento ${agendamento.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      } else if (customerId && dryRun) {
        updated++; // Simular atualização no dry run
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`Erro ao processar agendamento ${agendamento.id}:`, error);
      errors++;
    }
  }
  
  return {
    processed: agendamentos.length,
    updated,
    errors,
    hasMore: agendamentos.length === batchSize
  };
};

// --- Função para obter estatísticas ---
const getStats = async () => {
  const [totalResult, withoutCustomerResult, customersResult] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .not('cliente_telefone', 'is', null),
    
    supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .is('customer_id', null)
      .not('cliente_telefone', 'is', null),
    
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
  ]);
  
  return {
    total_agendamentos_com_telefone: totalResult.count || 0,
    agendamentos_sem_customer_id: withoutCustomerResult.count || 0,
    total_customers: customersResult.count || 0
  };
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
    const validatedData = BackfillRequestSchema.parse(body);
    
    const startTime = Date.now();
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let offset = 0;
    
    console.log(`Iniciando backfill - Batch size: ${validatedData.batch_size}, Dry run: ${validatedData.dry_run}, Force: ${validatedData.force}`);
    
    // Obter estatísticas iniciais
    const initialStats = await getStats();
    console.log("Estatísticas iniciais:", initialStats);
    
    // Processar em batches
    while (true) {
      console.log(`Processando batch ${Math.floor(offset / validatedData.batch_size) + 1} (offset: ${offset})`);
      
      const batchResult = await processBatch(
        validatedData.batch_size,
        offset,
        validatedData.dry_run,
        validatedData.force
      );
      
      totalProcessed += batchResult.processed;
      totalUpdated += batchResult.updated;
      totalErrors += batchResult.errors;
      
      console.log(`Batch processado: ${batchResult.processed} registros, ${batchResult.updated} atualizados, ${batchResult.errors} erros`);
      
      if (!batchResult.hasMore) {
        break;
      }
      
      offset += validatedData.batch_size;
      
      // Pequena pausa entre batches para não sobrecarregar o banco
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Obter estatísticas finais
    const finalStats = await getStats();
    const duration = Date.now() - startTime;
    
    console.log("Backfill concluído:", {
      totalProcessed,
      totalUpdated,
      totalErrors,
      duration: `${duration}ms`,
      finalStats
    });
    
    return sendSuccess({
      message: validatedData.dry_run ? "Simulação de backfill concluída" : "Backfill concluído com sucesso",
      stats: {
        processed: totalProcessed,
        updated: totalUpdated,
        errors: totalErrors,
        duration_ms: duration,
        initial_stats: initialStats,
        final_stats: finalStats
      },
      dry_run: validatedData.dry_run
    });

  } catch (error) {
    console.error("Erro no backfill:", error);
    
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

console.log("Edge Function 'backfill-customers' iniciada.");