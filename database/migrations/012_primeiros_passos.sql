-- =============================================================================
-- 012 - PRIMEIROS PASSOS
-- =============================================================================
-- Guarda o andamento do passo a passo de primeiro acesso, para ele não reaparecer
-- quando a pessoa troca de celular ou de navegador.
--
--   cliente ── tour de boas-vindas no painel ──► concluido_em
--   admin   ── checklist de configuração no dashboard
--                 ├── etapas_vistas  (etapas que o banco não consegue conferir sozinho,
--                 │                   como revisar horários ou compartilhar o link)
--                 └── concluido_em   (checklist completo ou dispensado)
--
-- A própria pessoa edita a coluna pela regra "Pessoa edita o próprio perfil".
-- =============================================================================

ALTER TABLE public.profiles
    ADD COLUMN primeiros_passos jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.primeiros_passos IS
    'Andamento do passo a passo de primeiro acesso: {"concluido_em": timestamptz, "etapas_vistas": [text]}.';

-- Quem já usava a plataforma não precisa do passo a passo: clientes existentes e
-- barbearias que já cadastraram serviços começam com ele concluído.
UPDATE public.profiles p
SET primeiros_passos = jsonb_build_object('concluido_em', now())
WHERE p.role = 'cliente'
   OR (p.role = 'admin' AND EXISTS (
        SELECT 1 FROM public.servicos s WHERE s.barbearia_id = p.barbearia_id
   ));
