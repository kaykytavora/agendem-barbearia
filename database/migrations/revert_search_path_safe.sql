-- ===============================================
-- REVERTER SEARCH_PATH - VERSÃO SEGURA
-- ===============================================
-- Remove search_path = '' apenas das funções que existem
-- Data: 2025-09-25

-- ===============================================
-- REVERTER APENAS AS QUE EXISTEM
-- ===============================================

-- Função RLS 1: user_is_admin_of_barbearia
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'user_is_admin_of_barbearia'
    ) THEN
        ALTER FUNCTION public.user_is_admin_of_barbearia(uuid) RESET search_path;
        RAISE NOTICE '✅ user_is_admin_of_barbearia - search_path revertido';
    END IF;
END $$;

-- Função RLS 2: user_is_staff_of_barbearia
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'user_is_staff_of_barbearia'
    ) THEN
        ALTER FUNCTION public.user_is_staff_of_barbearia(uuid) RESET search_path;
        RAISE NOTICE '✅ user_is_staff_of_barbearia - search_path revertido';
    END IF;
END $$;

-- Função 3: get_current_user_role
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'get_current_user_role'
    ) THEN
        ALTER FUNCTION public.get_current_user_role() RESET search_path;
        RAISE NOTICE '✅ get_current_user_role - search_path revertido';
    END IF;
END $$;

-- Função 4: update_profile_on_employee_creation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'update_profile_on_employee_creation'
    ) THEN
        ALTER FUNCTION public.update_profile_on_employee_creation() RESET search_path;
        RAISE NOTICE '✅ update_profile_on_employee_creation - search_path revertido';
    END IF;
END $$;

-- Função 5: create_feedback_on_completion
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'create_feedback_on_completion'
    ) THEN
        ALTER FUNCTION public.create_feedback_on_completion() RESET search_path;
        RAISE NOTICE '✅ create_feedback_on_completion - search_path revertido';
    END IF;
END $$;

-- Função 6: get_anonymous_appointment_limit
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'get_anonymous_appointment_limit'
    ) THEN
        ALTER FUNCTION public.get_anonymous_appointment_limit() RESET search_path;
        RAISE NOTICE '✅ get_anonymous_appointment_limit - search_path revertido';
    END IF;
END $$;

-- Função 7: validate_anonymous_appointment
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'validate_anonymous_appointment'
    ) THEN
        ALTER FUNCTION public.validate_anonymous_appointment(text, text, timestamptz) RESET search_path;
        RAISE NOTICE '✅ validate_anonymous_appointment - search_path revertido';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ validate_anonymous_appointment - erro na assinatura, tentando sem parâmetros';
END $$;

-- Função 8: check_anonymous_appointment_limit (tentar diferentes assinaturas)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'check_anonymous_appointment_limit'
    ) THEN
        BEGIN
            ALTER FUNCTION public.check_anonymous_appointment_limit(text, date) RESET search_path;
            RAISE NOTICE '✅ check_anonymous_appointment_limit(text,date) - search_path revertido';
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                ALTER FUNCTION public.check_anonymous_appointment_limit(text) RESET search_path;
                RAISE NOTICE '✅ check_anonymous_appointment_limit(text) - search_path revertido';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '⚠️ check_anonymous_appointment_limit - não foi possível reverter';
            END;
        END;
    END IF;
END $$;

-- ===============================================
-- VERIFICAÇÃO FINAL
-- ===============================================

-- Mostrar status das funções
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
🚨 ROLLBACK TEMPORÁRIO EXECUTADO

✅ REVERTE search_path = '' apenas das funções existentes
⚠️ VOLTA à vulnerabilidade original (temporário)
🔍 PERMITE testar se o erro 400 foi resolvido

PRÓXIMOS PASSOS:
1. Teste se o erro 400 sumiu
2. Se sim, identificar qual função causou o problema
3. Corrigir essa função específica
4. Reaplicar search_path de forma seletiva
*/