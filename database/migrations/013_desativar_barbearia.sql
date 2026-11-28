BEGIN;

ALTER TABLE public.barbearias ADD COLUMN desativada_em timestamptz;

-- Clientes com reservas anteriores ainda precisam dos dados da barbearia no histórico.
CREATE POLICY "Visibilidade de barbearias desativadas" ON public.barbearias
    AS RESTRICTIVE FOR SELECT TO anon, authenticated
    USING (
        desativada_em IS NULL
        OR public.user_is_staff_of_barbearia(id)
        OR (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.agendamentos a
                WHERE a.barbearia_id = barbearias.id AND a.user_id = auth.uid()
            )
        )
    );

CREATE FUNCTION public.validar_nova_reserva_publica() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_desativada_em timestamptz;
BEGIN
    IF NOT public.user_is_staff_of_barbearia(NEW.barbearia_id) THEN
        -- Serializa a criação da reserva com uma eventual desativação da barbearia.
        SELECT b.desativada_em INTO v_desativada_em
        FROM public.barbearias b
        WHERE b.id = NEW.barbearia_id
        FOR SHARE;

        IF v_desativada_em IS NOT NULL THEN
            RAISE EXCEPTION 'BARBEARIA_DESATIVADA: Esta barbearia está com os agendamentos online pausados.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_nova_reserva_publica() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validar_nova_reserva_publica
    BEFORE INSERT ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.validar_nova_reserva_publica();

COMMIT;
