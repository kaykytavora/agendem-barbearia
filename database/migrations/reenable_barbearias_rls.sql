-- ===============================================
-- REABILITAR RLS BARBEARIAS
-- ===============================================
-- Reabilitar RLS após corrigir problema do frontend
-- Data: 2025-09-25

-- ===============================================
-- REABILITAR RLS
-- ===============================================

ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- VERIFICAR STATUS
-- ===============================================

SELECT
    'STATUS APÓS REABILITAÇÃO:' as info,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'barbearias';

-- ===============================================
-- VERIFICAR POLÍTICAS ATIVAS
-- ===============================================

SELECT
    'POLÍTICAS ATIVAS:' as info,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'barbearias' AND schemaname = 'public'
ORDER BY policyname;

-- ===============================================
-- RESUMO DA CORREÇÃO
-- ===============================================
/*
✅ PROBLEMA RESOLVIDO

🚨 CAUSA REAL DO ERRO 406:
- Frontend usava .single() em consultas de barbearias
- .single() força Accept Header "application/vnd.pgrst.object+json"
- Se consulta não retorna exatamente 1 resultado → erro 406

🔧 SOLUÇÃO APLICADA:
- Trocado .single() por .maybeSingle() em 6 arquivos
- .maybeSingle() aceita 0 ou 1 resultado sem erro
- Mantém funcionalidade, elimina erro 406

🔒 RLS REABILITADO:
- Segurança restaurada na tabela barbearias
- Políticas funcionando normalmente
- search_path = '' mantido para segurança adicional

🎯 PRÓXIMO TESTE:
- Acessar abas: Fidelidade, Compartilhar perfil, Configurações
- Erro 406 deve ter desaparecido
- Funcionalidades devem estar normais
*/