BEGIN;

-- 1) Atendimento que já passou do horário: a equipe decide o que houve.
--    'finalizar' passa a aceitar também agendamento pendente cujo horário já passou;
--    'nao_compareceu' cancela direto (sem pedir aprovação do cliente) um horário que já passou.
CREATE OR REPLACE FUNCTION public.gerenciar_agendamento(p_id uuid, p_acao text, p_token text DEFAULT NULL)
RETURNS public.agendamento_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_agendamento public.agendamentos;
    v_lado text;
BEGIN
    SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento indisponível.' USING ERRCODE = '42501'; END IF;
    v_lado := public.lado_agendamento(v_agendamento, p_token);
    IF v_lado IS NULL THEN RAISE EXCEPTION 'Agendamento indisponível.' USING ERRCODE = '42501'; END IF;
    IF p_token IS NOT NULL AND public.user_is_staff_of_barbearia(v_agendamento.barbearia_id) THEN
        RAISE EXCEPTION 'Compartilhe este link para que o cliente confirme pelo próprio acesso.' USING ERRCODE = '42501';
    END IF;

    CASE p_acao
    WHEN 'confirmar' THEN
        IF v_agendamento.status = 'confirmado' THEN RETURN v_agendamento.status; END IF;
        IF v_agendamento.status <> 'pendente' OR v_agendamento.cancelamento_solicitado_por IS NOT NULL
            OR v_agendamento.data_hora <= now() THEN
            RAISE EXCEPTION 'Este agendamento não pode ser confirmado agora.';
        END IF;
        IF v_lado = 'cliente' THEN
            v_agendamento.cliente_confirmou_em := coalesce(v_agendamento.cliente_confirmou_em, now());
        ELSE
            v_agendamento.equipe_confirmou_em := coalesce(v_agendamento.equipe_confirmou_em, now());
        END IF;
        IF v_agendamento.cliente_confirmou_em IS NOT NULL AND v_agendamento.equipe_confirmou_em IS NOT NULL THEN
            v_agendamento.status := 'confirmado';
        END IF;
    WHEN 'pedir_cancelamento' THEN
        IF v_agendamento.status NOT IN ('pendente', 'confirmado') THEN
            RAISE EXCEPTION 'Este agendamento não está ativo.';
        END IF;
        IF v_agendamento.cancelamento_solicitado_por IS NOT NULL THEN RETURN v_agendamento.status; END IF;
        v_agendamento.cancelamento_solicitado_por := v_lado;
    WHEN 'aprovar_cancelamento', 'recusar_cancelamento', 'retirar_cancelamento' THEN
        IF v_agendamento.status = 'cancelado' AND p_acao = 'aprovar_cancelamento' THEN RETURN v_agendamento.status; END IF;
        IF v_agendamento.status NOT IN ('pendente', 'confirmado') OR v_agendamento.cancelamento_solicitado_por IS NULL
            OR (v_agendamento.cancelamento_solicitado_por = v_lado) <> (p_acao = 'retirar_cancelamento') THEN
            RAISE EXCEPTION 'Este pedido de cancelamento já mudou ou precisa da outra parte.';
        END IF;
        IF p_acao = 'aprovar_cancelamento' THEN
            v_agendamento.status := 'cancelado';
            v_agendamento.cancelamento_confirmado_em := now();
        ELSE
            v_agendamento.cancelamento_solicitado_por := NULL;
        END IF;
    WHEN 'finalizar' THEN
        IF v_lado <> 'equipe' THEN
            RAISE EXCEPTION 'Só a equipe pode finalizar um atendimento.';
        END IF;
        IF v_agendamento.status = 'finalizado' THEN RETURN v_agendamento.status; END IF;
        IF NOT (v_agendamento.status = 'confirmado'
                OR (v_agendamento.status = 'pendente' AND v_agendamento.data_hora <= now())) THEN
            RAISE EXCEPTION 'A equipe pode finalizar um agendamento confirmado ou um horário que já passou.';
        END IF;
        IF v_agendamento.cancelamento_solicitado_por IS NOT NULL THEN
            RAISE EXCEPTION 'Resolva o pedido de cancelamento antes de finalizar.';
        END IF;
        v_agendamento.status := 'finalizado';
    WHEN 'nao_compareceu' THEN
        IF v_lado <> 'equipe' THEN
            RAISE EXCEPTION 'Só a equipe pode registrar que o cliente não veio.';
        END IF;
        IF v_agendamento.status = 'cancelado' THEN RETURN v_agendamento.status; END IF;
        IF v_agendamento.status NOT IN ('pendente', 'confirmado') OR v_agendamento.data_hora > now() THEN
            RAISE EXCEPTION 'Só dá para registrar a falta depois do horário marcado.';
        END IF;
        v_agendamento.status := 'cancelado';
        v_agendamento.cancelamento_solicitado_por := 'equipe';
        v_agendamento.cancelamento_confirmado_em := now();
    ELSE
        RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023';
    END CASE;

    UPDATE public.agendamentos
    SET status = v_agendamento.status,
        cliente_confirmou_em = v_agendamento.cliente_confirmou_em,
        equipe_confirmou_em = v_agendamento.equipe_confirmou_em,
        cancelamento_solicitado_por = v_agendamento.cancelamento_solicitado_por,
        cancelamento_confirmado_em = v_agendamento.cancelamento_confirmado_em
    WHERE id = p_id;
    RETURN v_agendamento.status;
END;
$$;

-- 2) Foto do profissional (a imagem fica no bucket "gallery", pasta da barbearia).
ALTER TABLE public.funcionarios ADD COLUMN foto_url text;

-- 3) Remuneração do profissional. Fica fora de "funcionarios", que é pública
--    (a página de agendamento lista a equipe): só o dono vê/edita e o próprio profissional vê a sua.
CREATE TABLE public.funcionarios_remuneracao (
    funcionario_id uuid PRIMARY KEY REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    barbearia_id uuid NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    tipo text NOT NULL DEFAULT 'comissao' CHECK (tipo IN ('fixo', 'comissao', 'fixo_comissao')),
    salario_fixo numeric(10, 2) NOT NULL DEFAULT 0 CHECK (salario_fixo >= 0),
    comissao_percentual numeric(5, 2) NOT NULL DEFAULT 0 CHECK (comissao_percentual BETWEEN 0 AND 100),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT funcionarios_remuneracao_da_barbearia
        FOREIGN KEY (barbearia_id, funcionario_id) REFERENCES public.funcionarios(barbearia_id, id) ON DELETE CASCADE
);

ALTER TABLE public.funcionarios_remuneracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono gerencia a remuneração da equipe" ON public.funcionarios_remuneracao
    FOR ALL TO authenticated
    USING (public.user_is_admin_of_barbearia(barbearia_id))
    WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

CREATE POLICY "Profissional vê a própria remuneração" ON public.funcionarios_remuneracao
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.funcionarios f
        WHERE f.id = funcionarios_remuneracao.funcionario_id AND f.user_id = auth.uid()
    ));

REVOKE ALL ON public.funcionarios_remuneracao FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios_remuneracao TO authenticated;

COMMIT;
