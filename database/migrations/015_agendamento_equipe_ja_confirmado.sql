BEGIN;

-- Agendamento criado pela equipe (para um cliente) já nasce confirmado pelos dois lados:
-- quem marcou foi o próprio barbeiro, então não há confirmação a pedir ao cliente.
-- Reservas feitas pelo cliente (logado ou não) continuam aguardando a barbearia.
CREATE OR REPLACE FUNCTION public.iniciar_confirmacoes_agendamento() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    NEW.status := 'pendente';
    NEW.cliente_confirmou_em := NULL;
    NEW.equipe_confirmou_em := NULL;
    NEW.cancelamento_solicitado_por := NULL;
    NEW.cancelamento_confirmado_em := NULL;

    IF public.user_is_staff_of_barbearia(NEW.barbearia_id)
        AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
        NEW.status := 'confirmado';
        NEW.equipe_confirmou_em := now();
        NEW.cliente_confirmou_em := now();
    ELSIF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        NEW.equipe_confirmou_em := now();
    ELSE
        NEW.cliente_confirmou_em := now();
    END IF;
    RETURN NEW;
END;
$$;

-- Agendamentos futuros já criados pela equipe que ainda esperam o cliente passam a confirmados.
UPDATE public.agendamentos
SET status = 'confirmado', cliente_confirmou_em = now()
WHERE status = 'pendente'
  AND equipe_confirmou_em IS NOT NULL
  AND cliente_confirmou_em IS NULL
  AND cancelamento_solicitado_por IS NULL
  AND data_hora > now();

COMMIT;
