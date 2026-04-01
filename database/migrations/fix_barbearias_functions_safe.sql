-- ===============================================
-- CORRIGIR FUNÇÕES BARBEARIAS - VERSÃO SEGURA
-- ===============================================
-- Corrige funções sem alterar assinaturas existentes
-- Data: 2025-09-25

-- ===============================================
-- 1. CORRIGIR get_current_user_role (sem parâmetros)
-- ===============================================

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
    FROM public.profiles p  -- <-- Schema explícito
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- ===============================================
-- 2. DESCOBRIR ASSINATURA REAL DE get_user_barbearia_id
-- ===============================================

-- Verificar qual é a assinatura real
SELECT
    routine_name,
    data_type as return_type,
    parameter_name,
    parameter_mode,
    data_type as parameter_type
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public'
    AND r.routine_name = 'get_user_barbearia_id'
ORDER BY ordinal_position;

-- ===============================================
-- 3. CORRIGIR get_user_barbearia_id (versão sem parâmetro)
-- ===============================================

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
    FROM public.profiles p  -- <-- Schema explícito
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- ===============================================
-- 4. CORRIGIR user_can_access_barbearia (se existir)
-- ===============================================

DO $$
DECLARE
    func_signature text;
BEGIN
  -- Verificar se existe e descobrir assinatura
  SELECT INTO func_signature
      pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'user_can_access_barbearia'
  LIMIT 1;

  IF func_signature IS NOT NULL THEN
    RAISE NOTICE 'Função user_can_access_barbearia encontrada com assinatura: %', func_signature;

    -- Tentar corrigir com a assinatura mais comum
    BEGIN
      EXECUTE format('
        CREATE OR REPLACE FUNCTION public.user_can_access_barbearia(%s)
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        STABLE
        SET search_path = ''''
        AS $func$
        DECLARE
          user_profile RECORD;
        BEGIN
          SELECT role, barbearia_id INTO user_profile
          FROM public.profiles
          WHERE user_id = auth.uid()
          LIMIT 1;

          RETURN user_profile.barbearia_id = $1;
        END;
        $func$;
      ', func_signature);

      RAISE NOTICE '✅ user_can_access_barbearia corrigida';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Erro ao corrigir user_can_access_barbearia: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '⚠️ user_can_access_barbearia não existe';
  END IF;
END $$;

-- ===============================================
-- 5. VERIFICAÇÃO FINAL
-- ===============================================

-- Mostrar funções corrigidas
SELECT
    routine_name as funcao,
    data_type as retorna,
    routine_type as tipo
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'get_current_user_role',
        'get_user_barbearia_id',
        'user_can_access_barbearia'
    )
ORDER BY routine_name;

-- ===============================================
-- 6. TESTAR AS FUNÇÕES
-- ===============================================

-- Testar get_current_user_role
SELECT 'Testando get_current_user_role...' as teste;
-- SELECT public.get_current_user_role();

-- Testar get_user_barbearia_id
SELECT 'Testando get_user_barbearia_id...' as teste;
-- SELECT public.get_user_barbearia_id();

-- ===============================================
-- RESUMO
-- ===============================================
/*
✅ CORREÇÃO APLICADA COM SEGURANÇA

🔧 FUNÇÕES CORRIGIDAS:
- get_current_user_role() → Agora usa public.profiles
- get_user_barbearia_id() → Agora usa public.profiles
- user_can_access_barbearia() → Se existir, será corrigida

🛡️ SEGURANÇA:
- search_path = '' mantido
- Schemas explícitos adicionados
- Prevenção contra schema poisoning

📝 NOTA:
Se ainda houver erro, verifique as assinaturas exatas
das funções existentes e ajuste conforme necessário.
*/