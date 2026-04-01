-- ===============================================
-- DEBUG BARBEARIAS RLS - ERRO 406
-- ===============================================
-- Investigar problema nas consultas da tabela barbearias
-- Data: 2025-09-25

-- ===============================================
-- 1. VERIFICAR SE RLS ESTÁ HABILITADO
-- ===============================================

SELECT
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'barbearias';

-- ===============================================
-- 2. LISTAR POLÍTICAS RLS EXISTENTES
-- ===============================================

SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'barbearias' AND schemaname = 'public'
ORDER BY policyname;

-- ===============================================
-- 3. TESTAR ACESSO DIRETO
-- ===============================================

-- Tentar consultar a barbearia específica
SELECT id, nome, slug
FROM public.barbearias
WHERE id = '897411d9-c3e0-44e7-b111-052f6019845d';

-- ===============================================
-- 4. VERIFICAR SE USUÁRIO TEM PERMISSÃO
-- ===============================================

-- Verificar perfil do usuário atual
SELECT
    user_id,
    role,
    barbearia_id,
    name
FROM public.profiles
WHERE user_id = 'c9941f4f-5b88-4261-b3d5-e03fce6881dc';

-- ===============================================
-- 5. DESABILITAR RLS TEMPORARIAMENTE (PARA TESTE)
-- ===============================================

-- ATENÇÃO: Execute apenas para teste, depois reabilite
-- ALTER TABLE public.barbearias DISABLE ROW LEVEL SECURITY;

-- Para reabilitar depois:
-- ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- 6. VERIFICAR LOGS DE ERRO
-- ===============================================

-- Verificar se há erros específicos
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE '%barbearia%'
ORDER BY routine_name;

-- ===============================================
-- RESUMO DO ERRO 406
-- ===============================================
/*
🔍 ERRO 406 - Not Acceptable

POSSÍVEIS CAUSAS:
1. RLS policy muito restritiva na tabela barbearias
2. Usuário não tem permissão para acessar a barbearia
3. Accept header incompatível (application/vnd.pgrst.object+json)
4. Problema nas funções RLS que referenciam barbearias

QUERY QUE FALHA:
GET /rest/v1/barbearias?select=slug&id=eq.897411d9-c3e0-44e7-b111-052f6019845d

USUÁRIO LOGADO:
- ID: c9941f4f-5b88-4261-b3d5-e03fce6881dc
- Role: admin (presumido)
- Barbearia: 897411d9-c3e0-44e7-b111-052f6019845d
*/