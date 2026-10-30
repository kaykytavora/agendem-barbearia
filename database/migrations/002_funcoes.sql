-- =============================================================================
-- 002 - FUNÇÕES
-- =============================================================================
-- SECURITY DEFINER significa que a função roda com permissão do dono do banco,
-- ignorando as regras de linha (RLS). Por isso cada uma:
--   * fixa o search_path, para ninguém trocar uma tabela por outra de mesmo nome;
--   * devolve só o mínimo necessário, nunca dados de outras pessoas.
-- Quem pode chamar cada função é definido no arquivo 004.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Quem é o usuário atual? (base de todas as regras de RLS)
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.get_current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$ SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid() $$;

CREATE FUNCTION public.get_user_role(user_uuid uuid) RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$ SELECT p.role FROM public.profiles p WHERE p.user_id = user_uuid $$;

CREATE FUNCTION public.get_user_barbearia_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$ SELECT p.barbearia_id FROM public.profiles p WHERE p.user_id = auth.uid() $$;

CREATE FUNCTION public.get_user_barbearia_id(user_uuid uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$ SELECT p.barbearia_id FROM public.profiles p WHERE p.user_id = user_uuid $$;

CREATE FUNCTION public.user_can_access_barbearia(target_barbearia_id uuid, required_roles public.user_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
              AND p.barbearia_id = target_barbearia_id
              AND p.role = ANY (required_roles)
        )
    $$;

-- Atalhos usados nas regras: "é dono/gerente desta barbearia?" e "é da equipe?"
CREATE FUNCTION public.user_is_admin_of_barbearia(check_barbearia_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$ SELECT public.user_can_access_barbearia(check_barbearia_id, ARRAY['admin']::public.user_role[]) $$;

CREATE FUNCTION public.user_is_staff_of_barbearia(check_barbearia_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$ SELECT public.user_can_access_barbearia(check_barbearia_id, ARRAY['admin', 'funcionario']::public.user_role[]) $$;

-- Telefone cadastrado de quem está logado (liga a conta ao saldo de fidelidade)
CREATE FUNCTION public.get_user_phone() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$ SELECT NULLIF(p.phone, '') FROM public.profiles p WHERE p.user_id = auth.uid() $$;

-- Nome e papel de pessoas que o solicitante tem direito de ver
CREATE FUNCTION public.get_public_profile_info(profile_user_ids uuid[])
    RETURNS TABLE (user_id uuid, name text, role public.user_role)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT p.user_id, p.name, p.role
        FROM public.profiles p
        WHERE p.user_id = ANY (profile_user_ids)
          AND (p.user_id = auth.uid() OR public.user_is_staff_of_barbearia(p.barbearia_id))
    $$;


-- -----------------------------------------------------------------------------
-- Cadastro
-- -----------------------------------------------------------------------------

-- Usada antes do cadastro para avisar que o e-mail ou telefone já existe.
-- Devolve apenas verdadeiro/falso, nunca dados da conta.
CREATE FUNCTION public.check_if_user_exists(p_email text, p_phone text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_email_exists boolean := false;
    v_phone_exists boolean := false;
BEGIN
    IF NULLIF(p_email, '') IS NOT NULL THEN
        v_email_exists := EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(p_email));
    END IF;

    IF NULLIF(p_phone, '') IS NOT NULL THEN
        v_phone_exists := EXISTS (SELECT 1 FROM public.profiles p WHERE p.phone = p_phone);
    END IF;

    RETURN json_build_object(
        'email_exists', v_email_exists,
        'phone_exists', v_phone_exists,
        'user_exists', v_email_exists OR v_phone_exists
    );
END;
$$;

-- "Barbearia do João!" vira "barbearia-do-joao"
CREATE FUNCTION public.generate_slug(text) RETURNS text
    LANGUAGE sql IMMUTABLE SET search_path = ''
    AS $$
        SELECT trim(BOTH '-' FROM regexp_replace(
            lower(translate($1,
                'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
            '[^a-z0-9]+', '-', 'g'))
    $$;

-- Evita erro no cadastro quando duas barbearias têm o mesmo nome:
-- "barbearia-x", depois "barbearia-x-2", "barbearia-x-3"...
CREATE FUNCTION public.gerar_slug_unico(p_nome text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_base text := COALESCE(NULLIF(public.generate_slug(p_nome), ''), 'barbearia');
    v_slug text := v_base;
    v_n    integer := 1;
BEGIN
    WHILE EXISTS (SELECT 1 FROM public.barbearias b WHERE b.slug = v_slug) LOOP
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
    END LOOP;
    RETURN v_slug;
END;
$$;

-- Roda automaticamente a cada novo login criado:
--
--   Novo usuário
--        │
--        ├─ role = 'funcionario' e existe convite válido para o e-mail?
--        │       └─ sim: cria perfil + funcionário e marca o convite como usado
--        │
--        ├─ role = 'admin'?
--        │       └─ sim: cria perfil de admin; se veio `barbershop_name`, cria
--        │               a barbearia, o dono na equipe e os horários padrão
--        │
--        └─ qualquer outro caso: cria perfil de cliente
--
-- Quem pede 'funcionario' sem convite válido vira cliente, nunca equipe.
CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_role           text := NEW.raw_user_meta_data ->> 'role';
    v_nome           text := COALESCE(NEW.raw_user_meta_data ->> 'name', '');
    v_telefone       text := NULLIF(NEW.raw_user_meta_data ->> 'phone', '');
    v_nome_barbearia text := NULLIF(NEW.raw_user_meta_data ->> 'barbershop_name', '');
    v_barbearia_id   uuid;
    v_convite        public.funcionario_convites%ROWTYPE;
BEGIN
    IF v_role = 'funcionario' THEN
        SELECT c.* INTO v_convite
        FROM public.funcionario_convites c
        WHERE lower(c.email) = lower(NEW.email)
          AND c.usado = false
          AND c.expires_at > now()
        ORDER BY c.created_at DESC
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO public.profiles (user_id, name, phone, role, barbearia_id)
            VALUES (NEW.id, v_nome, v_telefone, 'funcionario', v_convite.barbearia_id);

            INSERT INTO public.funcionarios (user_id, barbearia_id, nome, email, especialidade, nivel, is_owner)
            VALUES (
                NEW.id,
                v_convite.barbearia_id,
                COALESCE(v_convite.funcionario_data ->> 'nome', v_nome),
                NEW.email,
                v_convite.funcionario_data ->> 'especialidade',
                COALESCE((v_convite.funcionario_data ->> 'nivel_permissao')::public.nivel_permissao, 'funcionario'),
                false
            );

            UPDATE public.funcionario_convites SET usado = true WHERE id = v_convite.id;
            RETURN NEW;
        END IF;
    END IF;

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

-- Devolve os dados do convite apenas para quem tem o token exato.
-- A tabela de convites não é legível pelo público; o acesso é só por aqui.
CREATE FUNCTION public.get_convite_por_token(p_token text)
    RETURNS TABLE (barbearia_id uuid, email text, expires_at timestamptz, funcionario_data jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT c.barbearia_id, c.email, c.expires_at, c.funcionario_data
        FROM public.funcionario_convites c
        WHERE c.token = p_token
          AND c.usado = false
          AND c.expires_at > now()
    $$;

-- Apaga a conta e tudo que depende dela em cascata. Só o backend pode chamar.
CREATE FUNCTION public.delete_user_complete(user_email text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT u.id INTO v_user_id FROM auth.users u WHERE u.email = user_email;

    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Usuário não encontrado com o email fornecido');
    END IF;

    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'message', 'Usuário deletado com sucesso', 'user_id', v_user_id::text);
END;
$$;


-- -----------------------------------------------------------------------------
-- Agenda
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.get_anonymous_appointment_limit() RETURNS integer
    LANGUAGE sql IMMUTABLE SET search_path = ''
    AS $$ SELECT 3 $$;

-- Quem agenda sem conta pode ter até 3 agendamentos futuros ativos por telefone
CREATE FUNCTION public.check_anonymous_appointment_limit(telefone_cliente text, user_id_param uuid DEFAULT NULL) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
BEGIN
    IF user_id_param IS NOT NULL THEN
        RETURN true;
    END IF;

    IF NULLIF(telefone_cliente, '') IS NULL THEN
        RETURN false;
    END IF;

    RETURN (
        SELECT count(*) < public.get_anonymous_appointment_limit()
        FROM public.agendamentos a
        WHERE a.cliente_telefone = telefone_cliente
          AND a.user_id IS NULL
          AND a.status IN ('pendente', 'confirmado')
          AND a.data_hora >= now()
    );
END;
$$;

-- Falso quando o profissional está de férias ou recesso na data
CREATE FUNCTION public.check_funcionario_disponibilidade(p_funcionario_id uuid, p_data_hora timestamptz) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT NOT EXISTS (
            SELECT 1 FROM public.funcionario_ausencias a
            WHERE a.funcionario_id = p_funcionario_id
              AND (p_data_hora AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN a.data_inicio AND a.data_fim
        )
    $$;

-- Horários reservados para montar a agenda pública. Visitantes não podem ler
-- agendamentos de outras pessoas, então esta função entrega só início, duração e
-- profissional, sem nome ou telefone de cliente.
CREATE FUNCTION public.horarios_ocupados(p_barbearia_id uuid, p_de timestamptz, p_ate timestamptz)
    RETURNS TABLE (data_hora timestamptz, duracao_minutos integer, funcionario_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT a.data_hora, s.duracao_minutos, a.funcionario_id
        FROM public.agendamentos a
        JOIN public.servicos s ON s.id = a.servico_id
        WHERE a.barbearia_id = p_barbearia_id
          AND a.data_hora >= p_de
          AND a.data_hora < p_ate
          AND a.status IN ('pendente', 'confirmado')
    $$;

-- Profissional sugerido quando o cliente não escolhe: o dono, ou o mais antigo
CREATE FUNCTION public.get_default_funcionario(barbearia_uuid uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT f.id FROM public.funcionarios f
        WHERE f.barbearia_id = barbearia_uuid
        ORDER BY f.is_owner DESC NULLS LAST, f.created_at
        LIMIT 1
    $$;

-- Validação central de todo agendamento, antes de gravar:
--
--   Dados recebidos
--        │
--        ▼
--   Limpa telefone, e-mail e nome
--        │
--        ▼
--   Telefone, e-mail e nome são válidos? ───── não ──► erro
--        │ sim
--        ▼
--   Serviço e profissional são desta barbearia? ── não ──► erro
--        │ sim
--        ▼
--   A data está no passado? ───────────────── sim ──► erro
--        │ não                       (só em agendamento novo ou reagendamento)
--        ▼
--   Sem conta e já tem 3 ativos? ──────────── sim ──► erro
--        │ não
--        ▼
--   Profissional de férias na data? ───────── sim ──► erro
--        │ não
--        ▼
--     Grava
--
-- Mudar apenas o status não revalida datas, para permitir finalizar ou cancelar
-- atendimentos antigos.
CREATE FUNCTION public.validar_agendamento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_agenda_mudou boolean := TG_OP = 'INSERT'
        OR NEW.data_hora IS DISTINCT FROM OLD.data_hora
        OR NEW.funcionario_id IS DISTINCT FROM OLD.funcionario_id;
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

    IF NOT EXISTS (SELECT 1 FROM public.servicos s WHERE s.id = NEW.servico_id AND s.barbearia_id = NEW.barbearia_id) THEN
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

    IF TG_OP = 'INSERT' AND NOT public.check_anonymous_appointment_limit(NEW.cliente_telefone, NEW.user_id) THEN
        -- O prefixo é lido pelo app para mostrar a mensagem certa
        RAISE EXCEPTION 'LIMITE_AGENDAMENTOS_ANONIMOS: Número máximo de agendamentos ativos atingido para este telefone. Finalize ou cancele agendamentos existentes antes de criar um novo.';
    END IF;

    RETURN NEW;
END;
$$;

-- Quando o atendimento é finalizado, deixa a avaliação pendente para o cliente
CREATE FUNCTION public.criar_feedback_ao_finalizar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
BEGIN
    IF NEW.status = 'finalizado' AND OLD.status IS DISTINCT FROM 'finalizado' AND NEW.user_id IS NOT NULL THEN
        INSERT INTO public.feedbacks (agendamento_id, user_id, barbearia_id, status)
        VALUES (NEW.id, NEW.user_id, NEW.barbearia_id, 'pendente')
        ON CONFLICT (agendamento_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Quando o cliente conclui a avaliação, marca o agendamento como avaliado.
-- Fica aqui porque clientes não têm permissão para alterar agendamentos.
CREATE FUNCTION public.marcar_agendamento_avaliado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
BEGIN
    IF NEW.status = 'concluido' THEN
        UPDATE public.agendamentos SET avaliado = true WHERE id = NEW.agendamento_id;
    END IF;

    RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- Equipe e perfis
-- -----------------------------------------------------------------------------

-- Ao vincular alguém à equipe, o perfil passa a ser de funcionário dessa barbearia.
-- O dono é ignorado para não perder o papel de admin, e quem já pertence a outra
-- barbearia não é movido.
CREATE FUNCTION public.sincronizar_perfil_funcionario() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
BEGIN
    IF NEW.user_id IS NOT NULL AND NOT COALESCE(NEW.is_owner, false) THEN
        UPDATE public.profiles
        SET barbearia_id = NEW.barbearia_id,
            role = CASE WHEN role = 'admin' THEN role ELSE 'funcionario' END
        WHERE user_id = NEW.user_id
          AND (barbearia_id IS NULL OR barbearia_id = NEW.barbearia_id);
    END IF;

    RETURN NEW;
END;
$$;

-- Impede que alguém se promova editando o próprio perfil pelo app:
--
--   Pedido do app para alterar um perfil
--        │
--        ├─ mudou a barbearia? ───────────────────────── erro
--        │
--        └─ mudou o papel?
--               ├─ é admin da mesma barbearia, alterando
--               │  outra pessoa, para admin ou funcionário?  ── permite
--               └─ qualquer outro caso ───────────────────── erro
--
-- Roda com a permissão de quem chamou (sem SECURITY DEFINER). Assim as rotinas
-- internas e o backend, que rodam com outro papel, não passam por este bloqueio.
CREATE FUNCTION public.proteger_campos_perfil() RETURNS trigger
    LANGUAGE plpgsql SET search_path = ''
    AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF NEW.barbearia_id IS DISTINCT FROM OLD.barbearia_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Não é permitido alterar a barbearia do perfil';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role AND NOT (
        public.user_is_admin_of_barbearia(OLD.barbearia_id)
        AND OLD.user_id <> auth.uid()
        AND OLD.role IN ('admin', 'funcionario')
        AND NEW.role IN ('admin', 'funcionario')
    ) THEN
        RAISE EXCEPTION 'Sem permissão para alterar o papel do perfil';
    END IF;

    RETURN NEW;
END;
$$;

-- Usada em todas as tabelas que têm a coluna updated_at
CREATE FUNCTION public.definir_updated_at() RETURNS trigger
    LANGUAGE plpgsql SET search_path = ''
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- Fidelidade
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.get_recompensas_disponiveis(p_barbearia_id uuid, p_cliente_telefone text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_pontos integer;
BEGIN
    SELECT COALESCE(max(f.pontos), 0) INTO v_pontos
    FROM public.fidelidade f
    WHERE f.barbearia_id = p_barbearia_id AND f.cliente_telefone = p_cliente_telefone;

    RETURN json_build_object(
        'pontos_cliente', v_pontos,
        'recompensas', COALESCE((
            SELECT json_agg(json_build_object(
                'id', r.id,
                'nome', r.nome,
                'descricao', r.descricao,
                'pontos_necessarios', r.pontos_necessarios,
                'pode_resgatar', v_pontos >= r.pontos_necessarios
            ) ORDER BY r.pontos_necessarios)
            FROM public.recompensas r
            WHERE r.barbearia_id = p_barbearia_id AND r.ativo
        ), '[]'::json)
    );
END;
$$;

-- Troca pontos por uma recompensa:
--
--   Pedido de resgate
--        │
--        ▼
--   É o dono do telefone ou da equipe? ─── não ──► recusa
--        │ sim
--        ▼
--   A recompensa existe e está ativa? ──── não ──► recusa
--        │ sim
--        ▼
--   Trava o saldo do cliente   (dois resgates simultâneos não gastam o mesmo ponto)
--        │
--        ▼
--   Tem pontos suficientes? ────────────── não ──► recusa
--        │ sim
--        ▼
--   Registra o resgate e desconta os pontos
CREATE FUNCTION public.resgatar_recompensa(p_recompensa_id uuid, p_cliente_telefone text, p_barbearia_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
DECLARE
    v_recompensa public.recompensas%ROWTYPE;
    v_pontos     integer;
BEGIN
    -- COALESCE: sem telefone cadastrado a comparação daria NULL e o IF não barraria
    IF NOT (public.user_is_staff_of_barbearia(p_barbearia_id)
            OR COALESCE(public.get_user_phone() = p_cliente_telefone, false)) THEN
        RETURN json_build_object('success', false, 'message', 'Sem permissão para este resgate');
    END IF;

    SELECT r.* INTO v_recompensa
    FROM public.recompensas r
    WHERE r.id = p_recompensa_id AND r.barbearia_id = p_barbearia_id AND r.ativo;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Recompensa não encontrada ou inativa');
    END IF;

    SELECT f.pontos INTO v_pontos
    FROM public.fidelidade f
    WHERE f.barbearia_id = p_barbearia_id AND f.cliente_telefone = p_cliente_telefone
    FOR UPDATE;

    IF NOT FOUND OR v_pontos < v_recompensa.pontos_necessarios THEN
        RETURN json_build_object('success', false, 'message', 'Pontos insuficientes');
    END IF;

    INSERT INTO public.resgates_recompensas (recompensa_id, cliente_telefone, barbearia_id, pontos_utilizados)
    VALUES (p_recompensa_id, p_cliente_telefone, p_barbearia_id, v_recompensa.pontos_necessarios);

    UPDATE public.fidelidade
    SET pontos = pontos - v_recompensa.pontos_necessarios
    WHERE barbearia_id = p_barbearia_id AND cliente_telefone = p_cliente_telefone;

    RETURN json_build_object(
        'success', true,
        'message', 'Recompensa resgatada com sucesso!',
        'recompensa', v_recompensa.nome,
        'pontos_utilizados', v_recompensa.pontos_necessarios
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Assinatura
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.barbearia_tem_assinatura_ativa(p_barbearia_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM public.assinaturas a
            WHERE a.barbearia_id = p_barbearia_id
              AND a.status = 'ativa'
              AND (a.data_fim IS NULL OR a.data_fim > now())
        )
    $$;

CREATE FUNCTION public.get_assinatura_ativa(p_barbearia_id uuid) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $$
        SELECT row_to_json(a.*)
        FROM public.assinaturas a
        WHERE a.barbearia_id = p_barbearia_id
          AND a.status = 'ativa'
          AND (a.data_fim IS NULL OR a.data_fim > now())
          AND public.user_is_admin_of_barbearia(p_barbearia_id)
    $$;
