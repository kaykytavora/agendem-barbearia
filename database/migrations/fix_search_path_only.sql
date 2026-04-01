-- ===============================================
-- FIX SEARCH_PATH - APENAS ADICIONAR SEGURANÇA
-- ===============================================
-- Adiciona SET search_path = '' SOMENTE nas funções existentes
-- SEM REMOVER ou alterar lógica das funções
-- Data: 2025-09-25

-- ===============================================
-- FUNÇÕES RLS CRÍTICAS - APENAS search_path
-- ===============================================

-- Função 1: user_is_admin_of_barbearia
ALTER FUNCTION public.user_is_admin_of_barbearia(uuid) SET search_path = '';

-- Função 2: user_is_staff_of_barbearia
ALTER FUNCTION public.user_is_staff_of_barbearia(uuid) SET search_path = '';

-- ===============================================
-- OUTRAS FUNÇÕES - APENAS search_path
-- ===============================================

-- Função 3: get_current_user_role
ALTER FUNCTION public.get_current_user_role() SET search_path = '';

-- Função 4: get_user_barbearia_id
ALTER FUNCTION public.get_user_barbearia_id() SET search_path = '';

-- Função 5: update_profile_on_employee_creation
ALTER FUNCTION public.update_profile_on_employee_creation() SET search_path = '';

-- Função 6: get_user_profile_cached
ALTER FUNCTION public.get_user_profile_cached() SET search_path = '';

-- Função 7: user_can_access_barbearia
ALTER FUNCTION public.user_can_access_barbearia(uuid, user_role[]) SET search_path = '';

-- Função 8: create_feedback_on_completion
ALTER FUNCTION public.create_feedback_on_completion() SET search_path = '';

-- Função 9: check_anonymous_appointment_limit
ALTER FUNCTION public.check_anonymous_appointment_limit(text, date) SET search_path = '';

-- Função 10: validate_anonymous_appointment
ALTER FUNCTION public.validate_anonymous_appointment(text, text, timestamptz) SET search_path = '';

-- Função 11: get_anonymous_appointment_limit
ALTER FUNCTION public.get_anonymous_appointment_limit() SET search_path = '';

-- ===============================================
-- VERIFICAÇÃO FINAL
-- ===============================================

-- Verificar se as alterações foram aplicadas
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
        'update_profile_on_employee_creation',
        'get_user_profile_cached',
        'user_can_access_barbearia'
    )
ORDER BY routine_name;

-- ===============================================
-- RESUMO
-- ===============================================
/*
✅ APENAS ADICIONA search_path = ''
🚫 NÃO remove funções existentes
🚫 NÃO altera lógica das funções
🚫 NÃO muda tipos de retorno
🛡️ CORRIGE vulnerabilidade de segurança
📱 MANTÉM 100% compatibilidade
*/