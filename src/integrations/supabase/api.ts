import { supabase } from './client';
import { Tables } from './types';

export type Agendamento = Tables<'agendamentos'>;

/**
 * Gera um token seguro de 64 bytes para autoatendimento
 */
const generateBookingToken = (): string => {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Gera hash SHA-256 de um token
 */
const generateSHA256Hash = async (token: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Cria um novo agendamento para o usuário autenticado ou anônimo.
 * @param appointmentData - Os dados do agendamento.
 * @returns O agendamento criado com token para autoatendimento.
 * @throws Se ocorrer um erro na criação.
 */
export const createAppointment = async (
  appointmentData: Omit<Agendamento, 'id' | 'created_at' | 'updated_at' | 'status' | 'booking_token_hash' | 'customer_id' | 'origem'> & { user_id: string | null }
) => {
  // Tenta obter a sessão do usuário de forma silenciosa.
  const { data: { session } } = await supabase.auth.getSession();

  // Gerar token seguro para autoatendimento
  const bookingToken = generateBookingToken();
  const bookingTokenHash = await generateSHA256Hash(bookingToken);

  // Determinar o user_id final
  const finalUserId = appointmentData.user_id !== undefined ? appointmentData.user_id : (session?.user?.id ?? null);

  // Construir payload base
  const newAppointment: any = {
    id: crypto.randomUUID(), // Visitantes não podem ler a linha criada, então o id nasce aqui
    barbearia_id: appointmentData.barbearia_id,
    servico_id: appointmentData.servico_id,
    funcionario_id: appointmentData.funcionario_id,
    cliente_nome: appointmentData.cliente_nome,
    cliente_telefone: appointmentData.cliente_telefone,
    cliente_email: appointmentData.cliente_email,
    data_hora: appointmentData.data_hora,
    booking_token_hash: bookingTokenHash,
    status: 'confirmado' as const, // Status inicial é confirmado automaticamente
    // TODO: Sistema de confirmação manual está pausado, pode ser reativado alterando para 'pendente'
  };

  // Adicionar user_id apenas se não for nulo (para evitar erro de RLS em usuários anônimos)
  if (finalUserId !== null) {
    newAppointment.user_id = finalUserId;
  }


  // Inserir o agendamento no banco de dados
  const { error } = await supabase.from('agendamentos').insert(newAppointment);

  if (error) {
    console.error('Erro ao criar agendamento:', error);
    if (error.message.includes('HORARIO_OCUPADO')) {
      throw new Error('Esse horário já está reservado para este profissional. Escolha outro.');
    }
    throw new Error(`Não foi possível criar o agendamento: ${error.message}`);
  }

  if (!session) {
    return { ...newAppointment, booking_token: bookingToken };
  }

  // Buscar dados completos do agendamento para retorno
  const { data: fullData, error: selectError } = await supabase
    .from('agendamentos')
    .select('*')
    .eq('id', newAppointment.id)
    .single();

  if (selectError) {
    console.error('Erro ao buscar dados completos do agendamento:', selectError);
    throw new Error(`Erro ao recuperar dados do agendamento: ${selectError.message}`);
  }

  // Retornar dados do agendamento junto com o token para autoatendimento
  return {
    ...fullData,
    booking_token: bookingToken, // Token em texto claro para envio ao cliente
  };
};

/**
 * Busca os agendamentos de um usuário.
 * @param userId - O ID do usuário.
 * @returns Uma lista de agendamentos.
 */
export const getAppointments = async (userId: string) => {
  const { data, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      barbearias (*),
      servicos (*),
      funcionarios (*)
    `)
    .eq('user_id', userId)
    .order('data_hora', { ascending: false });

  if (error) {
    console.error('Erro ao buscar agendamentos:', error);
    throw new Error('Não foi possível buscar os agendamentos.');
  }

  return data || [];
};

/**
 * Busca os agendamentos futuros de um usuário.
 * @param userId - O ID do usuário.
 * @returns Uma lista de agendamentos futuros.
 */
export const getUpcomingAppointments = async (userId: string) => {
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from("agendamentos")
		.select(
			`
      *,
      barbearias (*),
      servicos (*),
      funcionarios (*)
    `
		)
		.eq("user_id", userId)
		.gte("data_hora", now)
		.in("status", ["pendente", "confirmado"]) // Filtra apenas agendamentos ativos
		.order("data_hora", { ascending: true });

	if (error) {
		console.error("Erro ao buscar próximos agendamentos:", error);
		throw new Error("Não foi possível buscar os próximos agendamentos.");
	}
	return data || [];
};

/**
 * Busca o histórico de agendamentos de um usuário.
 * @param userId - O ID do usuário.
 * @returns Uma lista de agendamentos passados.
 */
export const getPastAppointments = async (userId: string) => {
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from("agendamentos")
		.select(
			`
      *,
      barbearias (*),
      servicos (*),
      funcionarios (*)
    `
		)
		.eq("user_id", userId)
		.lt("data_hora", now)
		.in("status", ["finalizado", "cancelado"]) // Corrigido para usar os status corretos do enum
		.order("data_hora", { ascending: false });

	if (error) {
		console.error("Erro ao buscar histórico de agendamentos:", error);
		throw new Error("Não foi possível buscar o histórico de agendamentos.");
	}
	return data || [];
};

/**
 * Busca os feedbacks pendentes de um usuário.
 * @param userId - O ID do usuário.
 * @returns Uma lista de feedbacks pendentes com detalhes da barbearia.
 */
export const getPendingFeedbacks = async (userId: string) => {
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      barbearias (
        nome,
        logo_url
      ),
      agendamentos (
        id,
        status
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'pendente') // Apenas status pendente
    .is('rating', null) // Ainda não foi avaliado (rating é null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar feedbacks pendentes:', error);
    throw new Error('Não foi possível buscar suas avaliações pendentes.');
  }

  // Filtrar apenas feedbacks de agendamentos finalizados
  const filteredData = (data || []).filter(feedback => 
    feedback.agendamentos?.status === 'finalizado'
  );

  return filteredData;
};

/**
 * Busca os feedbacks concluídos de uma barbearia para exibir no perfil público.
 * @param barbeariaId - O ID da barbearia.
 * @returns Uma lista de feedbacks concluídos com detalhes do usuário.
 */
export const getBarbershopFeedbacks = async (barbeariaId: string) => {
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      user_profile:profiles!user_id (
        name
      ),
      agendamentos (
        data_hora,
        servicos (
          nome
        )
      )
    `)
    .eq('barbearia_id', barbeariaId)
    .eq('status', 'concluido') // Apenas feedbacks concluídos
    .not('rating', 'is', null) // Com rating válido
    .gte('rating', 2) // Rating maior que 1 (excluir ratings padrão)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar feedbacks da barbearia:', error);
    throw new Error('Não foi possível buscar as avaliações da barbearia.');
  }

  return data || [];
};

/**
 * Busca os feedbacks de um usuário (incluindo respostas da barbearia).
 * @param userId - O ID do usuário.
 * @returns Uma lista de feedbacks do usuário com respostas.
 */
export const getUserFeedbacks = async (userId: string) => {
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      barbearias (
        nome,
        logo_url
      ),
      agendamentos (
        data_hora,
        servicos (
          nome
        )
      ),
      responded_by_profile:profiles!responded_by (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'concluido')
    .not('rating', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar feedbacks do usuário:', error);
    throw new Error('Não foi possível buscar suas avaliações.');
  }

  return data || [];
};

/**
 * Permite que um funcionário/admin responda a um feedback.
 * @param feedbackId - O ID do feedback.
 * @param response - A resposta da barbearia.
 * @param respondedById - O ID do usuário que está respondendo.
 * @returns O feedback atualizado.
 */
export const respondToFeedback = async (feedbackId: string, response: string, respondedById: string) => {
  const { data, error } = await supabase
    .from('feedbacks')
    .update({
      response: response,
      response_created_at: new Date().toISOString(),
      responded_by: respondedById,
    })
    .eq('id', feedbackId)
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao responder feedback:', error);
    throw new Error('Não foi possível responder ao feedback.');
  }

  return data;
};

/**
 * Cria um feedback pendente para um agendamento finalizado
 * (Esta função é chamada pela Edge Function, não pelo frontend diretamente)
 */
export const createPendingFeedback = async (agendamentoId: string) => {
  try {
    // Verificar se já existe um feedback para este agendamento
    const { data: existingFeedback, error: checkError } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('agendamento_id', agendamentoId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    // Se já existe feedback, não criar outro
    if (existingFeedback) {
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
      throw createError;
    }

    return newFeedback;

  } catch (error) {
    console.error('Erro ao criar feedback pendente:', error);
    throw error;
  }
};