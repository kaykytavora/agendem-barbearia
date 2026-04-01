--
-- PostgreSQL database dump
--

-- (removed \restrict for Supabase compatibility)

-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Schema public already exists in Supabase, skipping CREATE SCHEMA


--
-- Name: agendamento_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agendamento_status AS ENUM (
    'pendente',
    'confirmado',
    'cancelado',
    'finalizado'
);


--
-- Name: metodo_pagamento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.metodo_pagamento AS ENUM (
    'cartao_credito',
    'cartao_debito',
    'pix',
    'boleto',
    'transferencia'
);


--
-- Name: nivel_permissao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nivel_permissao AS ENUM (
    'funcionario',
    'gerente',
    'dono'
);


--
-- Name: status_assinatura; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.status_assinatura AS ENUM (
    'ativa',
    'cancelada',
    'suspensa',
    'vencida',
    'teste'
);


--
-- Name: tipo_plano; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_plano AS ENUM (
    'basico',
    'premium',
    'empresarial'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'cliente',
    'admin',
    'funcionario'
);


--
-- Name: accept_employee_invite(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_employee_invite(invite_token text, employee_password text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  invite_data RECORD;
  new_employee_id UUID;
BEGIN
  -- Validate invite token
  SELECT * INTO invite_data
  FROM funcionario_convites
  WHERE token = invite_token
    AND usado = false
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;

  -- Check if employee already exists
  IF EXISTS (
    SELECT 1 FROM funcionarios
    WHERE nome = (invite_data.funcionario_data->>'nome')::TEXT
      AND barbearia_id = invite_data.barbearia_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Funcionário já existe nesta barbearia');
  END IF;

  -- Create employee record - AGORA COM TODOS OS CAMPOS DISPONÍVEIS
  INSERT INTO funcionarios (
    user_id,
    barbearia_id,
    nome,
    nivel,
    created_at,
    updated_at
  ) VALUES (
    NULL, -- Will be filled when auth account is created
    invite_data.barbearia_id,
    (invite_data.funcionario_data->>'nome')::TEXT,
    (invite_data.funcionario_data->>'nivel_permissao')::nivel_permissao,
    NOW(),
    NOW()
  ) RETURNING id INTO new_employee_id;

  -- ADICIONAR: Inserir dados extras se a tabela tiver mais colunas
  -- (como especialidade, foto_url, email, etc.)
  BEGIN
    -- Tentar atualizar com campos extras (se existirem na tabela)
    UPDATE funcionarios SET
      especialidade = COALESCE((invite_data.funcionario_data->>'especialidade')::TEXT, ''),
      foto_url = COALESCE((invite_data.funcionario_data->>'foto_url')::TEXT, ''),
      email = invite_data.email
    WHERE id = new_employee_id;
  EXCEPTION
    WHEN undefined_column THEN
      -- Se alguma coluna não existir, continuar sem erro
      NULL;
  END;

  -- Mark invite as used
  UPDATE funcionario_convites
  SET usado = true
  WHERE id = invite_data.id;

  RETURN json_build_object(
    'success', true,
    'employee_id', new_employee_id,
    'message', 'Funcionário registrado com sucesso',
    'nome', (invite_data.funcionario_data->>'nome')::TEXT,
    'nivel', (invite_data.funcionario_data->>'nivel_permissao')::TEXT,
    'especialidade', COALESCE((invite_data.funcionario_data->>'especialidade')::TEXT, ''),
    'email', invite_data.email
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$;


--
-- Name: FUNCTION accept_employee_invite(invite_token text, employee_password text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.accept_employee_invite(invite_token text, employee_password text) IS 'Accepts employee invitation by creating employee record and marking invite as used.
Returns JSON with success status and employee_id or error message.';


--
-- Name: barbearia_tem_assinatura_ativa(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.barbearia_tem_assinatura_ativa(p_barbearia_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.assinaturas 
        WHERE barbearia_id = p_barbearia_id 
        AND status = 'ativa' 
        AND (data_fim IS NULL OR data_fim > now())
    );
$$;


--
-- Name: check_anonymous_appointment_limit(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_anonymous_appointment_limit(telefone_cliente text, user_id_param uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    limite_anonimo INTEGER := 3;
    agendamentos_ativos INTEGER;
BEGIN
    -- Se o usuário está logado, não aplicar limite
    IF user_id_param IS NOT NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Se telefone é null ou vazio, rejeitar
    IF telefone_cliente IS NULL OR telefone_cliente = '' THEN
        RETURN FALSE;
    END IF;
    
    -- Contar agendamentos ativos para o telefone
    SELECT COUNT(*)
    INTO agendamentos_ativos
    FROM agendamentos
    WHERE cliente_telefone = telefone_cliente
    AND status IN ('pendente', 'confirmado')
    AND user_id IS NULL;
    
    RETURN agendamentos_ativos < limite_anonimo;
END;
$$;


--
-- Name: check_funcionario_disponibilidade(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_funcionario_disponibilidade(p_funcionario_id uuid, p_data_hora timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_esta_ausente BOOLEAN;
BEGIN
  -- Verifica se o funcionário está em período de ausência
  SELECT EXISTS (
    SELECT 1
    FROM public.funcionario_ausencias
    WHERE funcionario_id = p_funcionario_id
      AND p_data_hora::DATE BETWEEN data_inicio AND data_fim
  ) INTO v_esta_ausente;
  
  -- Retorna TRUE se está disponível (NOT ausente)
  RETURN NOT v_esta_ausente;
END;
$$;


--
-- Name: check_if_user_exists(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_if_user_exists(p_email text, p_phone text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_email_exists boolean := false;
    v_phone_exists boolean := false;
    v_result json;
BEGIN
    -- Verificar se email já existe
    IF p_email IS NOT NULL AND p_email != '' THEN
        SELECT EXISTS (
            SELECT 1 FROM auth.users WHERE email = p_email
        ) INTO v_email_exists;
    END IF;
    
    -- Verificar se telefone já existe (apenas se fornecido)
    IF p_phone IS NOT NULL AND p_phone != '' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles WHERE phone = p_phone
        ) INTO v_phone_exists;
    END IF;
    
    -- Retornar resultado em JSON
    v_result := json_build_object(
        'email_exists', v_email_exists,
        'phone_exists', v_phone_exists,
        'user_exists', (v_email_exists OR v_phone_exists)
    );
    
    RETURN v_result;
END;
$$;


--
-- Name: check_rate_limit(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(operation_type text, user_identifier text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  last_attempt timestamp;
  attempt_count integer;
BEGIN
  -- For demonstration - in production, implement proper rate limiting
  -- This is a placeholder for rate limiting logic
  RETURN true;
END;
$$;


--
-- Name: create_feedback_on_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_feedback_on_completion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Só executa se o status mudou para 'finalizado' e tinha um status diferente antes
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    -- Só cria feedback se user_id não for null
    IF NEW.user_id IS NOT NULL THEN
      -- Verifica se já não existe um feedback para este agendamento (evita duplicatas)
      IF NOT EXISTS (
        SELECT 1 FROM public.feedbacks
        WHERE agendamento_id = NEW.id
      ) THEN
        INSERT INTO public.feedbacks (
          agendamento_id,
          user_id,
          barbearia_id,
          status
        ) VALUES (
          NEW.id,
          NEW.user_id,
          NEW.barbearia_id,
          'pendente'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: delete_user_complete(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_complete(user_email text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
    user_uuid uuid;
    result json;
BEGIN
    -- Buscar o user_id pelo email
    SELECT id INTO user_uuid
    FROM auth.users
    WHERE email = user_email;

    IF user_uuid IS NULL THEN
        result := json_build_object(
            'success', false,
            'message', 'Usuário não encontrado com o email fornecido'
        );
        RETURN result;
    END IF;

    -- Deletar primeiro os dados da aplicação (profiles será deletado automaticamente via cascade se configurado)
    DELETE FROM public.profiles WHERE user_id = user_uuid;

    -- Deletar o usuário da tabela auth.users
    DELETE FROM auth.users WHERE id = user_uuid;

    result := json_build_object(
        'success', true,
        'message', 'Usuário deletado com sucesso',
        'user_id', user_uuid::text
    );

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := json_build_object(
            'success', false,
            'message', 'Erro ao deletar usuário: ' || SQLERRM
        );
        RETURN result;
END;
$$;


--
-- Name: generate_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_slug(text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
BEGIN
  RETURN lower(regexp_replace($1, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$_$;


--
-- Name: get_anonymous_appointment_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_anonymous_appointment_limit() RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    -- Por enquanto retorna 3, mas pode ser facilmente modificado
    -- Em futuro pode consultar uma tabela de configuração
    RETURN 3;
END;
$$;


--
-- Name: get_assinatura_ativa(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_assinatura_ativa(p_barbearia_id uuid) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT row_to_json(a.*) 
    FROM public.assinaturas a
    WHERE a.barbearia_id = p_barbearia_id 
    AND a.status = 'ativa'
    AND (a.data_fim IS NULL OR a.data_fim > now())
    ORDER BY a.created_at DESC
    LIMIT 1;
$$;


--
-- Name: get_current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_user_role() RETURNS public.user_role
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN (
    SELECT p.role
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;


--
-- Name: get_default_funcionario(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_default_funcionario(barbearia_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Retorna o funcionário dono, ou o primeiro funcionário da barbearia
  RETURN (
    SELECT id
    FROM public.funcionarios
    WHERE barbearia_id = barbearia_uuid
    ORDER BY is_owner DESC, created_at ASC
    LIMIT 1
  );
END;
$$;


--
-- Name: get_public_profile_info(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_profile_info(profile_user_ids uuid[]) RETURNS TABLE(user_id uuid, name text, role public.user_role)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    p.user_id,
    p.name,
    p.role
  FROM public.profiles p
  WHERE p.user_id = ANY(profile_user_ids)
    AND (
      -- Só retorna dados se o usuário solicitante tem permissão
      auth.uid() = p.user_id OR  -- Próprio perfil
      (
        get_current_user_role() IN ('admin', 'funcionario') AND
        get_user_barbearia_id(auth.uid()) = p.barbearia_id
      )
    );
$$;


--
-- Name: get_recompensas_disponiveis(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recompensas_disponiveis(p_barbearia_id uuid, p_cliente_telefone text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_pontos_cliente integer := 0;
    v_recompensas json;
BEGIN
    -- Buscar pontos do cliente
    SELECT pontos INTO v_pontos_cliente
    FROM public.fidelidade
    WHERE barbearia_id = p_barbearia_id AND cliente_telefone = p_cliente_telefone;
    
    -- Buscar recompensas da barbearia
    SELECT json_agg(
        json_build_object(
            'id', r.id,
            'nome', r.nome,
            'descricao', r.descricao,
            'pontos_necessarios', r.pontos_necessarios,
            'pode_resgatar', (v_pontos_cliente >= r.pontos_necessarios)
        ) ORDER BY r.pontos_necessarios
    ) INTO v_recompensas
    FROM public.recompensas r
    WHERE r.barbearia_id = p_barbearia_id AND r.ativo = true;
    
    RETURN json_build_object(
        'pontos_cliente', COALESCE(v_pontos_cliente, 0),
        'recompensas', COALESCE(v_recompensas, '[]'::json)
    );
END;
$$;


--
-- Name: get_user_barbearia_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_barbearia_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN (
    SELECT p.barbearia_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;


--
-- Name: get_user_barbearia_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_barbearia_id(user_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
      BEGIN
        RETURN (
          SELECT p.barbearia_id
          FROM public.profiles p
          WHERE p.user_id = user_uuid
          LIMIT 1
        );
      END;
      $$;


--
-- Name: get_user_profile_cached(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_profile_cached() RETURNS TABLE(user_id uuid, role public.user_role, barbearia_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT p.user_id, p.role, p.barbearia_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(user_uuid uuid) RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE user_id = user_uuid;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    new_barbearia_id uuid;
    invite_record record;
BEGIN
    -- Se a role for 'cliente', apenas insere no profiles e termina.
    IF (NEW.raw_user_meta_data ->> 'role') = 'cliente' THEN
        INSERT INTO public.profiles (user_id, name, phone, role)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
            COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
            'cliente'::public.user_role
        );
        RETURN NEW;
    END IF;

    -- Verificar se é um funcionário sendo criado via convite
    IF (NEW.raw_user_meta_data ->> 'role') = 'funcionario' THEN
        -- Buscar convite ativo pelo email
        SELECT * INTO invite_record
        FROM public.funcionario_convites
        WHERE email = NEW.email
        AND usado = FALSE
        AND expires_at > now()
        LIMIT 1;

        IF FOUND THEN
            -- Inserir perfil do funcionário
            INSERT INTO public.profiles (user_id, name, phone, role, barbearia_id)
            VALUES (
                NEW.id,
                COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
                COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
                'funcionario'::public.user_role,
                invite_record.barbearia_id
            );

            -- Criar registro na tabela funcionarios
            INSERT INTO public.funcionarios (
                user_id,
                nome,
                nivel,
                barbearia_id,
                is_owner
            )
            VALUES (
                NEW.id,
                (invite_record.funcionario_data ->> 'nome')::text,
                COALESCE((invite_record.funcionario_data ->> 'nivel_permissao')::public.nivel_permissao, 'funcionario'::public.nivel_permissao),
                invite_record.barbearia_id,
                FALSE
            );

            -- Marcar convite como usado
            UPDATE public.funcionario_convites
            SET usado = TRUE
            WHERE id = invite_record.id;

            RETURN NEW;
        END IF;
    END IF;

    -- Fluxo padrão para administradores (criar barbearia)
    INSERT INTO public.profiles (user_id, name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
        'admin'::public.user_role
    );

    -- Se for admin e tiver nome da barbearia, criar a barbearia
    IF (NEW.raw_user_meta_data ->> 'barbershop_name') IS NOT NULL THEN
        -- Criar a barbearia com slug
        INSERT INTO public.barbearias (nome, cidade, slug)
        VALUES (
            NEW.raw_user_meta_data ->> 'barbershop_name',
            'Não informado',
            generate_slug(NEW.raw_user_meta_data ->> 'barbershop_name')
        )
        RETURNING id INTO new_barbearia_id;

        -- Associar o usuário à barbearia
        UPDATE public.profiles
        SET barbearia_id = new_barbearia_id
        WHERE user_id = NEW.id;

        -- Inserir o dono como funcionário com nivel 'dono' (valor correto do enum)
        INSERT INTO public.funcionarios (
            user_id,
            barbearia_id,
            nome,
            nivel,
            is_owner,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            new_barbearia_id,
            COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
            'dono'::public.nivel_permissao,  -- Corrigido: era 'admin', agora é 'dono'
            TRUE,
            NOW(),
            NOW()
        );

        -- Criar horários de funcionamento padrão
        INSERT INTO public.horarios_funcionamento (barbearia_id, dia_semana, hora_abre, hora_fecha, fechado)
        VALUES
            (new_barbearia_id, 1, '08:00', '18:00', false),
            (new_barbearia_id, 2, '08:00', '18:00', false),
            (new_barbearia_id, 3, '08:00', '18:00', false),
            (new_barbearia_id, 4, '08:00', '18:00', false),
            (new_barbearia_id, 5, '08:00', '18:00', false),
            (new_barbearia_id, 6, '08:00', '17:00', false),
            (new_barbearia_id, 0, NULL, NULL, true);
    END IF;

  RETURN NEW;
END;
$$;


--
-- Name: insert_owner_as_employee(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_owner_as_employee() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  owner_profile RECORD;
BEGIN
  -- Buscar informações do perfil do dono
  SELECT user_id, name INTO owner_profile
  FROM public.profiles
  WHERE barbearia_id = NEW.id
  AND role = 'admin'
  LIMIT 1;

  -- Se encontrou o perfil do admin/dono, inserir como funcionário
  IF FOUND THEN
    INSERT INTO public.funcionarios (
      user_id,
      barbearia_id,
      nome,
      nivel,
      is_owner,
      created_at,
      updated_at
    ) VALUES (
      owner_profile.user_id,
      NEW.id,
      owner_profile.name,
      'admin'::nivel_permissao,
      TRUE,
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING; -- Evita duplicatas
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: resgatar_recompensa(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resgatar_recompensa(p_recompensa_id uuid, p_cliente_telefone text, p_barbearia_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_recompensa record;
    v_pontos_cliente integer;
    v_resultado json;
BEGIN
    -- Buscar dados da recompensa
    SELECT * INTO v_recompensa
    FROM public.recompensas
    WHERE id = p_recompensa_id AND barbearia_id = p_barbearia_id AND ativo = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Recompensa não encontrada ou inativa');
    END IF;
    
    -- Buscar pontos do cliente
    SELECT pontos INTO v_pontos_cliente
    FROM public.fidelidade
    WHERE barbearia_id = p_barbearia_id AND cliente_telefone = p_cliente_telefone;
    
    IF NOT FOUND OR v_pontos_cliente < v_recompensa.pontos_necessarios THEN
        RETURN json_build_object('success', false, 'message', 'Pontos insuficientes');
    END IF;
    
    -- Realizar o resgate
    BEGIN
        -- Inserir registro de resgate
        INSERT INTO public.resgates_recompensas (
            recompensa_id, cliente_telefone, barbearia_id, pontos_utilizados
        ) VALUES (
            p_recompensa_id, p_cliente_telefone, p_barbearia_id, v_recompensa.pontos_necessarios
        );
        
        -- Deduzir pontos do cliente
        UPDATE public.fidelidade
        SET pontos = pontos - v_recompensa.pontos_necessarios,
            updated_at = now()
        WHERE barbearia_id = p_barbearia_id AND cliente_telefone = p_cliente_telefone;
        
        v_resultado := json_build_object(
            'success', true, 
            'message', 'Recompensa resgatada com sucesso!',
            'recompensa', v_recompensa.nome,
            'pontos_utilizados', v_recompensa.pontos_necessarios
        );
        
        RETURN v_resultado;
        
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'Erro ao processar resgate');
    END;
END;
$$;


--
-- Name: update_profile_on_employee_creation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profile_on_employee_creation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Atualizar o perfil do usuário para funcionário
  UPDATE profiles
  SET
    role = 'funcionario',
    barbearia_id = NEW.barbearia_id,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_assinaturas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_assinaturas() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_ausencias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_ausencias() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_fidelidade_configuracoes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_fidelidade_configuracoes() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_recompensas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_recompensas() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: user_can_access_barbearia(uuid, public.user_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_access_barbearia(target_barbearia_id uuid, required_roles public.user_role[]) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Validação de entrada
  IF target_barbearia_id IS NULL OR required_roles IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Buscar perfil do usuário uma única vez
  SELECT role, barbearia_id INTO user_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Verificar se encontrou o perfil e se tem permissão
  RETURN (
    user_profile.role = ANY(required_roles)
    AND user_profile.barbearia_id = target_barbearia_id
  );
END;
$$;


--
-- Name: user_is_admin_of_barbearia(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_admin_of_barbearia(check_barbearia_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Verificar se o usuário atual é admin da barbearia especificada
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'admin'
    AND p.barbearia_id = check_barbearia_id
    AND check_barbearia_id IS NOT NULL
  );
END;
$$;


--
-- Name: user_is_staff_of_barbearia(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_staff_of_barbearia(check_barbearia_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Verificar se o usuário atual é funcionário/admin da barbearia especificada
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('admin', 'funcionario')
    AND p.barbearia_id = check_barbearia_id
    AND check_barbearia_id IS NOT NULL
  );
END;
$$;


--
-- Name: validate_and_sanitize_agendamento_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_and_sanitize_agendamento_data() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _cleaned_phone text;
  _cleaned_email text;
BEGIN
  -- Sanitizar telefone: remover caracteres não numéricos
  IF NEW.cliente_telefone IS NOT NULL THEN
    _cleaned_phone := regexp_replace(NEW.cliente_telefone, '[^0-9]', '', 'g');
    NEW.cliente_telefone := _cleaned_phone;
  END IF;

  -- Sanitizar email: converter para minúsculas e remover espaços
  IF NEW.cliente_email IS NOT NULL THEN
    _cleaned_email := lower(trim(NEW.cliente_email));
    NEW.cliente_email := _cleaned_email;
  END IF;

  -- Sanitizar nome: remover espaços extras
  IF NEW.cliente_nome IS NOT NULL THEN
    NEW.cliente_nome := trim(regexp_replace(NEW.cliente_nome, '\s+', ' ', 'g'));
  END IF;

  -- Validar telefone: deve ter entre 10 e 11 dígitos (formato brasileiro)
  IF NEW.cliente_telefone IS NOT NULL AND NEW.cliente_telefone != '' THEN
    IF length(NEW.cliente_telefone) < 10 OR length(NEW.cliente_telefone) > 11 THEN
      RAISE EXCEPTION 'Telefone deve ter 10 ou 11 dígitos';
    END IF;
  END IF;

  -- Validar email com regex básico
  IF NEW.cliente_email IS NOT NULL AND NEW.cliente_email != '' THEN
    IF NEW.cliente_email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
      RAISE EXCEPTION 'Email inválido';
    END IF;
  END IF;

  -- Validar nome: deve ter pelo menos 2 caracteres
  IF NEW.cliente_nome IS NOT NULL AND length(trim(NEW.cliente_nome)) < 2 THEN
    RAISE EXCEPTION 'Nome deve ter pelo menos 2 caracteres';
  END IF;

  -- Validar data/hora: não permitir agendamentos em datas passadas
  -- IMPORTANTE: Esta validação só se aplica a NOVOS agendamentos (INSERT)
  -- Para atualizações (UPDATE), só validar se a data_hora foi alterada
  IF TG_OP = 'INSERT' THEN
    -- Para novos agendamentos, não permitir datas passadas
    IF NEW.data_hora < NOW() - INTERVAL '1 hour' THEN
      RAISE EXCEPTION 'Não é possível agendar para datas passadas';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Para atualizações, só validar data se ela foi realmente alterada
    -- Isso permite atualizar status de agendamentos passados (ex: finalizar)
    IF NEW.data_hora IS DISTINCT FROM OLD.data_hora THEN
      -- Se a data foi alterada (reagendamento), não permitir datas passadas
      IF NEW.data_hora < NOW() - INTERVAL '1 hour' THEN
        RAISE EXCEPTION 'Não é possível reagendar para datas passadas';
      END IF;
    END IF;
    -- Se apenas o status foi alterado, permitir a atualização
  END IF;

  RETURN NEW;
END;
$_$;


--
-- Name: FUNCTION validate_and_sanitize_agendamento_data(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_and_sanitize_agendamento_data() IS 'Valida e sanitiza dados de agendamentos para proteger contra XSS, SQL injection e dados corrompidos. 
Funciona para agendamentos autenticados e anônimos.
Validações aplicadas:
- cliente_nome: remove HTML, valida tamanho (2-100 chars), permite apenas letras e acentos
- cliente_telefone: valida formato, mínimo 10 dígitos
- cliente_email: valida formato RFC 5322, normaliza lowercase
- data_hora: impede agendamentos no passado';


--
-- Name: validate_anonymous_appointment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_anonymous_appointment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Verificar se o agendamento anônimo excede o limite
    IF NOT check_anonymous_appointment_limit(NEW.cliente_telefone, NEW.user_id) THEN
        RAISE EXCEPTION 'LIMITE_AGENDAMENTOS_ANONIMOS: Número máximo de agendamentos ativos atingido para este telefone. Finalize ou cancele agendamentos existentes antes de criar um novo.'
            USING ERRCODE = 'P0001';
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: validate_funcionario_availability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_funcionario_availability() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Se tem funcionário específico, validar disponibilidade
  IF NEW.funcionario_id IS NOT NULL THEN
    IF NOT check_funcionario_disponibilidade(NEW.funcionario_id, NEW.data_hora) THEN
      RAISE EXCEPTION 'Funcionário não disponível nesta data (férias/recesso)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agendamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agendamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barbearia_id uuid NOT NULL,
    servico_id uuid NOT NULL,
    funcionario_id uuid,
    user_id uuid,
    cliente_nome text NOT NULL,
    cliente_telefone text NOT NULL,
    cliente_email text,
    data_hora timestamp with time zone NOT NULL,
    status public.agendamento_status DEFAULT 'pendente'::public.agendamento_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    origem text GENERATED ALWAYS AS (
CASE
    WHEN (user_id IS NULL) THEN 'anonimo'::text
    ELSE 'cliente'::text
END) STORED,
    avaliado boolean DEFAULT false NOT NULL,
    CONSTRAINT agendamentos_cliente_telefone_valid CHECK (((user_id IS NOT NULL) OR ((user_id IS NULL) AND (cliente_telefone IS NOT NULL) AND (length(regexp_replace(cliente_telefone, '[^0-9]'::text, ''::text, 'g'::text)) >= 10))))
);


--
-- Name: COLUMN agendamentos.origem; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agendamentos.origem IS 'Coluna gerada automaticamente que identifica se o agendamento foi criado por um cliente logado ou anônimo';


--
-- Name: COLUMN agendamentos.avaliado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agendamentos.avaliado IS 'Indica se o agendamento já foi avaliado pelo cliente';


--
-- Name: assinaturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assinaturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barbearia_id uuid NOT NULL,
    tipo_plano public.tipo_plano DEFAULT 'basico'::public.tipo_plano NOT NULL,
    status public.status_assinatura DEFAULT 'teste'::public.status_assinatura NOT NULL,
    data_inicio timestamp with time zone DEFAULT now() NOT NULL,
    data_fim timestamp with time zone,
    data_cancelamento timestamp with time zone,
    valor_mensal numeric(10,2) DEFAULT 0.00 NOT NULL,
    moeda character varying(3) DEFAULT 'BRL'::character varying NOT NULL,
    metodo_pagamento public.metodo_pagamento,
    stripe_subscription_id text,
    stripe_customer_id text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    operation text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: barbearias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barbearias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    logo_url text,
    slug text,
    endereco text,
    cidade text NOT NULL,
    bairro text,
    cep text,
    email_contato text,
    telefone text,
    cores_personalizadas jsonb DEFAULT '{}'::jsonb,
    modo_tema text DEFAULT 'dark'::text,
    gallery_urls text[] DEFAULT ARRAY[]::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fidelidade_ativa boolean DEFAULT true NOT NULL,
    descricao text,
    notificacoes_ativa boolean DEFAULT true,
    CONSTRAINT barbearias_modo_tema_check CHECK ((modo_tema = ANY (ARRAY['dark'::text, 'light'::text])))
);


--
-- Name: barbearias_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.barbearias_public WITH (security_invoker='on') AS
 SELECT id,
    nome,
    cidade,
    endereco,
    telefone,
    logo_url,
    gallery_urls,
    slug,
    modo_tema,
    cores_personalizadas
   FROM public.barbearias;


--
-- Name: categorias_servicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_servicos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text
);


--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agendamento_id uuid NOT NULL,
    user_id uuid NOT NULL,
    barbearia_id uuid NOT NULL,
    rating integer,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    response text,
    response_created_at timestamp with time zone,
    responded_by uuid,
    status text DEFAULT 'pendente'::text NOT NULL,
    anonimo boolean DEFAULT false,
    CONSTRAINT feedbacks_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: COLUMN feedbacks.rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feedbacks.rating IS 'Rating do feedback (1-5). Pode ser NULL quando o feedback é criado automaticamente pelo sistema e ainda não foi avaliado pelo cliente.';


--
-- Name: COLUMN feedbacks.response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feedbacks.response IS 'Resposta do barbeiro/funcionário ao feedback do cliente';


--
-- Name: COLUMN feedbacks.response_created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feedbacks.response_created_at IS 'Data e hora quando a resposta foi criada';


--
-- Name: COLUMN feedbacks.responded_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feedbacks.responded_by IS 'ID do funcionário que respondeu ao feedback';


--
-- Name: fidelidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fidelidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    barbearia_id uuid NOT NULL,
    pontos integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cliente_telefone text
);


--
-- Name: fidelidade_configuracoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fidelidade_configuracoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barbearia_id uuid NOT NULL,
    pontos_por_servico integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pontos_minimos_recompensa integer DEFAULT 100,
    dias_expiracao integer DEFAULT 365
);


--
-- Name: funcionario_ausencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcionario_ausencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funcionario_id uuid NOT NULL,
    barbearia_id uuid NOT NULL,
    tipo text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ausencia_datas_validas CHECK ((data_fim >= data_inicio)),
    CONSTRAINT funcionario_ausencias_tipo_check CHECK ((tipo = ANY (ARRAY['ferias'::text, 'recesso'::text, 'outro'::text])))
);


--
-- Name: funcionario_convites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcionario_convites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    barbearia_id uuid NOT NULL,
    funcionario_data jsonb NOT NULL,
    usado boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    token text
);


--
-- Name: funcionario_pausas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcionario_pausas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funcionario_id uuid NOT NULL,
    barbearia_id uuid NOT NULL,
    data date DEFAULT CURRENT_DATE NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fim time without time zone NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_horario_valido CHECK ((hora_fim > hora_inicio))
);


--
-- Name: funcionarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcionarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    barbearia_id uuid NOT NULL,
    nome text NOT NULL,
    nivel public.nivel_permissao DEFAULT 'funcionario'::public.nivel_permissao NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_owner boolean DEFAULT false,
    email text,
    especialidade text
);


--
-- Name: funcionarios_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.funcionarios_public WITH (security_invoker='on') AS
 SELECT id,
    nome,
    barbearia_id
   FROM public.funcionarios f;


--
-- Name: horarios_funcionamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios_funcionamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barbearia_id uuid NOT NULL,
    dia_semana integer NOT NULL,
    hora_abre time without time zone,
    hora_fecha time without time zone,
    fechado boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    role public.user_role DEFAULT 'cliente'::public.user_role NOT NULL,
    barbearia_id uuid,
    receber_lembretes_email boolean DEFAULT true,
    receber_lembretes_sms boolean DEFAULT false,
    consentimento_marketing boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recompensas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recompensas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barbearia_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text,
    pontos_necessarios integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recompensas_pontos_necessarios_check CHECK ((pontos_necessarios > 0))
);


--
-- Name: resgates_recompensas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resgates_recompensas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recompensa_id uuid NOT NULL,
    cliente_telefone text NOT NULL,
    barbearia_id uuid NOT NULL,
    pontos_utilizados integer NOT NULL,
    data_resgate timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'resgatado'::text NOT NULL,
    CONSTRAINT resgates_recompensas_status_check CHECK ((status = ANY (ARRAY['resgatado'::text, 'utilizado'::text, 'cancelado'::text])))
);


--
-- Name: servicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barbearia_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text,
    valor numeric(10,2) NOT NULL,
    duracao_minutos integer NOT NULL,
    categoria_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    categoria_id_2 uuid
);


--
-- Name: servicos_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.servicos_public WITH (security_invoker='on') AS
 SELECT id,
    nome,
    descricao,
    valor,
    duracao_minutos,
    barbearia_id
   FROM public.servicos s;


--
-- Name: agendamentos agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);


--
-- Name: assinaturas assinaturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: barbearias barbearias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barbearias
    ADD CONSTRAINT barbearias_pkey PRIMARY KEY (id);


--
-- Name: barbearias barbearias_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barbearias
    ADD CONSTRAINT barbearias_slug_key UNIQUE (slug);


--
-- Name: categorias_servicos categorias_servicos_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_servicos
    ADD CONSTRAINT categorias_servicos_nome_key UNIQUE (nome);


--
-- Name: categorias_servicos categorias_servicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_servicos
    ADD CONSTRAINT categorias_servicos_pkey PRIMARY KEY (id);


--
-- Name: feedbacks feedbacks_agendamento_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_agendamento_id_key UNIQUE (agendamento_id);


--
-- Name: feedbacks feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_pkey PRIMARY KEY (id);


--
-- Name: fidelidade fidelidade_barbearia_telefone_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fidelidade
    ADD CONSTRAINT fidelidade_barbearia_telefone_unique UNIQUE (barbearia_id, cliente_telefone);


--
-- Name: fidelidade_configuracoes fidelidade_configuracoes_barbearia_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fidelidade_configuracoes
    ADD CONSTRAINT fidelidade_configuracoes_barbearia_id_key UNIQUE (barbearia_id);


--
-- Name: fidelidade_configuracoes fidelidade_configuracoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fidelidade_configuracoes
    ADD CONSTRAINT fidelidade_configuracoes_pkey PRIMARY KEY (id);


--
-- Name: fidelidade fidelidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fidelidade
    ADD CONSTRAINT fidelidade_pkey PRIMARY KEY (id);


--
-- Name: funcionario_ausencias funcionario_ausencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_ausencias
    ADD CONSTRAINT funcionario_ausencias_pkey PRIMARY KEY (id);


--
-- Name: funcionario_convites funcionario_convites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_convites
    ADD CONSTRAINT funcionario_convites_pkey PRIMARY KEY (id);


--
-- Name: funcionario_pausas funcionario_pausas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_pausas
    ADD CONSTRAINT funcionario_pausas_pkey PRIMARY KEY (id);


--
-- Name: funcionarios funcionarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_pkey PRIMARY KEY (id);


--
-- Name: funcionarios funcionarios_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_user_id_key UNIQUE (user_id);


--
-- Name: horarios_funcionamento horarios_funcionamento_barbearia_id_dia_semana_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_funcionamento
    ADD CONSTRAINT horarios_funcionamento_barbearia_id_dia_semana_key UNIQUE (barbearia_id, dia_semana);


--
-- Name: horarios_funcionamento horarios_funcionamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_funcionamento
    ADD CONSTRAINT horarios_funcionamento_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: recompensas recompensas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas
    ADD CONSTRAINT recompensas_pkey PRIMARY KEY (id);


--
-- Name: resgates_recompensas resgates_recompensas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resgates_recompensas
    ADD CONSTRAINT resgates_recompensas_pkey PRIMARY KEY (id);


--
-- Name: servicos servicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT servicos_pkey PRIMARY KEY (id);


--
-- Name: assinaturas unique_barbearia_ativa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT unique_barbearia_ativa UNIQUE (barbearia_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: funcionario_pausas unique_pausa_funcionario; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_pausas
    ADD CONSTRAINT unique_pausa_funcionario UNIQUE (funcionario_id, data, hora_inicio);


--
-- Name: idx_agendamentos_avaliado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_avaliado ON public.agendamentos USING btree (avaliado);


--
-- Name: idx_agendamentos_barbearia_datahora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_barbearia_datahora ON public.agendamentos USING btree (barbearia_id, data_hora);


--
-- Name: idx_agendamentos_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_origem ON public.agendamentos USING btree (origem);


--
-- Name: idx_agendamentos_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_telefone ON public.agendamentos USING btree (cliente_telefone);


--
-- Name: idx_agendamentos_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_user ON public.agendamentos USING btree (user_id);


--
-- Name: idx_assinaturas_barbearia_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_barbearia_id ON public.assinaturas USING btree (barbearia_id);


--
-- Name: idx_assinaturas_data_fim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_data_fim ON public.assinaturas USING btree (data_fim);


--
-- Name: idx_assinaturas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_status ON public.assinaturas USING btree (status);


--
-- Name: idx_assinaturas_stripe_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_stripe_subscription ON public.assinaturas USING btree (stripe_subscription_id);


--
-- Name: idx_ausencias_barbearia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ausencias_barbearia ON public.funcionario_ausencias USING btree (barbearia_id);


--
-- Name: idx_ausencias_funcionario_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ausencias_funcionario_periodo ON public.funcionario_ausencias USING btree (funcionario_id, data_inicio, data_fim);


--
-- Name: idx_barbearias_descricao_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barbearias_descricao_search ON public.barbearias USING gin (to_tsvector('portuguese'::regconfig, descricao));


--
-- Name: idx_barbearias_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barbearias_updated_at ON public.barbearias USING btree (updated_at);


--
-- Name: idx_feedbacks_barbearia_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_barbearia_status ON public.feedbacks USING btree (barbearia_id, status);


--
-- Name: idx_feedbacks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_status ON public.feedbacks USING btree (status);


--
-- Name: idx_fidelidade_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fidelidade_telefone ON public.fidelidade USING btree (cliente_telefone);


--
-- Name: idx_funcionario_convites_barbearia_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionario_convites_barbearia_id ON public.funcionario_convites USING btree (barbearia_id);


--
-- Name: idx_funcionario_convites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionario_convites_email ON public.funcionario_convites USING btree (email);


--
-- Name: idx_funcionario_convites_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionario_convites_token ON public.funcionario_convites USING btree (token);


--
-- Name: idx_funcionario_pausas_barbearia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionario_pausas_barbearia ON public.funcionario_pausas USING btree (barbearia_id);


--
-- Name: idx_funcionario_pausas_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionario_pausas_data ON public.funcionario_pausas USING btree (data);


--
-- Name: idx_funcionario_pausas_funcionario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionario_pausas_funcionario ON public.funcionario_pausas USING btree (funcionario_id);


--
-- Name: idx_horarios_funcionamento_barbearia_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_horarios_funcionamento_barbearia_id ON public.horarios_funcionamento USING btree (barbearia_id);


--
-- Name: idx_profiles_auth_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_auth_lookup ON public.profiles USING btree (user_id, role, barbearia_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_profiles_barbearia_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_barbearia_id ON public.profiles USING btree (barbearia_id) WHERE (barbearia_id IS NOT NULL);


--
-- Name: idx_profiles_barbearia_role_fast; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_barbearia_role_fast ON public.profiles USING btree (barbearia_id, role) WHERE (barbearia_id IS NOT NULL);


--
-- Name: idx_profiles_barbearia_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_barbearia_staff ON public.profiles USING btree (barbearia_id, role, user_id) WHERE ((barbearia_id IS NOT NULL) AND (role = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])));


--
-- Name: idx_profiles_role_barbearia_optimized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role_barbearia_optimized ON public.profiles USING btree (role, barbearia_id) WHERE (barbearia_id IS NOT NULL);


--
-- Name: idx_profiles_user_id_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user_id_login ON public.profiles USING btree (user_id);


--
-- Name: idx_profiles_user_id_optimized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user_id_optimized ON public.profiles USING btree (user_id);


--
-- Name: idx_recompensas_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recompensas_ativo ON public.recompensas USING btree (ativo);


--
-- Name: idx_recompensas_barbearia_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recompensas_barbearia_id ON public.recompensas USING btree (barbearia_id);


--
-- Name: idx_resgates_barbearia_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resgates_barbearia_cliente ON public.resgates_recompensas USING btree (barbearia_id, cliente_telefone);


--
-- Name: idx_servicos_categoria_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_categoria_id ON public.servicos USING btree (categoria_id) WHERE (categoria_id IS NOT NULL);


--
-- Name: idx_servicos_categoria_id_2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_categoria_id_2 ON public.servicos USING btree (categoria_id_2) WHERE (categoria_id_2 IS NOT NULL);


--
-- Name: idx_servicos_categoria_id_2_fk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_categoria_id_2_fk ON public.servicos USING btree (categoria_id_2) WHERE (categoria_id_2 IS NOT NULL);


--
-- Name: idx_servicos_categorias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_categorias ON public.servicos USING btree (categoria_id, categoria_id_2) WHERE ((categoria_id IS NOT NULL) OR (categoria_id_2 IS NOT NULL));


--
-- Name: agendamentos trigger_create_feedback_on_completion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_create_feedback_on_completion AFTER UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.create_feedback_on_completion();


--
-- Name: barbearias trigger_insert_owner_as_employee; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_insert_owner_as_employee AFTER INSERT ON public.barbearias FOR EACH ROW EXECUTE FUNCTION public.insert_owner_as_employee();


--
-- Name: funcionarios trigger_update_profile_on_employee_creation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_profile_on_employee_creation AFTER INSERT ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_profile_on_employee_creation();


--
-- Name: recompensas trigger_update_recompensas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_recompensas_updated_at BEFORE UPDATE ON public.recompensas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_recompensas();


--
-- Name: agendamentos trigger_validate_anonymous_appointment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_anonymous_appointment BEFORE INSERT ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.validate_anonymous_appointment();


--
-- Name: agendamentos trigger_validate_funcionario_availability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_funcionario_availability BEFORE INSERT OR UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.validate_funcionario_availability();


--
-- Name: assinaturas update_assinaturas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assinaturas_updated_at BEFORE UPDATE ON public.assinaturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_assinaturas();


--
-- Name: funcionario_ausencias update_ausencias_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ausencias_updated_at BEFORE UPDATE ON public.funcionario_ausencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_ausencias();


--
-- Name: fidelidade_configuracoes update_fidelidade_configuracoes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fidelidade_configuracoes_updated_at BEFORE UPDATE ON public.fidelidade_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_fidelidade_configuracoes();


--
-- Name: funcionario_pausas update_funcionario_pausas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_funcionario_pausas_updated_at BEFORE UPDATE ON public.funcionario_pausas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_ausencias();


--
-- Name: agendamentos validate_agendamento_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_agendamento_before_insert BEFORE INSERT OR UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.validate_and_sanitize_agendamento_data();


--
-- Name: TRIGGER validate_agendamento_before_insert ON agendamentos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER validate_agendamento_before_insert ON public.agendamentos IS 'Executa validação e sanitização automática de dados antes de INSERT/UPDATE';


--
-- Name: agendamentos agendamentos_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: agendamentos agendamentos_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE SET NULL;


--
-- Name: agendamentos agendamentos_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servicos(id) ON DELETE CASCADE;


--
-- Name: agendamentos agendamentos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: assinaturas assinaturas_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: feedbacks feedbacks_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id) ON DELETE CASCADE;


--
-- Name: feedbacks feedbacks_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: feedbacks feedbacks_responded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: feedbacks feedbacks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: fidelidade fidelidade_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fidelidade
    ADD CONSTRAINT fidelidade_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: fidelidade_configuracoes fidelidade_configuracoes_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fidelidade_configuracoes
    ADD CONSTRAINT fidelidade_configuracoes_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: fidelidade fidelidade_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fidelidade
    ADD CONSTRAINT fidelidade_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: servicos fk_servicos_categoria_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT fk_servicos_categoria_id FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicos(id);


--
-- Name: servicos fk_servicos_categoria_id_2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT fk_servicos_categoria_id_2 FOREIGN KEY (categoria_id_2) REFERENCES public.categorias_servicos(id);


--
-- Name: funcionario_ausencias funcionario_ausencias_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_ausencias
    ADD CONSTRAINT funcionario_ausencias_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: funcionario_ausencias funcionario_ausencias_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_ausencias
    ADD CONSTRAINT funcionario_ausencias_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE CASCADE;


--
-- Name: funcionario_convites funcionario_convites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_convites
    ADD CONSTRAINT funcionario_convites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: funcionario_pausas funcionario_pausas_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_pausas
    ADD CONSTRAINT funcionario_pausas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: funcionario_pausas funcionario_pausas_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_pausas
    ADD CONSTRAINT funcionario_pausas_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE CASCADE;


--
-- Name: funcionarios funcionarios_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: funcionarios funcionarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: recompensas recompensas_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas
    ADD CONSTRAINT recompensas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: resgates_recompensas resgates_recompensas_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resgates_recompensas
    ADD CONSTRAINT resgates_recompensas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: resgates_recompensas resgates_recompensas_recompensa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resgates_recompensas
    ADD CONSTRAINT resgates_recompensas_recompensa_id_fkey FOREIGN KEY (recompensa_id) REFERENCES public.recompensas(id) ON DELETE CASCADE;


--
-- Name: servicos servicos_barbearia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT servicos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES public.barbearias(id) ON DELETE CASCADE;


--
-- Name: servicos servicos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT servicos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicos(id) ON DELETE SET NULL;


--
-- Name: funcionario_ausencias Admins can create ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create ausencias" ON public.funcionario_ausencias FOR INSERT TO authenticated WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_convites Admins can create invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create invites" ON public.funcionario_convites FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.barbearia_id = funcionario_convites.barbearia_id) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: funcionario_ausencias Admins can delete ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete ausencias" ON public.funcionario_ausencias FOR DELETE TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionarios Admins can delete barbearia funcionarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete barbearia funcionarios" ON public.funcionarios FOR DELETE TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionarios Admins can insert barbearia funcionarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert barbearia funcionarios" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: barbearias Admins can insert barbearias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert barbearias" ON public.barbearias FOR INSERT TO authenticated WITH CHECK ((public.get_current_user_role() = 'admin'::public.user_role));


--
-- Name: assinaturas Admins can insert own barbearia assinatura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert own barbearia assinatura" ON public.assinaturas FOR INSERT TO authenticated WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_convites Admins can manage barbearia convites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage barbearia convites" ON public.funcionario_convites USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))) WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: horarios_funcionamento Admins can manage barbearia horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage barbearia horarios" ON public.horarios_funcionamento USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))) WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: recompensas Admins can manage barbearia recompensas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage barbearia recompensas" ON public.recompensas TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))) WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: servicos Admins can manage barbearia servicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage barbearia servicos" ON public.servicos TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))) WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: fidelidade_configuracoes Admins can manage own barbearia fidelidade config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage own barbearia fidelidade config" ON public.fidelidade_configuracoes USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))) WITH CHECK (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_ausencias Admins can update ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update ausencias" ON public.funcionario_ausencias FOR UPDATE TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionarios Admins can update barbearia funcionarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update barbearia funcionarios" ON public.funcionarios FOR UPDATE TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionarios Admins can update employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update employees" ON public.funcionarios FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.barbearia_id = funcionarios.barbearia_id) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: barbearias Admins can update own barbearia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update own barbearia" ON public.barbearias FOR UPDATE TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = id)));


--
-- Name: assinaturas Admins can update own barbearia assinatura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update own barbearia assinatura" ON public.assinaturas FOR UPDATE TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_convites Admins can view barbearia convites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view barbearia convites" ON public.funcionario_convites FOR SELECT USING ((( SELECT profiles.barbearia_id
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))) = barbearia_id));


--
-- Name: funcionarios Admins can view barbearia funcionarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view barbearia funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: assinaturas Admins can view own barbearia assinatura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view own barbearia assinatura" ON public.assinaturas FOR SELECT TO authenticated USING (((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionarios Allow employee insertion during invite; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow employee insertion during invite" ON public.funcionarios FOR INSERT WITH CHECK (true);


--
-- Name: funcionario_convites Allow invite updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow invite updates" ON public.funcionario_convites FOR UPDATE USING (true);


--
-- Name: agendamentos Anon can create appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anon can create appointments" ON public.agendamentos FOR INSERT TO anon WITH CHECK (((cliente_nome IS NOT NULL) AND (cliente_telefone IS NOT NULL) AND (data_hora IS NOT NULL) AND (barbearia_id IS NOT NULL) AND (servico_id IS NOT NULL) AND (user_id IS NULL)));


--
-- Name: horarios_funcionamento Anon can view horarios_funcionamento; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anon can view horarios_funcionamento" ON public.horarios_funcionamento FOR SELECT TO anon USING (true);


--
-- Name: servicos Anon can view servicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anon can view servicos" ON public.servicos FOR SELECT TO anon USING (true);


--
-- Name: funcionarios Anonymous limited view of funcionarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous limited view of funcionarios" ON public.funcionarios FOR SELECT TO anon USING (true);


--
-- Name: horarios_funcionamento Anonymous users can view horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous users can view horarios" ON public.horarios_funcionamento FOR SELECT USING (true);


--
-- Name: servicos Anonymous users can view servicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous users can view servicos" ON public.servicos FOR SELECT USING (true);


--
-- Name: categorias_servicos Anyone can view categorias_servicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view categorias_servicos" ON public.categorias_servicos FOR SELECT TO authenticated USING (true);


--
-- Name: horarios_funcionamento Anyone can view horarios_funcionamento; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view horarios_funcionamento" ON public.horarios_funcionamento FOR SELECT USING (true);


--
-- Name: recompensas Anyone can view recompensas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view recompensas" ON public.recompensas FOR SELECT TO authenticated USING (true);


--
-- Name: servicos Anyone can view servicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view servicos" ON public.servicos FOR SELECT TO authenticated USING (true);


--
-- Name: categorias_servicos Authenticated users can insert categorias_servicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert categorias_servicos" ON public.categorias_servicos FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: categorias_servicos Authenticated users can update categorias_servicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update categorias_servicos" ON public.categorias_servicos FOR UPDATE TO authenticated USING (true);


--
-- Name: funcionarios Authenticated users can view funcionarios from same barbershop; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view funcionarios from same barbershop" ON public.funcionarios FOR SELECT TO authenticated USING (((public.get_user_barbearia_id(auth.uid()) = barbearia_id) OR (public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role]))));


--
-- Name: feedbacks Cliente pode atualizar seus próprios feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cliente pode atualizar seus próprios feedbacks" ON public.feedbacks FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agendamentos a
  WHERE ((a.id = feedbacks.agendamento_id) AND (a.user_id = auth.uid())))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agendamentos a
  WHERE ((a.id = feedbacks.agendamento_id) AND (a.user_id = auth.uid()))))));


--
-- Name: feedbacks Cliente pode ver seus próprios feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cliente pode ver seus próprios feedbacks" ON public.feedbacks FOR SELECT USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agendamentos a
  WHERE ((a.id = feedbacks.agendamento_id) AND (a.user_id = auth.uid()))))));


--
-- Name: funcionarios Clientes podem visualizar funcionarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clientes podem visualizar funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING ((public.get_current_user_role() = 'cliente'::public.user_role));


--
-- Name: agendamentos Clients can create own appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can create own appointments" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (((cliente_nome IS NOT NULL) AND (cliente_telefone IS NOT NULL) AND (data_hora IS NOT NULL) AND (barbearia_id IS NOT NULL) AND (servico_id IS NOT NULL) AND (public.get_current_user_role() = 'cliente'::public.user_role) AND (auth.uid() = user_id)));


--
-- Name: feedbacks Clients can view own feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can view own feedbacks" ON public.feedbacks FOR SELECT USING (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));


--
-- Name: funcionario_convites Delete invites policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete invites policy" ON public.funcionario_convites FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role) AND (profiles.barbearia_id = funcionario_convites.barbearia_id)))));


--
-- Name: funcionario_convites Insert invites policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insert invites policy" ON public.funcionario_convites FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role) AND (profiles.barbearia_id = funcionario_convites.barbearia_id)))));


--
-- Name: barbearias Limited public access to barbearias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Limited public access to barbearias" ON public.barbearias FOR SELECT USING (true);


--
-- Name: audit_log Only admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view audit logs" ON public.audit_log FOR SELECT TO authenticated USING ((public.get_current_user_role() = 'admin'::public.user_role));


--
-- Name: funcionario_ausencias Public can view ausencias for availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view ausencias for availability" ON public.funcionario_ausencias FOR SELECT TO authenticated, anon USING (true);


--
-- Name: feedbacks Public can view completed feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view completed feedbacks" ON public.feedbacks FOR SELECT USING ((status = 'concluido'::text));


--
-- Name: funcionario_pausas Public can view pausas for availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view pausas for availability" ON public.funcionario_pausas FOR SELECT USING (true);


--
-- Name: funcionario_convites Read specific invite by exact token match; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read specific invite by exact token match" ON public.funcionario_convites FOR SELECT TO authenticated, anon USING (((usado = false) AND (expires_at > now())));


--
-- Name: funcionario_convites Select invites policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Select invites policy" ON public.funcionario_convites FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role) AND (profiles.barbearia_id = funcionario_convites.barbearia_id)))) OR ((auth.uid() IS NULL) AND (token IS NOT NULL))));


--
-- Name: feedbacks Sistema e clientes podem inserir feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sistema e clientes podem inserir feedbacks" ON public.feedbacks FOR INSERT WITH CHECK ((((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agendamentos a
  WHERE ((a.id = feedbacks.agendamento_id) AND (a.user_id = auth.uid()) AND (a.status = 'finalizado'::public.agendamento_status))))) OR (EXISTS ( SELECT 1
   FROM public.agendamentos a
  WHERE ((a.id = feedbacks.agendamento_id) AND (a.status = 'finalizado'::public.agendamento_status) AND (a.user_id = feedbacks.user_id) AND (a.barbearia_id = feedbacks.barbearia_id))))));


--
-- Name: POLICY "Sistema e clientes podem inserir feedbacks" ON feedbacks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Sistema e clientes podem inserir feedbacks" ON public.feedbacks IS 'Permite que clientes criem feedbacks para seus agendamentos finalizados E que o sistema crie feedbacks automaticamente via trigger quando um agendamento é finalizado';


--
-- Name: agendamentos Staff can create barbearia appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create barbearia appointments" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (((cliente_nome IS NOT NULL) AND (cliente_telefone IS NOT NULL) AND (data_hora IS NOT NULL) AND (barbearia_id IS NOT NULL) AND (servico_id IS NOT NULL) AND (public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_pausas Staff can create own pausas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create own pausas" ON public.funcionario_pausas FOR INSERT WITH CHECK (((public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_pausas Staff can delete own pausas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete own pausas" ON public.funcionario_pausas FOR DELETE USING (((public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: resgates_recompensas Staff can insert barbearia resgates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert barbearia resgates" ON public.resgates_recompensas FOR INSERT TO authenticated WITH CHECK (((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: fidelidade Staff can manage barbearia fidelidade; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage barbearia fidelidade" ON public.fidelidade TO authenticated USING (((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))) WITH CHECK (((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: agendamentos Staff can update barbearia agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update barbearia agendamentos" ON public.agendamentos FOR UPDATE TO authenticated USING (((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: feedbacks Staff can update barbearia feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update barbearia feedbacks" ON public.feedbacks FOR UPDATE TO authenticated USING (((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_pausas Staff can update own pausas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update own pausas" ON public.funcionario_pausas FOR UPDATE USING (((public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: agendamentos Staff can view barbearia agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view barbearia agendamentos" ON public.agendamentos FOR SELECT USING (
CASE
    WHEN ((public.get_current_user_role() = 'admin'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)) THEN true
    WHEN ((public.get_current_user_role() = 'funcionario'::public.user_role) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)) THEN ((funcionario_id IS NULL) OR (funcionario_id IN ( SELECT funcionarios.id
       FROM public.funcionarios
      WHERE (funcionarios.user_id = auth.uid()))))
    ELSE false
END);


--
-- Name: funcionario_ausencias Staff can view barbearia ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view barbearia ausencias" ON public.funcionario_ausencias FOR SELECT TO authenticated USING (((public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: feedbacks Staff can view barbearia feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view barbearia feedbacks" ON public.feedbacks FOR SELECT USING (((public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: funcionario_pausas Staff can view barbearia pausas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view barbearia pausas" ON public.funcionario_pausas FOR SELECT USING (((public.get_current_user_role() = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: feedbacks Staff pode ver feedbacks da barbearia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff pode ver feedbacks da barbearia" ON public.feedbacks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.barbearia_id = feedbacks.barbearia_id) AND (p.role = ANY (ARRAY['admin'::public.user_role, 'funcionario'::public.user_role]))))));


--
-- Name: audit_log System can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert audit logs" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: funcionario_convites Update invites policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update invites policy" ON public.funcionario_convites FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role) AND (profiles.barbearia_id = funcionario_convites.barbearia_id)))) OR ((auth.uid() IS NULL) AND (usado = false)))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role) AND (profiles.barbearia_id = funcionario_convites.barbearia_id)))) OR ((auth.uid() IS NULL) AND (usado = true))));


--
-- Name: funcionarios Users can read employees from same barbershop; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read employees from same barbershop" ON public.funcionarios FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.barbearia_id = funcionarios.barbearia_id)))));


--
-- Name: agendamentos Users can view relevant agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view relevant agendamentos" ON public.agendamentos FOR SELECT TO authenticated USING ((((public.get_current_user_role() = 'cliente'::public.user_role) AND (auth.uid() = user_id)) OR ((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))));


--
-- Name: fidelidade Users can view relevant fidelidade; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view relevant fidelidade" ON public.fidelidade FOR SELECT TO authenticated USING ((((public.get_current_user_role() = 'cliente'::public.user_role) AND (auth.uid() = user_id)) OR ((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id))));


--
-- Name: resgates_recompensas Users can view relevant resgates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view relevant resgates" ON public.resgates_recompensas FOR SELECT TO authenticated USING (((public.get_current_user_role() = ANY (ARRAY['funcionario'::public.user_role, 'admin'::public.user_role])) AND (public.get_user_barbearia_id(auth.uid()) = barbearia_id)));


--
-- Name: agendamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: assinaturas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: barbearias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias_servicos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categorias_servicos ENABLE ROW LEVEL SECURITY;

--
-- Name: feedbacks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

--
-- Name: fidelidade; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fidelidade ENABLE ROW LEVEL SECURITY;

--
-- Name: fidelidade_configuracoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fidelidade_configuracoes ENABLE ROW LEVEL SECURITY;

--
-- Name: funcionario_ausencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funcionario_ausencias ENABLE ROW LEVEL SECURITY;

--
-- Name: funcionario_convites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funcionario_convites ENABLE ROW LEVEL SECURITY;

--
-- Name: funcionario_pausas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funcionario_pausas ENABLE ROW LEVEL SECURITY;

--
-- Name: funcionarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

--
-- Name: horarios_funcionamento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horarios_funcionamento ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_edit_optimized; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_edit_optimized ON public.profiles FOR UPDATE USING (((barbearia_id IS NOT NULL) AND public.user_can_access_barbearia(barbearia_id, ARRAY['admin'::public.user_role]) AND (auth.uid() <> user_id))) WITH CHECK (((barbearia_id IS NOT NULL) AND public.user_can_access_barbearia(barbearia_id, ARRAY['admin'::public.user_role]) AND (auth.uid() <> user_id)));


--
-- Name: profiles profiles_audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_audit_log ON public.profiles USING (((current_setting('app.bypass_rls'::text, true))::boolean = true));


--
-- Name: profiles profiles_primary_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_primary_access ON public.profiles USING (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text))) WITH CHECK (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)));


--
-- Name: profiles profiles_team_read_optimized; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_team_read_optimized ON public.profiles FOR SELECT USING (((barbearia_id IS NOT NULL) AND public.user_can_access_barbearia(barbearia_id, ARRAY['admin'::public.user_role, 'funcionario'::public.user_role])));


--
-- Name: recompensas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recompensas ENABLE ROW LEVEL SECURITY;

--
-- Name: resgates_recompensas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resgates_recompensas ENABLE ROW LEVEL SECURITY;

--
-- Name: servicos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

-- (removed \unrestrict for Supabase compatibility)

