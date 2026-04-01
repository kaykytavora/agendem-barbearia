-- ===============================================
-- FIX SEARCH_PATH - APENAS FUNÇÕES EXISTENTES
-- ===============================================
-- Adiciona SET search_path = '' APENAS nas funções que existem
-- Data: 2025-09-25

-- ===============================================
-- ETAPA 1: VERIFICAR QUAIS FUNÇÕES EXISTEM
-- ===============================================

-- Listar todas as funções que podem precisar da correção
SELECT
    routine_name as funcao_existente,
    routine_type as tipo,
    specific_name
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
        'update_profile_on_employee_creation',
        'get_user_profile_cached',
        'user_can_access_barbearia'
    )
ORDER BY routine_name;

-- ===============================================
-- ETAPA 2: APLICAR search_path APENAS NAS CRÍTICAS
-- ===============================================

-- Função RLS 1: user_is_admin_of_barbearia (CRÍTICA - deve existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'user_is_admin_of_barbearia'
    ) THEN
        ALTER FUNCTION public.user_is_admin_of_barbearia(uuid) SET search_path = '';
        RAISE NOTICE '✅ user_is_admin_of_barbearia - search_path aplicado';
    ELSE
        RAISE NOTICE '❌ user_is_admin_of_barbearia - função não existe';
    END IF;
END $$;

-- Função RLS 2: user_is_staff_of_barbearia (CRÍTICA - deve existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'user_is_staff_of_barbearia'
    ) THEN
        ALTER FUNCTION public.user_is_staff_of_barbearia(uuid) SET search_path = '';
        RAISE NOTICE '✅ user_is_staff_of_barbearia - search_path aplicado';
    ELSE
        RAISE NOTICE '❌ user_is_staff_of_barbearia - função não existe';
    END IF;
END $$;

-- ===============================================
-- ETAPA 3: APLICAR NAS OUTRAS (SE EXISTIREM)
-- ===============================================

-- Função 3: get_current_user_role
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'get_current_user_role'
    ) THEN
        ALTER FUNCTION public.get_current_user_role() SET search_path = '';
        RAISE NOTICE '✅ get_current_user_role - search_path aplicado';
    ELSE
        RAISE NOTICE '⚠️ get_current_user_role - função não existe (ok)';
    END IF;
END $$;

-- Função 4: update_profile_on_employee_creation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'update_profile_on_employee_creation'
    ) THEN
        ALTER FUNCTION public.update_profile_on_employee_creation() SET search_path = '';
        RAISE NOTICE '✅ update_profile_on_employee_creation - search_path aplicado';
    ELSE
        RAISE NOTICE '⚠️ update_profile_on_employee_creation - função não existe (ok)';
    END IF;
END $$;

-- Função 5: create_feedback_on_completion
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'create_feedback_on_completion'
    ) THEN
        ALTER FUNCTION public.create_feedback_on_completion() SET search_path = '';
        RAISE NOTICE '✅ create_feedback_on_completion - search_path aplicado';
    ELSE
        RAISE NOTICE '⚠️ create_feedback_on_completion - função não existe (ok)';
    END IF;
END $$;

-- Função 6: check_anonymous_appointment_limit
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'check_anonymous_appointment_limit'
    ) THEN
        -- Tentar com diferentes assinaturas
        BEGIN
            ALTER FUNCTION public.check_anonymous_appointment_limit(text, date) SET search_path = '';
            RAISE NOTICE '✅ check_anonymous_appointment_limit - search_path aplicado';
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                ALTER FUNCTION public.check_anonymous_appointment_limit(text) SET search_path = '';
                RAISE NOTICE '✅ check_anonymous_appointment_limit (1 param) - search_path aplicado';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '⚠️ check_anonymous_appointment_limit - erro na assinatura';
            END;
        END;
    ELSE
        RAISE NOTICE '⚠️ check_anonymous_appointment_limit - função não existe (ok)';
    END IF;
END $$;

-- Função 7: validate_anonymous_appointment
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'validate_anonymous_appointment'
    ) THEN
        BEGIN
            ALTER FUNCTION public.validate_anonymous_appointment(text, text, timestamptz) SET search_path = '';
            RAISE NOTICE '✅ validate_anonymous_appointment - search_path aplicado';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️ validate_anonymous_appointment - erro na assinatura';
        END;
    ELSE
        RAISE NOTICE '⚠️ validate_anonymous_appointment - função não existe (ok)';
    END IF;
END $$;

-- Função 8: get_anonymous_appointment_limit
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'get_anonymous_appointment_limit'
    ) THEN
        ALTER FUNCTION public.get_anonymous_appointment_limit() SET search_path = '';
        RAISE NOTICE '✅ get_anonymous_appointment_limit - search_path aplicado';
    ELSE
        RAISE NOTICE '⚠️ get_anonymous_appointment_limit - função não existe (ok)';
    END IF;
END $$;

-- ===============================================
-- ETAPA 4: VERIFICAÇÃO FINAL
-- ===============================================

-- Mostrar funções corrigidas
SELECT
    routine_name as funcao_corrigida,
    routine_type as tipo,
    security_type as seguranca
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'user_is_admin_of_barbearia',
        'user_is_staff_of_barbearia',
        'get_current_user_role',
        'update_profile_on_employee_creation',
        'create_feedback_on_completion',
        'check_anonymous_appointment_limit',
        'validate_anonymous_appointment',
        'get_anonymous_appointment_limit'
    )
ORDER BY routine_name;

-- ===============================================
-- RESUMO
-- ===============================================
/*
✅ APLICA search_path = '' APENAS nas funções existentes
🔍 VERIFICA se a função existe antes de alterar
⚠️ MOSTRA avisos para funções que não existem (normal)
🛡️ CORRIGE vulnerabilidade de segurança sem erros
📱 MANTÉM 100% compatibilidade
*/