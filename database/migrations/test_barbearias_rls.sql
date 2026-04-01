-- ===============================================
-- TESTE EMERGENCIAL - DESABILITAR RLS BARBEARIAS
-- ===============================================
-- Desabilitar RLS temporariamente para identificar o problema
-- Data: 2025-09-25

-- ===============================================
-- 1. BACKUP DAS POLÍTICAS ATUAIS
-- ===============================================

-- Mostrar políticas antes de desabilitar
SELECT
    'POLÍTICAS ATUAIS:' as info,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'barbearias' AND schemaname = 'public';

-- ===============================================
-- 2. DESABILITAR RLS TEMPORARIAMENTE
-- ===============================================

-- ATENÇÃO: Isso remove a segurança temporariamente
ALTER TABLE public.barbearias DISABLE ROW LEVEL SECURITY;

-- ===============================================
-- 3. TESTAR CONSULTA DIRETA
-- ===============================================

-- Testar se a consulta funciona sem RLS
SELECT
    'TESTE SEM RLS:' as info,
    id,
    nome,
    slug
FROM public.barbearias
WHERE id = '897411d9-c3e0-44e7-b111-052f6019845d';

-- ===============================================
-- 4. VERIFICAR STATUS
-- ===============================================

SELECT
    'STATUS RLS:' as info,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'barbearias';

-- ===============================================
-- 5. INSTRUÇÕES PARA REABILITAR
-- ===============================================

/*
🚨 IMPORTANTE: DEPOIS DO TESTE, REABILITAR RLS

Para reabilitar o RLS:
ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;

🔍 OBJETIVO DO TESTE:
1. Se erro 406 SUMIR → problema está nas políticas RLS
2. Se erro 406 PERSISTIR → problema está em outro lugar

📝 PRÓXIMOS PASSOS:
- Se RLS for o problema → criar políticas mais simples
- Se não for → investigar outras causas (accept header, etc)
*/

-- ===============================================
-- RESUMO
-- ===============================================
/*
⚠️ TESTE EMERGENCIAL EXECUTADO

❌ RLS DESABILITADO temporariamente na tabela barbearias
🔍 TESTE a consulta que estava dando erro 406
📋 RESULTADO determinará próximos passos

IMPORTANTE: Este é um teste diagnóstico temporário!
*/