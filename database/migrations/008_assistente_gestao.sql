CREATE TABLE public.despesas_barbearia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    descricao text NOT NULL CHECK (char_length(btrim(descricao)) BETWEEN 1 AND 120),
    valor numeric(12,2) NOT NULL CHECK (valor > 0 AND valor <> 'NaN'::numeric),
    data date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX despesas_barbearia_data_idx ON public.despesas_barbearia (barbearia_id, data);
ALTER TABLE public.despesas_barbearia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.despesas_barbearia FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.despesas_barbearia TO authenticated;

CREATE POLICY "Admin consulta despesas da barbearia" ON public.despesas_barbearia
    FOR SELECT TO authenticated USING (public.user_is_admin_of_barbearia(barbearia_id));

CREATE POLICY "Admin registra despesas da barbearia" ON public.despesas_barbearia
    FOR INSERT TO authenticated WITH CHECK (public.user_is_admin_of_barbearia(barbearia_id));

CREATE FUNCTION public.resumo_assistente_barbearia(p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_barbearia uuid := public.get_user_barbearia_id();
    v_role public.user_role := public.get_current_user_role();
    v_funcionario uuid;
    v_atendimentos bigint;
    v_cortes bigint;
    v_faturamento numeric;
    v_despesas bigint;
    v_gastos numeric;
BEGIN
    IF v_barbearia IS NULL OR v_role IS NULL OR v_role NOT IN ('admin', 'funcionario') THEN
        RAISE EXCEPTION 'Acesso restrito à equipe da barbearia' USING ERRCODE = '42501';
    END IF;
    IF p_inicio IS NULL OR p_fim IS NULL OR p_fim - p_inicio NOT BETWEEN 0 AND 365 THEN
        RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22023';
    END IF;

    IF v_role = 'funcionario' THEN
        SELECT f.id INTO v_funcionario FROM public.funcionarios f
        WHERE f.barbearia_id = v_barbearia AND f.user_id = auth.uid();
    END IF;

    SELECT count(*),
           count(*) FILTER (
               WHERE lower(s.nome) ~ '(^|[^[:alnum:]])(corte|degrad[eê])([^[:alnum:]]|$)'
                  OR lower(s.nome) ~ '^\s*cabelo\s*(\+|$)'
                  OR lower(c.nome) IN ('corte', 'cortes') OR lower(c2.nome) IN ('corte', 'cortes')
           ),
           CASE WHEN v_role = 'admin' THEN coalesce(sum(s.valor), 0) END
      INTO v_atendimentos, v_cortes, v_faturamento
      FROM public.agendamentos a
      JOIN public.servicos s ON s.id = a.servico_id AND s.barbearia_id = v_barbearia
      LEFT JOIN public.categorias_servicos c ON c.id = s.categoria_id
      LEFT JOIN public.categorias_servicos c2 ON c2.id = s.categoria_id_2
      WHERE a.barbearia_id = v_barbearia AND a.status = 'finalizado'
        AND a.data_hora >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND a.data_hora < ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND (v_role = 'admin' OR a.funcionario_id = v_funcionario);

    IF v_role = 'admin' THEN
        SELECT count(*), coalesce(sum(d.valor), 0)
        INTO v_despesas, v_gastos
        FROM public.despesas_barbearia d
        WHERE d.barbearia_id = v_barbearia AND d.data BETWEEN p_inicio AND p_fim;
    END IF;

    RETURN jsonb_build_object(
        'atendimentos', v_atendimentos,
        'cortes', v_cortes,
        'faturamento', v_faturamento,
        'despesas', v_despesas,
        'gastos', v_gastos,
        'lucro', CASE WHEN v_despesas > 0 THEN v_faturamento - v_gastos END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resumo_assistente_barbearia(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_assistente_barbearia(date, date) TO authenticated;
