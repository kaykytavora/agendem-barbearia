-- ===============================================
-- REVERTER SEARCH_PATH TEMPORARIAMENTE
-- ===============================================
-- Remove search_path = '' para voltar ao funcionamento anterior
-- TEMPORÁRIO - apenas para diagnóstico
-- Data: 2025-09-25

-- ===============================================
-- REVERTER FUNÇÕES CRÍTICAS
-- ===============================================

-- Função RLS 1: user_is_admin_of_barbearia
ALTER FUNCTION public.user_is_admin_of_barbearia(uuid) RESET search_path;

-- Função RLS 2: user_is_staff_of_barbearia
ALTER FUNCTION public.user_is_staff_of_barbearia(uuid) RESET search_path;

-- ===============================================
-- REVERTER OUTRAS FUNÇÕES
-- ===============================================

-- Função 3: get_current_user_role
ALTER FUNCTION public.get_current_user_role() RESET search_path;

-- Função 4: update_profile_on_employee_creation
ALTER FUNCTION public.update_profile_on_employee_creation() RESET search_path;

-- Função 5: create_feedback_on_completion
ALTER FUNCTION public.create_feedback_on_completion() RESET search_path;

-- Função 6: check_anonymous_appointment_limit
ALTER FUNCTION public.check_anonymous_appointment_limit(text, date) RESET search_path;

-- Função 7: validate_anonymous_appointment
ALTER FUNCTION public.validate_anonymous_appointment(text, text, timestamptz) RESET search_path;

-- Função 8: get_anonymous_appointment_limit
ALTER FUNCTION public.get_anonymous_appointment_limit() RESET search_path;

-- ===============================================
-- VERIFICAÇÃO
-- ===============================================

-- Verificar se foi revertido
SELECT
    routine_name as funcao_revertida,
    routine_type as tipo
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
-- NOTA IMPORTANTE
-- ===============================================
/*
🚨 ESTE É UM ROLLBACK TEMPORÁRIO

❌ REVERTE a correção de segurança
⚠️ VOLTA à vulnerabilidade original
🔍 PERMITE investigar qual função causou o erro 400

APÓS IDENTIFICAR O PROBLEMA:
1. Aplicar search_path apenas nas funções que não causam erro
2. Investigar por que algumas funções não funcionam com search_path = ''
3. Corrigir o código dessas funções específicas
*/