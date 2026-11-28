-- Liga os serviços escolhidos juntos (ex.: corte + luzes) num único atendimento
-- e, ao cancelar um deles, sobe os seguintes para ocupar o tempo liberado.
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS grupo_id uuid;
CREATE INDEX IF NOT EXISTS agendamentos_grupo_id_idx ON public.agendamentos (grupo_id) WHERE grupo_id IS NOT NULL;
COMMENT ON COLUMN public.agendamentos.grupo_id IS 'Liga os serviços escolhidos juntos (ex.: corte + luzes) num único atendimento feito em sequência.';

-- Vincula combinações já criadas: mesmo cliente, barbearia e profissional, criadas juntas e em sequência
WITH base AS (
  SELECT a.id, a.barbearia_id, a.cliente_telefone, a.funcionario_id, a.data_hora, a.created_at,
         a.data_hora + make_interval(mins => s.duracao_minutos) AS fim
  FROM public.agendamentos a JOIN public.servicos s ON s.id = a.servico_id
  WHERE a.status IN ('pendente','confirmado') AND a.grupo_id IS NULL
), marcado AS (
  SELECT b.*, CASE WHEN EXISTS (
      SELECT 1 FROM base p WHERE p.barbearia_id = b.barbearia_id AND p.cliente_telefone = b.cliente_telefone
        AND p.funcionario_id IS NOT DISTINCT FROM b.funcionario_id AND p.fim = b.data_hora
        AND abs(extract(epoch FROM p.created_at - b.created_at)) < 120
    ) THEN 0 ELSE 1 END AS novo
  FROM base b
), cadeias AS (
  SELECT m.*, sum(novo) OVER (PARTITION BY barbearia_id, cliente_telefone, funcionario_id ORDER BY data_hora) AS cadeia
  FROM marcado m
), grupos AS (
  SELECT id, count(*) OVER w AS qtd,
         first_value(id) OVER (PARTITION BY barbearia_id, cliente_telefone, funcionario_id, cadeia ORDER BY data_hora) AS grupo
  FROM cadeias WINDOW w AS (PARTITION BY barbearia_id, cliente_telefone, funcionario_id, cadeia)
)
UPDATE public.agendamentos a SET grupo_id = g.grupo FROM grupos g WHERE g.id = a.id AND g.qtd > 1;

CREATE OR REPLACE FUNCTION public.compactar_grupo_ao_cancelar()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
    v_duracao integer;
    v_item record;
BEGIN
    IF NEW.grupo_id IS NULL OR NEW.status <> 'cancelado' OR OLD.status NOT IN ('pendente', 'confirmado') THEN
        RETURN NULL;
    END IF;

    SELECT s.duracao_minutos INTO v_duracao FROM public.servicos s WHERE s.id = OLD.servico_id;

    -- Em ordem crescente, para cada serviço ocupar o espaço que o anterior acabou de liberar
    FOR v_item IN
        SELECT a.id FROM public.agendamentos a
        WHERE a.grupo_id = NEW.grupo_id AND a.id <> NEW.id
          AND a.status IN ('pendente', 'confirmado') AND a.data_hora > OLD.data_hora
        ORDER BY a.data_hora
    LOOP
        UPDATE public.agendamentos
        SET data_hora = data_hora - make_interval(mins => v_duracao)
        WHERE id = v_item.id;
    END LOOP;

    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS compactar_grupo_ao_cancelar ON public.agendamentos;
CREATE TRIGGER compactar_grupo_ao_cancelar AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.compactar_grupo_ao_cancelar();
