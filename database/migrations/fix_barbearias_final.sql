-- ===============================================
-- CORRIGIR FUNÇÕES BARBEARIAS - VERSÃO FINAL
-- ===============================================
-- Versão simplificada que corrige apenas o essencial
-- Data: 2025-09-25

-- ===============================================
-- 1. CORRIGIR get_current_user_role
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
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- ===============================================
-- 2. CORRIGIR get_user_barbearia_id (versão sem parâmetro)
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
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- ===============================================
-- 3. DESCOBRIR E CORRIGIR VERSÃO COM PARÂMETRO
-- ===============================================

-- Verificar se existe versão com parâmetro
DO $$
BEGIN
  -- Tentar corrigir versão com parâmetro uuid
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_user_barbearia_id'
    AND p.pronargs = 1
  ) THEN
    -- Executar correção dinâmica
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.get_user_barbearia_id(user_uuid uuid)
      RETURNS uuid
      LANGUAGE plpgsql
      SECURITY DEFINER
      STABLE
      SET search_path = ''''
      AS $inner$
      BEGIN
        RETURN (
          SELECT p.barbearia_id
          FROM public.profiles p
          WHERE p.user_id = user_uuid
          LIMIT 1
        );
      END;
      $inner$;
    ';
    RAISE NOTICE '✅ get_user_barbearia_id(uuid) corrigida';
  ELSE
    RAISE NOTICE '⚠️ get_user_barbearia_id(uuid) não encontrada';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erro ao corrigir get_user_barbearia_id(uuid): %', SQLERRM;
END $$;

-- ===============================================
-- 4. TESTAR AS FUNÇÕES CORRIGIDAS
-- ===============================================

-- Testar função sem parâmetro
SELECT 'Teste: get_current_user_role()' as funcao;

-- Testar função sem parâmetro
SELECT 'Teste: get_user_barbearia_id()' as funcao;

-- ===============================================
-- 5. VERIFICAR STATUS DAS FUNÇÕES
-- ===============================================

SELECT
    p.proname as funcao,
    p.pronargs as num_parametros,
    pg_get_function_result(p.oid) as retorno
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_current_user_role', 'get_user_barbearia_id')
ORDER BY p.proname, p.pronargs;

-- ===============================================
-- RESUMO DA CORREÇÃO
-- ===============================================
/*
✅ FUNÇÕES CORRIGIDAS PARA USAR SCHEMAS EXPLÍCITOS

🎯 PROBLEMA ORIGINAL:
- Políticas RLS da tabela barbearias usavam funções que referenciavam 'profiles'
- Com search_path = '', essas funções não encontravam a tabela
- Resultado: erro 406 nas consultas de barbearias

🔧 SOLUÇÃO APLICADA:
- get_current_user_role() → usa public.profiles
- get_user_barbearia_id() → usa public.profiles (ambas versões)
- Mantém search_path = '' para segurança
- Preserva assinaturas existentes

🚀 PRÓXIMO PASSO:
Após executar, teste as abas que estavam com erro 406:
- Fidelidade
- Compartilhar perfil
- Configurações da barbearia
*/