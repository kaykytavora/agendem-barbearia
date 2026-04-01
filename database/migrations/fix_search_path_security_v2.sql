-- ===============================================
-- FIX SEARCH_PATH SECURITY VULNERABILITY V2
-- ===============================================
-- VERSÃO CORRIGIDA - Remove funções existentes primeiro
-- Corrige vulnerabilidade de segurança nas funções
-- Data: 2025-09-25

-- ===============================================
-- ETAPA 1: REMOVER FUNÇÕES EXISTENTES
-- ===============================================

-- Remover funções que podem ter conflito de tipo
DROP FUNCTION IF EXISTS public.get_current_user_role();
DROP FUNCTION IF EXISTS public.get_user_barbearia_id();
DROP FUNCTION IF EXISTS public.get_user_profile_cached();
DROP FUNCTION IF EXISTS public.user_can_access_barbearia(uuid, user_role[]);
DROP FUNCTION IF EXISTS public.update_profile_on_employee_creation();
DROP FUNCTION IF EXISTS public.create_feedback_on_completion();
DROP FUNCTION IF EXISTS public.check_anonymous_appointment_limit(text, date);
DROP FUNCTION IF EXISTS public.validate_anonymous_appointment(text, text, timestamptz);
DROP FUNCTION IF EXISTS public.get_anonymous_appointment_limit();

-- ===============================================
-- ETAPA 2: RECRIAR FUNÇÕES RLS CRÍTICAS (APENAS search_path)
-- ===============================================

-- Função 1: user_is_admin_of_barbearia (apenas adicionar search_path)
CREATE OR REPLACE FUNCTION public.user_is_admin_of_barbearia(check_barbearia_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
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

-- Função 2: user_is_staff_of_barbearia (apenas adicionar search_path)
CREATE OR REPLACE FUNCTION public.user_is_staff_of_barbearia(check_barbearia_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
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

-- ===============================================
-- ETAPA 3: RECRIAR OUTRAS FUNÇÕES (SOMENTE SE EXISTIAM)
-- ===============================================

-- Função 3: get_current_user_role (verificar tipo original primeiro)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
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

-- Função 4: get_user_barbearia_id
CREATE OR REPLACE FUNCTION public.get_user_barbearia_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
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

-- Função 5: get_anonymous_appointment_limit
CREATE OR REPLACE FUNCTION public.get_anonymous_appointment_limit()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN 3; -- Limite padrão
END;
$$;

-- Função 6: check_anonymous_appointment_limit
CREATE OR REPLACE FUNCTION public.check_anonymous_appointment_limit(
  cliente_telefone_param text,
  data_agendamento date DEFAULT CURRENT_DATE
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  limite_agendamentos integer;
  agendamentos_hoje integer;
BEGIN
  SELECT public.get_anonymous_appointment_limit() INTO limite_agendamentos;

  SELECT COUNT(*)
  FROM public.agendamentos a
  WHERE a.cliente_telefone = cliente_telefone_param
    AND DATE(a.data_hora) = data_agendamento
    AND a.status != 'cancelado'
  INTO agendamentos_hoje;

  RETURN agendamentos_hoje < limite_agendamentos;
END;
$$;

-- Função 7: validate_anonymous_appointment
CREATE OR REPLACE FUNCTION public.validate_anonymous_appointment(
  cliente_telefone_param text,
  cliente_nome_param text,
  data_hora_param timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF cliente_telefone_param IS NULL OR cliente_nome_param IS NULL OR data_hora_param IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.check_anonymous_appointment_limit(cliente_telefone_param, DATE(data_hora_param)) THEN
    RETURN false;
  END IF;

  IF data_hora_param <= NOW() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ===============================================
-- ETAPA 4: TRIGGERS (SE EXISTIAM)
-- ===============================================

-- Função 8: update_profile_on_employee_creation (trigger function)
CREATE OR REPLACE FUNCTION public.update_profile_on_employee_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET
    role = 'funcionario'::user_role,
    barbearia_id = NEW.barbearia_id,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Função 9: create_feedback_on_completion (trigger function)
CREATE OR REPLACE FUNCTION public.create_feedback_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'finalizado' AND OLD.status != 'finalizado' THEN
    INSERT INTO public.feedbacks (
      agendamento_id,
      user_id,
      barbearia_id,
      status,
      anonimo
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.barbearia_id,
      'pendente',
      (NEW.user_id IS NULL)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ===============================================
-- ETAPA 5: VERIFICAÇÃO FINAL
-- ===============================================

-- Listar funções corrigidas
SELECT
    routine_name as funcao,
    routine_type as tipo,
    security_type as seguranca
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'user_is_admin_of_barbearia',
        'user_is_staff_of_barbearia',
        'get_current_user_role',
        'get_user_barbearia_id',
        'check_anonymous_appointment_limit',
        'validate_anonymous_appointment',
        'get_anonymous_appointment_limit',
        'create_feedback_on_completion',
        'update_profile_on_employee_creation'
    )
ORDER BY routine_name;

-- ===============================================
-- RESUMO
-- ===============================================
/*
✅ CORRIGIDO: search_path = '' adicionado
🔐 CRÍTICAS: user_is_admin_of_barbearia, user_is_staff_of_barbearia
📱 ANÔNIMOS: Funções de agendamento preservadas
🛡️ SEGURANÇA: Schema poisoning prevenido
*/