CREATE TABLE public.programas_selos (
    barbearia_id uuid PRIMARY KEY REFERENCES public.barbearias (id) ON DELETE CASCADE,
    ativo boolean NOT NULL DEFAULT false,
    premio text NOT NULL CHECK (char_length(btrim(premio)) BETWEEN 1 AND 120),
    meta integer NOT NULL CHECK (meta > 0),
    servicos uuid[] NOT NULL CHECK (cardinality(servicos) > 0)
);

-- O selo permanece no cartão se um serviço for excluído depois do atendimento.
CREATE TABLE public.selos_agendamento (
    agendamento_id uuid PRIMARY KEY,
    barbearia_id uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    cliente_id uuid REFERENCES public.profiles (user_id) ON DELETE CASCADE
);
CREATE INDEX selos_agendamento_cliente_idx ON public.selos_agendamento (cliente_id, barbearia_id);

CREATE TABLE public.resgates_selos (
    id uuid PRIMARY KEY,
    barbearia_id uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    cliente_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
    premio text NOT NULL,
    custo integer NOT NULL CHECK (custo > 0),
    criado_em timestamptz NOT NULL DEFAULT now(),
    entregue_em timestamptz
);
CREATE INDEX resgates_selos_cliente_idx ON public.resgates_selos (cliente_id, barbearia_id);
CREATE INDEX resgates_selos_pendentes_idx ON public.resgates_selos (barbearia_id, criado_em) WHERE entregue_em IS NULL;

ALTER TABLE public.programas_selos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selos_agendamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resgates_selos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programas_selos, public.selos_agendamento, public.resgates_selos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.programas_selos TO anon, authenticated;
CREATE POLICY "Programa ativo ou da própria barbearia" ON public.programas_selos
    FOR SELECT TO anon, authenticated USING (ativo OR public.user_is_admin_of_barbearia(barbearia_id));

CREATE FUNCTION public.salvar_programa_selos(p_barbearia uuid, p_ativo boolean, p_premio text, p_meta integer, p_servicos uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_servicos uuid[];
BEGIN
    IF NOT public.user_is_admin_of_barbearia(p_barbearia) THEN
        RAISE EXCEPTION 'Somente o dono pode configurar os selos.' USING ERRCODE = '42501';
    END IF;
    IF p_ativo IS FALSE THEN
        UPDATE public.programas_selos SET ativo = false WHERE barbearia_id = p_barbearia;
        RETURN;
    END IF;
    IF p_ativo IS NULL OR p_premio IS NULL OR char_length(btrim(p_premio)) NOT BETWEEN 1 AND 120
        OR p_meta IS NULL OR p_meta < 1 OR coalesce(cardinality(p_servicos), 0) = 0 THEN
        RAISE EXCEPTION 'Preencha o prêmio, a quantidade de selos e os serviços participantes.';
    END IF;
    SELECT array_agg(DISTINCT servico) INTO v_servicos FROM unnest(p_servicos) AS servico;
    IF EXISTS (SELECT 1 FROM unnest(v_servicos) AS servico WHERE NOT EXISTS (
        SELECT 1 FROM public.servicos s WHERE s.id = servico AND s.barbearia_id = p_barbearia
    )) THEN
        RAISE EXCEPTION 'Selecione apenas serviços desta barbearia.';
    END IF;

    INSERT INTO public.programas_selos (barbearia_id, ativo, premio, meta, servicos)
    VALUES (p_barbearia, true, btrim(p_premio), p_meta, v_servicos)
    ON CONFLICT (barbearia_id) DO UPDATE SET ativo = true, premio = EXCLUDED.premio,
        meta = EXCLUDED.meta, servicos = EXCLUDED.servicos;
END;
$$;

CREATE FUNCTION public.creditar_selo_ao_finalizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.selos_agendamento (agendamento_id, barbearia_id, cliente_id)
    SELECT NEW.id, NEW.barbearia_id, NEW.user_id
    FROM public.programas_selos p
    WHERE p.barbearia_id = NEW.barbearia_id AND p.ativo AND NEW.servico_id = ANY(p.servicos)
    ON CONFLICT (agendamento_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER creditar_selo_ao_finalizar
AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW WHEN (NEW.status = 'finalizado' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.creditar_selo_ao_finalizar();

CREATE FUNCTION public.registrar_selo_do_link(p_id uuid, p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_cliente uuid := auth.uid();
    v_agendamento public.agendamentos;
BEGIN
    IF v_cliente IS NULL OR public.get_current_user_role() IS DISTINCT FROM 'cliente' THEN
        RAISE EXCEPTION 'Entre em uma conta de cliente para guardar o selo.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_id FOR SHARE;
    IF NOT FOUND OR p_token IS NULL OR v_agendamento.status <> 'finalizado'
        OR public.lado_agendamento(v_agendamento, p_token) IS DISTINCT FROM 'cliente' THEN
        RAISE EXCEPTION 'Link do atendimento indisponível.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.selos_agendamento SET cliente_id = v_cliente
    WHERE agendamento_id = p_id AND (cliente_id IS NULL OR cliente_id = v_cliente);
    IF NOT FOUND THEN RAISE EXCEPTION 'O selo já foi guardado ou este atendimento não gerou um selo.'; END IF;
END;
$$;

CREATE FUNCTION public.saldo_selos(p_cliente uuid, p_barbearia uuid)
RETURNS bigint LANGUAGE sql STABLE SET search_path = ''
AS $$
    SELECT (SELECT count(*) FROM public.selos_agendamento WHERE cliente_id = p_cliente AND barbearia_id = p_barbearia)
        - (SELECT coalesce(sum(custo), 0) FROM public.resgates_selos WHERE cliente_id = p_cliente AND barbearia_id = p_barbearia);
$$;

CREATE FUNCTION public.meus_cartoes_selos()
RETURNS TABLE (barbearia_id uuid, nome text, slug text, ativo boolean, premio text, meta integer, saldo bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p.barbearia_id, b.nome, b.slug, p.ativo, p.premio, p.meta, public.saldo_selos(auth.uid(), p.barbearia_id)
    FROM public.programas_selos p
    JOIN public.barbearias b ON b.id = p.barbearia_id
    WHERE EXISTS (SELECT 1 FROM public.selos_agendamento s WHERE s.cliente_id = auth.uid() AND s.barbearia_id = p.barbearia_id)
    ORDER BY b.nome;
$$;

CREATE FUNCTION public.resgatar_premio_selos(p_barbearia uuid, p_resgate uuid, p_premio text, p_meta integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_cliente uuid := auth.uid();
    v_programa public.programas_selos;
BEGIN
    IF v_cliente IS NULL OR p_resgate IS NULL OR public.get_current_user_role() IS DISTINCT FROM 'cliente' THEN
        RAISE EXCEPTION 'Entre em uma conta de cliente para resgatar.' USING ERRCODE = '42501';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('selos:' || p_barbearia::text || ':' || v_cliente::text, 0));
    IF EXISTS (SELECT 1 FROM public.resgates_selos WHERE id = p_resgate AND cliente_id = v_cliente AND barbearia_id = p_barbearia) THEN
        RETURN p_resgate;
    END IF;
    SELECT * INTO v_programa FROM public.programas_selos WHERE barbearia_id = p_barbearia FOR SHARE;
    IF NOT FOUND OR NOT v_programa.ativo THEN RAISE EXCEPTION 'O programa de selos está pausado.'; END IF;
    IF v_programa.meta IS DISTINCT FROM p_meta OR v_programa.premio IS DISTINCT FROM p_premio THEN
        RAISE EXCEPTION 'A barbearia atualizou o prêmio ou a meta. Confira o cartão e tente novamente.';
    END IF;
    IF public.saldo_selos(v_cliente, p_barbearia) < v_programa.meta THEN
        RAISE EXCEPTION 'Você ainda não tem selos suficientes.';
    END IF;
    INSERT INTO public.resgates_selos (id, barbearia_id, cliente_id, premio, custo)
    VALUES (p_resgate, p_barbearia, v_cliente, v_programa.premio, v_programa.meta);
    RETURN p_resgate;
END;
$$;

CREATE FUNCTION public.listar_resgates_selos(p_barbearia uuid DEFAULT NULL)
RETURNS TABLE (id uuid, barbearia text, cliente text, premio text, criado_em timestamptz, entregue_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF p_barbearia IS NOT NULL AND NOT public.user_is_staff_of_barbearia(p_barbearia) THEN
        RAISE EXCEPTION 'Acesso restrito à equipe da barbearia.' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT r.id, b.nome, c.name, r.premio, r.criado_em, r.entregue_em
    FROM public.resgates_selos r
    JOIN public.barbearias b ON b.id = r.barbearia_id
    JOIN public.profiles c ON c.user_id = r.cliente_id
    WHERE (p_barbearia IS NULL AND r.cliente_id = auth.uid())
        OR (r.barbearia_id = p_barbearia AND r.entregue_em IS NULL)
    ORDER BY r.criado_em DESC, r.id DESC;
END;
$$;

CREATE FUNCTION public.entregar_premio_selos(p_resgate uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    UPDATE public.resgates_selos
    SET entregue_em = coalesce(entregue_em, now())
    WHERE id = p_resgate AND public.user_is_staff_of_barbearia(barbearia_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Resgate indisponível.' USING ERRCODE = '42501'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consultar_agendamento_por_link(p_id uuid, p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'id', a.id, 'status', a.status, 'data_hora', a.data_hora,
        'cliente_confirmou_em', a.cliente_confirmou_em, 'equipe_confirmou_em', a.equipe_confirmou_em,
        'cancelamento_solicitado_por', a.cancelamento_solicitado_por, 'cancelamento_confirmado_em', a.cancelamento_confirmado_em,
        'barbearia', b.nome, 'servico', s.nome, 'profissional', f.nome,
        'selo_disponivel', EXISTS (SELECT 1 FROM public.selos_agendamento se WHERE se.agendamento_id = a.id AND se.cliente_id IS NULL)
    )
    FROM public.agendamentos a
    JOIN public.barbearias b ON b.id = a.barbearia_id
    JOIN public.servicos s ON s.id = a.servico_id
    LEFT JOIN public.funcionarios f ON f.id = a.funcionario_id
    WHERE a.id = p_id AND p_token IS NOT NULL AND public.lado_agendamento(a, p_token) = 'cliente';
$$;

REVOKE ALL ON FUNCTION public.creditar_selo_ao_finalizar(), public.saldo_selos(uuid, uuid),
    public.salvar_programa_selos(uuid, boolean, text, integer, uuid[]), public.registrar_selo_do_link(uuid, text),
    public.meus_cartoes_selos(), public.resgatar_premio_selos(uuid, uuid, text, integer), public.listar_resgates_selos(uuid),
    public.entregar_premio_selos(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_programa_selos(uuid, boolean, text, integer, uuid[]),
    public.registrar_selo_do_link(uuid, text), public.meus_cartoes_selos(), public.resgatar_premio_selos(uuid, uuid, text, integer),
    public.listar_resgates_selos(uuid), public.entregar_premio_selos(uuid) TO authenticated;
