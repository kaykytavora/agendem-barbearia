BEGIN;

ALTER TABLE public.funcionarios ADD CONSTRAINT funcionarios_barbearia_id_id_key UNIQUE (barbearia_id, id);
ALTER TABLE public.servicos ADD COLUMN responsavel_id uuid,
    ADD CONSTRAINT servicos_responsavel_da_barbearia
    FOREIGN KEY (barbearia_id, responsavel_id) REFERENCES public.funcionarios(barbearia_id, id)
    ON DELETE SET NULL (responsavel_id);
CREATE INDEX servicos_responsavel_id_idx ON public.servicos (barbearia_id, responsavel_id) WHERE responsavel_id IS NOT NULL;

-- Preserva o catálogo existente quando a barbearia já tem serviço e equipe cadastrados.
UPDATE public.servicos s
SET responsavel_id = (
    SELECT f.id FROM public.funcionarios f
    WHERE f.barbearia_id = s.barbearia_id
    ORDER BY f.is_owner DESC NULLS LAST, f.created_at, f.id
    LIMIT 1
);

CREATE FUNCTION public.barbearia_com_equipe_e_servico(p_barbearia uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.servicos s
        WHERE s.barbearia_id = p_barbearia AND s.responsavel_id IS NOT NULL
    )
$$;
REVOKE ALL ON FUNCTION public.barbearia_com_equipe_e_servico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.barbearia_com_equipe_e_servico(uuid) TO anon, authenticated;

CREATE POLICY "Visibilidade de barbearias com atendimento configurado" ON public.barbearias
    AS RESTRICTIVE FOR SELECT TO anon, authenticated
    USING (
        public.barbearia_com_equipe_e_servico(id)
        OR public.user_is_staff_of_barbearia(id)
        OR (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.agendamentos a
                WHERE a.barbearia_id = barbearias.id AND a.user_id = auth.uid()
            )
        )
    );

-- Mantém a trava da desativação e valida também o serviço escolhido em novas reservas públicas.
CREATE OR REPLACE FUNCTION public.validar_nova_reserva_publica() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_desativada_em timestamptz;
BEGIN
    IF NOT public.user_is_staff_of_barbearia(NEW.barbearia_id) THEN
        SELECT b.desativada_em INTO v_desativada_em FROM public.barbearias b
        WHERE b.id = NEW.barbearia_id FOR SHARE;

        IF v_desativada_em IS NOT NULL THEN
            RAISE EXCEPTION 'BARBEARIA_DESATIVADA: Esta barbearia está com os agendamentos online pausados.';
        END IF;

        PERFORM 1 FROM public.servicos s
        WHERE s.id = NEW.servico_id AND s.barbearia_id = NEW.barbearia_id AND s.responsavel_id IS NOT NULL
        FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'SERVICO_INDISPONIVEL: Este serviço não está disponível para reservas online.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMIT;
