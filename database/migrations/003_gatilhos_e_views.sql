-- =============================================================================
-- 003 - GATILHOS E VIEWS
-- =============================================================================
-- Gatilho (trigger) é uma ação que o banco executa sozinho quando uma linha é
-- criada ou alterada. O que cada um faz está explicado no arquivo 002.
--
--   Evento                             Ação
--   ---------------------------------  ------------------------------------------
--   Novo login em auth.users           cria perfil (e barbearia, se for dono)
--   Antes de gravar agendamento        limpa e valida os dados
--   Agendamento finalizado             deixa a avaliação pendente
--   Avaliação concluída                marca o agendamento como avaliado
--   Novo funcionário                   ajusta o perfil da pessoa
--   Antes de alterar perfil            bloqueia mudança indevida de papel
--   Qualquer alteração                 atualiza a coluna updated_at
-- =============================================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER validar_agendamento
    BEFORE INSERT OR UPDATE ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.validar_agendamento();

CREATE TRIGGER criar_feedback_ao_finalizar
    AFTER UPDATE OF status ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.criar_feedback_ao_finalizar();

CREATE TRIGGER marcar_agendamento_avaliado
    AFTER INSERT OR UPDATE OF status ON public.feedbacks
    FOR EACH ROW EXECUTE FUNCTION public.marcar_agendamento_avaliado();

CREATE TRIGGER sincronizar_perfil_funcionario
    AFTER INSERT ON public.funcionarios
    FOR EACH ROW EXECUTE FUNCTION public.sincronizar_perfil_funcionario();

CREATE TRIGGER proteger_campos_perfil
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_perfil();

-- Cria o gatilho de updated_at em toda tabela do schema que tem essa coluna
DO $$
DECLARE
    v_tabela text;
BEGIN
    FOR v_tabela IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t USING (table_schema, table_name)
        WHERE c.table_schema = 'public'
          AND c.column_name = 'updated_at'
          AND t.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER definir_updated_at BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at()',
            v_tabela
        );
    END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- Views públicas: expõem só as colunas seguras para a vitrine.
-- security_invoker faz a view respeitar as permissões de quem consulta.
-- -----------------------------------------------------------------------------

CREATE VIEW public.barbearias_public WITH (security_invoker = on) AS
    SELECT id, nome, cidade, endereco, telefone, logo_url, gallery_urls, slug, modo_tema, cores_personalizadas
    FROM public.barbearias;

CREATE VIEW public.funcionarios_public WITH (security_invoker = on) AS
    SELECT id, nome, barbearia_id
    FROM public.funcionarios;

CREATE VIEW public.servicos_public WITH (security_invoker = on) AS
    SELECT id, nome, descricao, valor, duracao_minutos, barbearia_id
    FROM public.servicos;
