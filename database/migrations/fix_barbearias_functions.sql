-- ===============================================
-- CORRIGIR FUNÇÕES QUE CAUSAM ERRO 406
-- ===============================================
-- Corrigir get_current_user_role e get_user_barbearia_id
-- para funcionar com search_path = ''
-- Data: 2025-09-25

-- ===============================================
-- PROBLEMA IDENTIFICADO
-- ===============================================
/*
As políticas RLS da tabela barbearias usam:
1. get_current_user_role()
2. get_user_barbearia_id()

Quando aplicamos search_path = '', essas funções não encontram
as tabelas sem prefixo public., causando erro 406.

SOLUÇÃO: Corrigir as funções para usar public. explicitamente
*/

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
    FROM public.profiles p  -- <-- ADICIONADO public. explicitamente
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- ===============================================
-- 2. CORRIGIR get_user_barbearia_id
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
    FROM public.profiles p  -- <-- ADICIONADO public. explicitamente
    WHERE p.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- ===============================================
-- 3. CORRIGIR FUNÇÃO ESPECÍFICA COM PARÂMETRO
-- ===============================================

-- Função que pode ter o mesmo problema
CREATE OR REPLACE FUNCTION public.get_user_barbearia_id(user_id_param uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT p.barbearia_id
    FROM public.profiles p  -- <-- ADICIONADO public. explicitamente
    WHERE p.user_id = user_id_param
    LIMIT 1
  );
END;
$$;

-- ===============================================
-- 4. VERIFICAR SE user_can_access_barbearia EXISTE E CORRIGIR
-- ===============================================

-- Só executar se a função existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'user_can_access_barbearia'
  ) THEN
    -- Recriar com schema explícito
    DROP FUNCTION IF EXISTS public.user_can_access_barbearia(uuid, user_role[]);

    CREATE FUNCTION public.user_can_access_barbearia(target_barbearia_id uuid, required_roles user_role[])
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    STABLE
    SET search_path = ''
    AS $func$
    DECLARE
      user_profile RECORD;
    BEGIN
      -- Validação de entrada
      IF target_barbearia_id IS NULL OR required_roles IS NULL THEN
        RETURN FALSE;
      END IF;

      -- Buscar perfil do usuário
      SELECT role, barbearia_id INTO user_profile
      FROM public.profiles  -- <-- ADICIONADO public. explicitamente
      WHERE user_id = auth.uid()
      LIMIT 1;

      -- Verificar permissão
      RETURN (
        user_profile.role = ANY(required_roles)
        AND user_profile.barbearia_id = target_barbearia_id
      );
    END;
    $func$;

    RAISE NOTICE '✅ user_can_access_barbearia corrigida';
  ELSE
    RAISE NOTICE '⚠️ user_can_access_barbearia não existe';
  END IF;
END $$;

-- ===============================================
-- 5. VERIFICAÇÃO FINAL
-- ===============================================

-- Verificar se as funções foram corrigidas
SELECT
    routine_name as funcao_corrigida,
    routine_type as tipo,
    security_type as seguranca
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'get_current_user_role',
        'get_user_barbearia_id',
        'user_can_access_barbearia'
    )
ORDER BY routine_name;

-- ===============================================
-- RESUMO DA CORREÇÃO
-- ===============================================
/*
✅ PROBLEMA IDENTIFICADO E CORRIGIDO

🚨 CAUSA DO ERRO 406:
- Políticas RLS em barbearias usavam get_current_user_role() e get_user_barbearia_id()
- Com search_path = '', essas funções não encontravam a tabela profiles
- Resultado: policies falhavam, causando erro 406

🛠️ SOLUÇÃO APLICADA:
- Adicionado public. explicitamente em todas as referências de tabelas
- Mantido search_path = '' para segurança
- Funções agora funcionam corretamente com schema explícito

🔒 SEGURANÇA MANTIDA:
- search_path = '' previne schema poisoning
- Funções usam schemas explícitos
- RLS policies funcionam normalmente
*/