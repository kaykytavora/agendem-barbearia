-- O cadastro manual da equipe usa metadados próprios. O Google só cria perfis de cliente.
CREATE FUNCTION public.preparar_cadastro_google()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
    v_dados jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
    NEW.raw_user_meta_data := (v_dados - 'role' - 'barbershop_name') || jsonb_build_object(
        'name', coalesce(nullif(btrim(v_dados ->> 'name'), ''), nullif(btrim(v_dados ->> 'full_name'), ''), '')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER preparar_cadastro_google
BEFORE INSERT ON auth.users
FOR EACH ROW WHEN (NEW.raw_app_meta_data ->> 'provider' = 'google')
EXECUTE FUNCTION public.preparar_cadastro_google();

-- Custom Access Token Hook. A origem da sessão continua no AMR na renovação do token.
CREATE FUNCTION public.restringir_login_social_equipe(evento jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_claims jsonb := evento -> 'claims';
BEGIN
    IF evento ->> 'authentication_method' = 'oauth'
        OR coalesce(v_claims -> 'amr', '[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = (evento ->> 'user_id')::uuid AND p.role = 'cliente'
        ) THEN
            RETURN jsonb_build_object('error', jsonb_build_object(
                'http_code', 403, 'message', 'LOGIN_EQUIPE_REQUER_SENHA'
            ));
        END IF;
    END IF;
    RETURN jsonb_build_object('claims', v_claims);
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_cadastro_google() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restringir_login_social_equipe(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.restringir_login_social_equipe(jsonb) TO supabase_auth_admin;
