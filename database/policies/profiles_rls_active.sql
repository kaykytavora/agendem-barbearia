-- ========================================
-- POLÍTICAS RLS ATIVAS PARA TABELA PROFILES
-- ========================================
-- Este arquivo contém APENAS as políticas que estão funcionando
-- Data: 2025-09-25
-- Status: ✅ FUNCIONANDO SEM ERRO 500

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "profiles_self_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_view_function" ON public.profiles;
DROP POLICY IF EXISTS "profiles_staff_view_function" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update_function" ON public.profiles;

-- Funções auxiliares (evitam subqueries recursivas)
CREATE OR REPLACE FUNCTION public.user_is_admin_of_barbearia(check_barbearia_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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

CREATE OR REPLACE FUNCTION public.user_is_staff_of_barbearia(check_barbearia_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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

-- ========================================
-- POLÍTICAS RLS ATIVAS
-- ========================================

-- 1. Usuários podem acessar apenas seu próprio perfil
CREATE POLICY "profiles_self_only"
ON public.profiles
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Service role tem acesso completo (para operações do sistema)
CREATE POLICY "profiles_service_access"
ON public.profiles
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. Admins podem visualizar perfis da mesma barbearia
CREATE POLICY "profiles_admin_view_function"
ON public.profiles
FOR SELECT
USING (
  barbearia_id IS NOT NULL
  AND public.user_is_admin_of_barbearia(barbearia_id)
);

-- 4. Funcionários podem visualizar perfis da mesma barbearia
CREATE POLICY "profiles_staff_view_function"
ON public.profiles
FOR SELECT
USING (
  barbearia_id IS NOT NULL
  AND public.user_is_staff_of_barbearia(barbearia_id)
);

-- 5. Admins podem editar perfis da mesma barbearia
CREATE POLICY "profiles_admin_update_function"
ON public.profiles
FOR UPDATE
USING (
  barbearia_id IS NOT NULL
  AND public.user_is_admin_of_barbearia(barbearia_id)
)
WITH CHECK (
  barbearia_id IS NOT NULL
  AND public.user_is_admin_of_barbearia(barbearia_id)
);

-- ========================================
-- ÍNDICES OTIMIZADOS
-- ========================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id_login ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_barbearia_role_fast
ON public.profiles (barbearia_id, role)
WHERE barbearia_id IS NOT NULL;

-- ========================================
-- RESUMO DAS PERMISSÕES
-- ========================================
/*
✅ CLIENTES:
- Visualizam e editam apenas seu próprio perfil

✅ FUNCIONÁRIOS:
- Visualizam e editam seu próprio perfil
- Visualizam perfis de outros usuários da mesma barbearia

✅ ADMINS:
- Visualizam e editam seu próprio perfil
- Visualizam perfis de outros usuários da mesma barbearia
- Editam perfis de outros usuários da mesma barbearia

✅ SYSTEM (Service Role):
- Acesso completo para operações administrativas do sistema
*/