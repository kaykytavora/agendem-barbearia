-- =============================================================================
-- 005 - ARQUIVOS, TEMPO REAL E DADOS INICIAIS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage: imagens das barbearias
-- -----------------------------------------------------------------------------
-- O caminho de cada arquivo começa pelo id da barbearia:
--
--   logos/<barbearia_id>/logo-1712345678-foto.webp
--
-- As regras comparam essa primeira pasta com a barbearia de quem envia, assim um
-- admin não consegue trocar ou apagar imagens de outra barbearia.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('logos',   'logos',   true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('gallery', 'gallery', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Todos veem as imagens das barbearias" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id IN ('logos', 'gallery'));

CREATE POLICY "Admin envia imagens da barbearia" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('logos', 'gallery')
        AND public.get_current_user_role() = 'admin'
        AND (storage.foldername(name))[1] = public.get_user_barbearia_id()::text
    );

CREATE POLICY "Admin altera imagens da barbearia" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id IN ('logos', 'gallery')
        AND public.get_current_user_role() = 'admin'
        AND (storage.foldername(name))[1] = public.get_user_barbearia_id()::text
    );

CREATE POLICY "Admin remove imagens da barbearia" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id IN ('logos', 'gallery')
        AND public.get_current_user_role() = 'admin'
        AND (storage.foldername(name))[1] = public.get_user_barbearia_id()::text
    );


-- -----------------------------------------------------------------------------
-- Realtime: avisa o app quando estas tabelas mudam
-- -----------------------------------------------------------------------------
-- Usado nas notificações da equipe e no painel do cliente. O RLS continua valendo:
-- cada pessoa só recebe eventos das linhas que pode ler.

ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos, public.feedbacks;


-- -----------------------------------------------------------------------------
-- Dados iniciais: categorias compartilhadas por todas as barbearias
-- -----------------------------------------------------------------------------

INSERT INTO public.categorias_servicos (nome, descricao)
VALUES
    ('Cabelo',      'Cortes e penteados'),
    ('Barba',       'Barba, bigode e acabamento'),
    ('Combo',       'Pacotes com mais de um serviço'),
    ('Sobrancelha', 'Design e acabamento de sobrancelhas'),
    ('Coloração',   'Luzes, pigmentação e descoloração'),
    ('Tratamento',  'Hidratação e cuidados para cabelo e pele')
ON CONFLICT (nome) DO NOTHING;
