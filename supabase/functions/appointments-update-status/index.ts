import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.16.1/mod.ts";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Request schema validation
const UpdateStatusRequestSchema = z.object({
  id: z.string().uuid('ID do agendamento deve ser um UUID válido'),
  new_status: z.enum(['pendente', 'confirmado', 'cancelado', 'finalizado'], {
    errorMap: () => ({ message: 'Status deve ser: pendente, confirmado, cancelado ou finalizado' })
  }),
  data_hora: z.string().optional(), // Para reagendamento
});

type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>;

// Helper functions
const sendError = (message: string, status = 400) => {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
};

const sendSuccess = (data: any) => {
  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
};

/**
 * Verifica se o usuário é staff da barbearia do agendamento
 */
const verifyStaffPermission = async (userId: string, appointmentId: string) => {
  // Buscar dados do agendamento e verificar permissão do staff
  const { data: appointment, error: appointmentError } = await supabase
    .from('agendamentos')
    .select('barbearia_id')
    .eq('id', appointmentId)
    .single();

  if (appointmentError || !appointment) {
    throw new Error('Agendamento não encontrado');
  }

  // Verificar se o usuário é staff da barbearia
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, barbearia_id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error('Perfil do usuário não encontrado');
  }

  // Verificar se é admin ou funcionário da mesma barbearia
  const isStaff = ['admin', 'funcionario'].includes(profile.role);
  const sameBarbershop = profile.barbearia_id === appointment.barbearia_id;

  if (!isStaff || !sameBarbershop) {
    throw new Error('Usuário não tem permissão para atualizar este agendamento');
  }

  console.log('[APPOINTMENTS_UPDATE_STATUS] Permissão verificada:', {
    userId,
    appointmentId,
    role: profile.role,
    barbearia_id: profile.barbearia_id,
    appointment_barbearia_id: appointment.barbearia_id
  });

  return appointment.barbearia_id;
};

/**
 * Adiciona pontos de fidelidade para um agendamento finalizado
 */
const addLoyaltyPoints = async (agendamentoId: string, barbeariaId: string) => {
  try {
    // Buscar configuração de pontos da barbearia
    const { data: config, error: configError } = await supabase
      .from('fidelidade_configuracoes')
      .select('pontos_por_servico')
      .eq('barbearia_id', barbeariaId)
      .single();

    if (configError || !config) {
      console.log('[LOYALTY_POINTS] Configuração de fidelidade não encontrada para barbearia:', barbeariaId);
      return null;
    }

    // Buscar dados do agendamento
    const { data: agendamento, error: agendamentoError } = await supabase
      .from('agendamentos')
      .select('user_id, cliente_telefone, cliente_nome')
      .eq('id', agendamentoId)
      .single();

    if (agendamentoError || !agendamento) {
      throw new Error('Agendamento não encontrado para adicionar pontos');
    }

    // Preparar identificação do cliente (user_id ou telefone)
    const clienteIdentificacao = agendamento.user_id || agendamento.cliente_telefone;
    
    if (!clienteIdentificacao) {
      console.log('[LOYALTY_POINTS] Não foi possível identificar o cliente para adicionar pontos');
      return null;
    }

    // Verificar se o cliente já tem registro de fidelidade
    let query = supabase.from('fidelidade').select('*').eq('barbearia_id', barbeariaId);
    
    if (agendamento.user_id) {
      query = query.eq('user_id', agendamento.user_id);
    } else {
      query = query.eq('cliente_telefone', agendamento.cliente_telefone);
    }

    const { data: existingLoyalty, error: loyaltyError } = await query.maybeSingle();

    if (loyaltyError && loyaltyError.code !== 'PGRST116') {
      throw loyaltyError;
    }

    const pontosAdicionais = config.pontos_por_servico;

    if (existingLoyalty) {
      // Atualizar pontos existentes
      const { error: updateError } = await supabase
        .from('fidelidade')
        .update({ 
          pontos: existingLoyalty.pontos + pontosAdicionais,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLoyalty.id);

      if (updateError) {
        console.error('[LOYALTY_POINTS] Erro ao atualizar pontos:', updateError);
        return null;
      }

      console.log('[LOYALTY_POINTS] Pontos atualizados:', {
        clienteId: clienteIdentificacao,
        pontosAnteriores: existingLoyalty.pontos,
        pontosAdicionais,
        pontosNovos: existingLoyalty.pontos + pontosAdicionais
      });
    } else {
      // Criar novo registro de fidelidade
      const loyaltyData: any = {
        barbearia_id: barbeariaId,
        pontos: pontosAdicionais,
      };

      if (agendamento.user_id) {
        loyaltyData.user_id = agendamento.user_id;
      } else {
        loyaltyData.cliente_telefone = agendamento.cliente_telefone;
      }

      const { error: createError } = await supabase
        .from('fidelidade')
        .insert(loyaltyData);

      if (createError) {
        console.error('[LOYALTY_POINTS] Erro ao criar registro de fidelidade:', createError);
        return null;
      }

      console.log('[LOYALTY_POINTS] Novo registro de fidelidade criado:', {
        clienteId: clienteIdentificacao,
        pontosIniciais: pontosAdicionais
      });
    }

    return pontosAdicionais;

  } catch (error) {
    console.error('[LOYALTY_POINTS] Erro em addLoyaltyPoints:', error);
    return null; // Não falha a operação principal
  }
};

/**
 * Cria um feedback pendente para um agendamento finalizado
 */
const createPendingFeedback = async (agendamentoId: string) => {
  try {
    // Verificar se já existe um feedback para este agendamento
    const { data: existingFeedback, error: checkError } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('agendamento_id', agendamentoId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = No rows found
      throw checkError;
    }

    // Se já existe feedback, não criar outro
    if (existingFeedback) {
      console.log('[CREATE_FEEDBACK] Feedback já existe para o agendamento:', agendamentoId);
      return null;
    }

    // Buscar dados do agendamento para criar o feedback
    const { data: agendamento, error: agendamentoError } = await supabase
      .from('agendamentos')
      .select('user_id, barbearia_id, cliente_nome')
      .eq('id', agendamentoId)
      .single();

    if (agendamentoError || !agendamento) {
      throw new Error('Agendamento não encontrado para criação de feedback');
    }

    // Só criar feedback se o agendamento tiver user_id (usuário logado)
    if (!agendamento.user_id) {
      console.log('[CREATE_FEEDBACK] Agendamento anônimo, não criando feedback:', agendamentoId);
      return null;
    }

    // Criar feedback pendente
    const { data: newFeedback, error: createError } = await supabase
      .from('feedbacks')
      .insert({
        agendamento_id: agendamentoId,
        user_id: agendamento.user_id,
        barbearia_id: agendamento.barbearia_id,
        status: 'pendente',
        // rating e comment ficam null até o cliente avaliar
      })
      .select('*')
      .single();

    if (createError) {
      console.error('[CREATE_FEEDBACK] Erro ao criar feedback pendente:', createError);
      return null; // Não falha a operação
    }

    console.log('[CREATE_FEEDBACK] Feedback pendente criado com sucesso:', newFeedback.id);
    return newFeedback;

  } catch (error) {
    console.error('[CREATE_FEEDBACK] Erro em createPendingFeedback:', error);
    return null; // Não falha a operação principal
  }
};

/**
 * Atualiza o status do agendamento
 */
const updateAppointmentStatus = async (request: UpdateStatusRequest, barbeariaId: string) => {
  const updateData: any = {
    status: request.new_status,
    updated_at: new Date().toISOString(),
  };

  // Se for reagendamento, incluir nova data/hora
  if (request.data_hora) {
    updateData.data_hora = request.data_hora;
  }

  const { data, error } = await supabase
    .from('agendamentos')
    .update(updateData)
    .eq('id', request.id)
    .eq('barbearia_id', barbeariaId) // Segurança adicional
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar agendamento: ${error.message}`);
  }

  // Se o agendamento foi finalizado, adicionar pontos
  // Nota: O feedback é criado automaticamente pela trigger SQL
  if (request.new_status === 'finalizado') {
    // await createPendingFeedback(request.id); // Comentado - agora é feito pela trigger
    await addLoyaltyPoints(request.id, barbeariaId);
  }

  return data;
};

// Main handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return sendError('Método não permitido', 405);
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return sendError('Token de autorização necessário', 401);
    }

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return sendError('Token inválido', 401);
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedRequest = UpdateStatusRequestSchema.parse(body);

    // Verify staff permission
    const barbeariaId = await verifyStaffPermission(user.id, validatedRequest.id);

    // Update appointment status
    const updatedAppointment = await updateAppointmentStatus(validatedRequest, barbeariaId);

    // Log da operação
    console.log('[APPOINTMENTS_UPDATE_STATUS] Status atualizado:', {
      id: validatedRequest.id,
      new_status: validatedRequest.new_status,
      actor: user.id
    });

    return sendSuccess({
      ok: true,
      id: validatedRequest.id,
      status: validatedRequest.new_status
    });

  } catch (error) {
    console.error('Erro na Edge Function appointments-update-status:', error);
    
    if (error instanceof z.ZodError) {
      return sendError(`Dados inválidos: ${error.errors.map(e => e.message).join(', ')}`);
    }
    
    return sendError(error.message || 'Erro interno do servidor', 500);
  }
});