-- =============================================================================
-- 004 - SEGURANÇA
-- =============================================================================
-- Cada pedido do app passa por duas barreiras antes de chegar aos dados:
--
--   App (anon = visitante, authenticated = logado)
--        │
--        ▼
--   1. GRANT: este papel pode usar esta tabela ou função?  ─ não ─► erro
--        │ sim
--        ▼
--   2. RLS: quais LINHAS esta pessoa pode ver ou alterar?  ─ nenhuma ─► vazio
--        │
--        ▼
--     Dados permitidos
--
-- O papel service_role (Edge Functions) ignora o RLS. A chave dele nunca vai
-- para o navegador.
--
-- Resumo de quem acessa o quê:
--
--   Tabela                     Visitante     Cliente       Funcionário   Admin
--   -------------------------  ------------  ------------  ------------  ----------
--   barbearias                 lê            lê            lê            altera a sua
--   servicos, horarios         lê            lê            lê            altera a sua
--   funcionarios               lê (parcial)  lê            lê            altera a sua
--   pausas                     lê            lê            altera        altera
--   ausencias                  lê            lê            lê            altera
--   agendamentos               cria          cria/lê seus  gerencia      gerencia
--   feedbacks concluídos       lê            lê            lê            lê
--   fidelidade                 -             lê o seu      gerencia      gerencia
--   recompensas                lê            lê            lê            altera
--   convites, assinaturas      -             -             -             admin
--   customers, audit_log       -             -             -             -
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Barreira 1: permissões por papel
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE ALL ON public.customers, public.audit_log FROM authenticated;

-- Visitantes: leitura da vitrine e criação de agendamento
GRANT SELECT ON
    public.barbearias, public.barbearias_public,
    public.servicos, public.servicos_public,
    public.funcionarios_public,
    public.categorias_servicos,
    public.horarios_funcionamento,
    public.funcionario_pausas,
    public.funcionario_ausencias,
    public.feedbacks,
    public.recompensas,
    public.agendamentos,
    public.profiles
TO anon;
GRANT INSERT ON public.agendamentos TO anon;

-- O e-mail da equipe não é público
GRANT SELECT (id, barbearia_id, nome, especialidade, is_owner, nivel) ON public.funcionarios TO anon;

-- Funções que o RLS usa precisam estar disponíveis para quem faz a consulta
GRANT EXECUTE ON FUNCTION
    public.get_current_user_role(),
    public.get_user_role(uuid),
    public.get_user_barbearia_id(),
    public.get_user_barbearia_id(uuid),
    public.get_user_phone(),
    public.user_can_access_barbearia(uuid, public.user_role[]),
    public.user_is_admin_of_barbearia(uuid),
    public.user_is_staff_of_barbearia(uuid)
TO anon, authenticated;

-- Funções chamadas pelas telas públicas
GRANT EXECUTE ON FUNCTION
    public.check_if_user_exists(text, text),
    public.get_convite_por_token(text),
    public.horarios_ocupados(uuid, timestamptz, timestamptz),
    public.check_funcionario_disponibilidade(uuid, timestamptz),
    public.check_anonymous_appointment_limit(text, uuid),
    public.get_anonymous_appointment_limit(),
    public.get_default_funcionario(uuid)
TO anon, authenticated;

-- Funções só para quem está logado
GRANT EXECUTE ON FUNCTION
    public.get_public_profile_info(uuid[]),
    public.get_recompensas_disponiveis(uuid, text),
    public.resgatar_recompensa(uuid, text, uuid),
    public.barbearia_tem_assinatura_ativa(uuid),
    public.get_assinatura_ativa(uuid)
TO authenticated;


-- -----------------------------------------------------------------------------
-- Barreira 2: regras por linha (RLS)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    v_tabela text;
BEGIN
    FOR v_tabela IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabela);
    END LOOP;
END;
$$;

-- customers e audit_log não têm regras de propósito: só o service_role acessa.

-- Perfis ----------------------------------------------------------------------
CREATE POLICY "Pessoa vê o próprio perfil" ON public.profiles
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Equipe vê os perfis da barbearia" ON public.profiles
    FOR SELECT TO authenticated USING (public.user_is_staff_of_barbearia(barbearia_id));

CREATE POLICY "Pessoa cria o próprio perfil de cliente" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND role = 'cliente' AND barbearia_id IS NULL);

CREATE POLICY "Pessoa edita o próprio perfil" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin edita perfis da equipe" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id) AND user_id <> auth.uid())
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id) AND user_id <> auth.uid());

-- Barbearias ------------------------------------------------------------------
CREATE POLICY "Todos veem as barbearias" ON public.barbearias
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin sem barbearia cria a sua" ON public.barbearias
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() = 'admin' AND public.get_user_barbearia_id() IS NULL);

CREATE POLICY "Admin altera a própria barbearia" ON public.barbearias
    FOR UPDATE TO authenticated
    USING (public.user_is_admin_of_barbearia(id)) WITH CHECK (public.user_is_admin_of_barbearia(id));

-- Catálogo --------------------------------------------------------------------
-- Categorias são globais: alterações passam pelo backend
CREATE POLICY "Todos veem as categorias" ON public.categorias_servicos
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Todos veem os serviços" ON public.servicos
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin gerencia os serviços" ON public.servicos
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

CREATE POLICY "Todos veem os horários" ON public.horarios_funcionamento
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin gerencia os horários" ON public.horarios_funcionamento
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

-- Equipe ----------------------------------------------------------------------
CREATE POLICY "Todos veem a equipe" ON public.funcionarios
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin gerencia a equipe" ON public.funcionarios
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

CREATE POLICY "Todos veem as pausas" ON public.funcionario_pausas
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Equipe gerencia as pausas" ON public.funcionario_pausas
    FOR ALL TO authenticated
    USING (public.user_is_staff_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_staff_of_barbearia(barbearia_id));

CREATE POLICY "Todos veem as ausências" ON public.funcionario_ausencias
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin gerencia as ausências" ON public.funcionario_ausencias
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

-- O link de convite é lido por get_convite_por_token, nunca direto na tabela
CREATE POLICY "Admin gerencia os convites" ON public.funcionario_convites
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

-- Agendamentos ----------------------------------------------------------------
CREATE POLICY "Cliente vê os próprios agendamentos" ON public.agendamentos
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Equipe vê os agendamentos da barbearia" ON public.agendamentos
    FOR SELECT TO authenticated USING (public.user_is_staff_of_barbearia(barbearia_id));

CREATE POLICY "Visitante agenda sem conta" ON public.agendamentos
    FOR INSERT TO anon
    WITH CHECK (user_id IS NULL AND status IN ('pendente', 'confirmado'));

CREATE POLICY "Cliente agenda para si" ON public.agendamentos
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status IN ('pendente', 'confirmado'));

CREATE POLICY "Equipe agenda para a barbearia" ON public.agendamentos
    FOR INSERT TO authenticated
    WITH CHECK (public.user_is_staff_of_barbearia(barbearia_id));

CREATE POLICY "Equipe altera os agendamentos" ON public.agendamentos
    FOR UPDATE TO authenticated
    USING (public.user_is_staff_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_staff_of_barbearia(barbearia_id));

-- Avaliações ------------------------------------------------------------------
CREATE POLICY "Todos veem avaliações concluídas" ON public.feedbacks
    FOR SELECT TO anon, authenticated USING (status = 'concluido');

CREATE POLICY "Cliente vê as próprias avaliações" ON public.feedbacks
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Equipe vê as avaliações da barbearia" ON public.feedbacks
    FOR SELECT TO authenticated USING (public.user_is_staff_of_barbearia(barbearia_id));

-- Só para atendimentos finalizados, pelo próprio cliente ou pela equipe
CREATE POLICY "Cria avaliação de atendimento finalizado" ON public.feedbacks
    FOR INSERT TO authenticated
    WITH CHECK (
        (user_id = auth.uid() OR public.user_is_staff_of_barbearia(barbearia_id))
        AND EXISTS (
            SELECT 1 FROM public.agendamentos a
            WHERE a.id = agendamento_id
              AND a.status = 'finalizado'
              AND a.user_id = feedbacks.user_id
              AND a.barbearia_id = feedbacks.barbearia_id
        )
    );

CREATE POLICY "Cliente responde a própria avaliação" ON public.feedbacks
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Equipe responde às avaliações" ON public.feedbacks
    FOR UPDATE TO authenticated
    USING (public.user_is_staff_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_staff_of_barbearia(barbearia_id));

-- Fidelidade ------------------------------------------------------------------
CREATE POLICY "Cliente vê o próprio saldo" ON public.fidelidade
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR cliente_telefone = public.get_user_phone());

CREATE POLICY "Equipe gerencia os saldos" ON public.fidelidade
    FOR ALL TO authenticated
    USING (public.user_is_staff_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_staff_of_barbearia(barbearia_id));

CREATE POLICY "Equipe vê a configuração de fidelidade" ON public.fidelidade_configuracoes
    FOR SELECT TO authenticated USING (public.user_is_staff_of_barbearia(barbearia_id));

CREATE POLICY "Admin gerencia a configuração de fidelidade" ON public.fidelidade_configuracoes
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

CREATE POLICY "Todos veem as recompensas" ON public.recompensas
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin gerencia as recompensas" ON public.recompensas
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

CREATE POLICY "Cliente vê os próprios resgates" ON public.resgates_recompensas
    FOR SELECT TO authenticated USING (cliente_telefone = public.get_user_phone());

CREATE POLICY "Equipe vê os resgates" ON public.resgates_recompensas
    FOR SELECT TO authenticated USING (public.user_is_staff_of_barbearia(barbearia_id));

CREATE POLICY "Equipe registra resgates" ON public.resgates_recompensas
    FOR INSERT TO authenticated WITH CHECK (public.user_is_staff_of_barbearia(barbearia_id));

-- Assinatura ------------------------------------------------------------------
-- Só leitura: quem altera o plano é o backend, depois da confirmação do pagamento
CREATE POLICY "Admin vê a própria assinatura" ON public.assinaturas
    FOR SELECT TO authenticated USING (public.user_is_admin_of_barbearia(barbearia_id));
