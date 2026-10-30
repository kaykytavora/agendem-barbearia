-- =============================================================================
-- 006 - SENHA PROVISÓRIA E CONFLITO DE HORÁRIOS
-- =============================================================================
-- Muda duas regras:
--
-- 1. Funcionários agora são cadastrados pelo dono, sem convite por e-mail:
--
--      Dono informa nome, e-mail e senha inicial
--           │
--           ▼
--      Edge Function create-employee-account cria o login
--           │
--           ▼
--      handle_new_user cria o perfil de cliente
--           │
--           ▼
--      A função cria o funcionário e o gatilho ajusta o perfil para a equipe
--           │
--           ▼
--      senha_provisoria = true
--           │
--           ▼
--      No primeiro login o app exige uma senha nova antes de liberar o painel
--
-- 2. O banco recusa dois agendamentos sobrepostos para o mesmo profissional, mesmo
--    que duas pessoas tentem reservar o horário ao mesmo tempo.
-- =============================================================================

ALTER TABLE public.profiles
    ADD COLUMN senha_provisoria boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.senha_provisoria IS
    'Verdadeiro enquanto a pessoa usa a senha definida pelo dono da barbearia.';


-- Cadastro sem convite: quem não vem como admin nasce cliente. A entrada na equipe
-- acontece só pela Edge Function, que confere se quem pediu é admin da barbearia.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_role           text := NEW.raw_user_meta_data ->> 'role';
    v_nome           text := COALESCE(NEW.raw_user_meta_data ->> 'name', '');
    v_telefone       text := NULLIF(NEW.raw_user_meta_data ->> 'phone', '');
    v_nome_barbearia text := NULLIF(NEW.raw_user_meta_data ->> 'barbershop_name', '');
    v_barbearia_id   uuid;
BEGIN
    IF v_role = 'admin' THEN
        INSERT INTO public.profiles (user_id, name, phone, role)
        VALUES (NEW.id, v_nome, v_telefone, 'admin');

        IF v_nome_barbearia IS NOT NULL THEN
            INSERT INTO public.barbearias (nome, cidade, slug)
            VALUES (v_nome_barbearia, 'Não informado', public.gerar_slug_unico(v_nome_barbearia))
            RETURNING id INTO v_barbearia_id;

            UPDATE public.profiles SET barbearia_id = v_barbearia_id WHERE user_id = NEW.id;

            INSERT INTO public.funcionarios (user_id, barbearia_id, nome, email, nivel, is_owner)
            VALUES (NEW.id, v_barbearia_id, v_nome, NEW.email, 'dono', true);

            -- Segunda a sexta 08h-18h, sábado 08h-17h, domingo fechado
            INSERT INTO public.horarios_funcionamento (barbearia_id, dia_semana, hora_abre, hora_fecha, fechado)
            VALUES (v_barbearia_id, 1, '08:00', '18:00', false),
                   (v_barbearia_id, 2, '08:00', '18:00', false),
                   (v_barbearia_id, 3, '08:00', '18:00', false),
                   (v_barbearia_id, 4, '08:00', '18:00', false),
                   (v_barbearia_id, 5, '08:00', '18:00', false),
                   (v_barbearia_id, 6, '08:00', '17:00', false),
                   (v_barbearia_id, 0, NULL, NULL, true);
        END IF;

        RETURN NEW;
    END IF;

    INSERT INTO public.profiles (user_id, name, phone, role)
    VALUES (NEW.id, v_nome, v_telefone, 'cliente');
    RETURN NEW;
END;
$$;


-- Mesma validação do arquivo 002, com a checagem de conflito antes de gravar:
--
--   Profissional definido e agendamento ativo?
--        │ sim
--        ▼
--   Trava a agenda do profissional  (a próxima reserva dele espera esta terminar)
--        │
--        ▼
--   Sobrepõe outro agendamento ativo dele? ── sim ──► erro
--        │ não
--        ▼
--     Grava
--
-- A sobreposição usa a duração dos serviços: um corte de 60 min às 10h bloqueia 10h30.
CREATE OR REPLACE FUNCTION public.validar_agendamento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_agenda_mudou boolean := TG_OP = 'INSERT'
        OR NEW.data_hora IS DISTINCT FROM OLD.data_hora
        OR NEW.funcionario_id IS DISTINCT FROM OLD.funcionario_id
        OR NEW.servico_id IS DISTINCT FROM OLD.servico_id;
    v_duracao integer;
BEGIN
    NEW.cliente_telefone := regexp_replace(NEW.cliente_telefone, '[^0-9]', '', 'g');
    NEW.cliente_email    := NULLIF(lower(trim(NEW.cliente_email)), '');
    NEW.cliente_nome     := trim(regexp_replace(NEW.cliente_nome, '\s+', ' ', 'g'));

    IF NEW.cliente_telefone <> '' AND length(NEW.cliente_telefone) NOT BETWEEN 10 AND 11 THEN
        RAISE EXCEPTION 'Telefone deve ter 10 ou 11 dígitos';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.user_id IS NULL AND length(NEW.cliente_telefone) < 10 THEN
        RAISE EXCEPTION 'Telefone é obrigatório para agendar sem conta';
    END IF;

    IF NEW.cliente_email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
        RAISE EXCEPTION 'Email inválido';
    END IF;

    IF length(NEW.cliente_nome) < 2 THEN
        RAISE EXCEPTION 'Nome deve ter pelo menos 2 caracteres';
    END IF;

    SELECT s.duracao_minutos INTO v_duracao
    FROM public.servicos s
    WHERE s.id = NEW.servico_id AND s.barbearia_id = NEW.barbearia_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Serviço não pertence a esta barbearia';
    END IF;

    IF NEW.funcionario_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.funcionarios f WHERE f.id = NEW.funcionario_id AND f.barbearia_id = NEW.barbearia_id
    ) THEN
        RAISE EXCEPTION 'Profissional não pertence a esta barbearia';
    END IF;

    IF v_agenda_mudou THEN
        IF NEW.data_hora < now() - interval '1 hour' THEN
            RAISE EXCEPTION 'Não é possível agendar para datas passadas';
        END IF;

        IF NEW.funcionario_id IS NOT NULL
           AND NOT public.check_funcionario_disponibilidade(NEW.funcionario_id, NEW.data_hora) THEN
            RAISE EXCEPTION 'Funcionário não disponível nesta data (férias/recesso)';
        END IF;
    END IF;

    IF (v_agenda_mudou OR NEW.status IS DISTINCT FROM OLD.status)
       AND NEW.funcionario_id IS NOT NULL
       AND NEW.status IN ('pendente', 'confirmado') THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(NEW.funcionario_id::text, 0));

        IF EXISTS (
            SELECT 1
            FROM public.agendamentos a
            JOIN public.servicos s ON s.id = a.servico_id
            WHERE a.funcionario_id = NEW.funcionario_id
              AND a.id <> NEW.id
              AND a.status IN ('pendente', 'confirmado')
              AND a.data_hora < NEW.data_hora + make_interval(mins => v_duracao)
              AND a.data_hora + make_interval(mins => s.duracao_minutos) > NEW.data_hora
        ) THEN
            RAISE EXCEPTION 'HORARIO_OCUPADO: Este horário já está reservado para este profissional.';
        END IF;
    END IF;

    IF TG_OP = 'INSERT' AND NOT public.check_anonymous_appointment_limit(NEW.cliente_telefone, NEW.user_id) THEN
        -- O prefixo é lido pelo app para mostrar a mensagem certa
        RAISE EXCEPTION 'LIMITE_AGENDAMENTOS_ANONIMOS: Número máximo de agendamentos ativos atingido para este telefone. Finalize ou cancele agendamentos existentes antes de criar um novo.';
    END IF;

    RETURN NEW;
END;
$$;
