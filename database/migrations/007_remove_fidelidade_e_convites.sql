-- =============================================================================
-- 007 - REMOVE O PROGRAMA DE FIDELIDADE E OS CONVITES
-- =============================================================================
-- O app não usa mais pontos, recompensas nem convites por e-mail. Quando este
-- arquivo foi escrito, as tabelas de fidelidade estavam vazias.
--
-- Precisa rodar depois do 006, que tira de handle_new_user o uso dos convites.
-- =============================================================================

DROP TABLE public.resgates_recompensas;
DROP TABLE public.recompensas;
DROP TABLE public.fidelidade_configuracoes;
DROP TABLE public.fidelidade;
DROP TABLE public.funcionario_convites;

DROP FUNCTION public.resgatar_recompensa(uuid, text, uuid);
DROP FUNCTION public.get_recompensas_disponiveis(uuid, text);
DROP FUNCTION public.get_user_phone();
DROP FUNCTION public.get_convite_por_token(text);

ALTER TABLE public.barbearias DROP COLUMN fidelidade_ativa;
