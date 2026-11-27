ALTER TABLE public.agendamentos
    ADD COLUMN cliente_confirmou_em timestamptz,
    ADD COLUMN equipe_confirmou_em timestamptz,
    ADD COLUMN cancelamento_solicitado_por text CHECK (cancelamento_solicitado_por IN ('cliente', 'equipe')),
    ADD COLUMN cancelamento_confirmado_em timestamptz;

CREATE FUNCTION public.iniciar_confirmacoes_agendamento() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    NEW.status := 'pendente';
    NEW.cliente_confirmou_em := NULL;
    NEW.equipe_confirmou_em := NULL;
    NEW.cancelamento_solicitado_por := NULL;
    NEW.cancelamento_confirmado_em := NULL;
    IF NEW.user_id IS DISTINCT FROM auth.uid()
        OR (NEW.user_id IS NULL AND public.user_is_staff_of_barbearia(NEW.barbearia_id)) THEN
        NEW.equipe_confirmou_em := now();
    ELSE
        NEW.cliente_confirmou_em := now();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER iniciar_confirmacoes_agendamento
BEFORE INSERT ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.iniciar_confirmacoes_agendamento();

-- As transições de status e as confirmações ficam na função com validação de lado.
REVOKE UPDATE ON public.agendamentos FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.lado_agendamento(p_agendamento public.agendamentos, p_token text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
BEGIN
    IF p_token IS NOT NULL THEN
        IF p_agendamento.user_id IS NULL AND p_token ~ '^[0-9a-f]{128}$'
            AND p_agendamento.booking_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') THEN
            RETURN 'cliente';
        END IF;
        RETURN NULL;
    END IF;
    IF p_agendamento.user_id = auth.uid() THEN RETURN 'cliente'; END IF;
    IF public.user_is_admin_of_barbearia(p_agendamento.barbearia_id)
        OR (public.user_is_staff_of_barbearia(p_agendamento.barbearia_id)
            AND EXISTS (
                SELECT 1 FROM public.funcionarios f
                WHERE f.user_id = auth.uid() AND f.barbearia_id = p_agendamento.barbearia_id
                    AND (p_agendamento.funcionario_id IS NULL OR f.id = p_agendamento.funcionario_id)
            )) THEN
        RETURN 'equipe';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.gerenciar_agendamento(p_id uuid, p_acao text, p_token text DEFAULT NULL)
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
        IF v_lado <> 'equipe' OR v_agendamento.status <> 'confirmado' THEN
            RAISE EXCEPTION 'A equipe pode finalizar um agendamento confirmado.';
        END IF;
        IF v_agendamento.cancelamento_solicitado_por IS NOT NULL THEN
            RAISE EXCEPTION 'Resolva o pedido de cancelamento antes de finalizar.';
        END IF;
        v_agendamento.status := 'finalizado';
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

CREATE FUNCTION public.consultar_agendamento_por_link(p_id uuid, p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'id', a.id, 'status', a.status, 'data_hora', a.data_hora,
        'cliente_confirmou_em', a.cliente_confirmou_em, 'equipe_confirmou_em', a.equipe_confirmou_em,
        'cancelamento_solicitado_por', a.cancelamento_solicitado_por, 'cancelamento_confirmado_em', a.cancelamento_confirmado_em,
        'barbearia', b.nome, 'servico', s.nome, 'profissional', f.nome
    )
    FROM public.agendamentos a
    JOIN public.barbearias b ON b.id = a.barbearia_id
    JOIN public.servicos s ON s.id = a.servico_id
    LEFT JOIN public.funcionarios f ON f.id = a.funcionario_id
    WHERE a.id = p_id AND p_token IS NOT NULL AND public.lado_agendamento(a, p_token) = 'cliente';
$$;

CREATE FUNCTION public.renovar_link_agendamento(p_id uuid, p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_agendamento public.agendamentos;
BEGIN
    SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR v_agendamento.user_id IS NOT NULL
        OR public.lado_agendamento(v_agendamento, NULL) IS DISTINCT FROM 'equipe'
        OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Agendamento indisponível.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.agendamentos SET booking_token_hash = p_hash WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_confirmacoes_agendamento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lado_agendamento(public.agendamentos, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gerenciar_agendamento(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_agendamento_por_link(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renovar_link_agendamento(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_agendamento(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_agendamento_por_link(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renovar_link_agendamento(uuid, text) TO authenticated;
