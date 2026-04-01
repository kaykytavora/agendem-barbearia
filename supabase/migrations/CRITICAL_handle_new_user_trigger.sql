-- =====================================================
-- SQL CRÍTICO - DEVE SER EXECUTADO NO SUPABASE
-- Execute no SQL Editor do Supabase
-- =====================================================

-- Primeiro, verificar se as funções auxiliares existem
-- Se não existirem, criar:

-- Função para obter a role do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_val public.user_role;
BEGIN
  -- Se não houver usuário logado, retorna NULL
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Tenta obter a role do perfil do usuário
  SELECT p.role INTO user_role_val
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  RETURN user_role_val;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Função para obter o barbearia_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_barbearia_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  barbearia_uuid uuid;
BEGIN
  -- Se não houver usuário logado, retorna NULL
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Tenta obter o barbearia_id do perfil do usuário
  SELECT p.barbearia_id INTO barbearia_uuid
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  RETURN barbearia_uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Função para obter o barbearia_id passando o UUID do usuário
CREATE OR REPLACE FUNCTION public.get_user_barbearia_id(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  barbearia_uuid uuid;
BEGIN
  -- Tenta obter o barbearia_id do perfil do usuário
  SELECT p.barbearia_id INTO barbearia_uuid
  FROM public.profiles p
  WHERE p.user_id = user_uuid;
  
  RETURN barbearia_uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- =====================================================
-- CRiar função handle_new_user para automatizar criação de perfil e barbearia
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_barbearia_id uuid;
    v_role text;
BEGIN
    -- Obter a role dos metadados
    v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'cliente');
    
    -- Se a role for 'cliente', apenas insere no profiles e termina.
    IF v_role = 'cliente' THEN
        INSERT INTO public.profiles (user_id, name, phone, role)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
            COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
            'cliente'::public.user_role
        );
        RETURN NEW;
    END IF;

    -- Para admin e outros: primeiro cria o perfil
    INSERT INTO public.profiles (user_id, name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
        v_role::public.user_role
    );

    -- Se tiver nome da barbearia, criar a barbearia
    IF (NEW.raw_user_meta_data ->> 'barbershop_name') IS NOT NULL AND v_role = 'admin' THEN
        INSERT INTO public.barbearias (nome, cidade, slug)
        VALUES (
            NEW.raw_user_meta_data ->> 'barbershop_name',
            'Não informado',
            lower(replace(NEW.raw_user_meta_data ->> 'barbershop_name', ' ', '-')) || '-' || substr(NEW.id::text, 1, 8)
        )
        RETURNING id INTO new_barbearia_id;

        -- Associar o usuário à barbearia
        UPDATE public.profiles
        SET barbearia_id = new_barbearia_id
        WHERE user_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

-- Criar trigger para executar a função quando um usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- POLÍTICAS RLS PARA PERMITIR INSERT VIA TRIGGER
-- =====================================================

-- Permitir INSERT no profiles para o próprio usuário
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
CREATE POLICY "Allow insert for authenticated users" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Permitir INSERT na barbearias para admins (usando bypass via função)
DROP POLICY IF EXISTS "Admins can insert barbearias" ON public.barbearias;
CREATE POLICY "Admins can insert barbearias" ON public.barbearias 
    FOR INSERT TO authenticated 
    WITH CHECK (
        -- Permite se a role for admin E o usuário tiver uma barbearia_id
        -- OU se estiver criando a primeira barbearia (barbearia_id do usuário é NULL)
        (public.get_current_user_role() = 'admin' AND public.get_user_barbearia_id(auth.uid()) IS NOT NULL)
        OR 
        -- Permite criação inicial quando ainda não tem barbearia associada
        (public.get_current_user_role() = 'admin' AND public.get_user_barbearia_id(auth.uid()) IS NULL)
    );

-- =====================================================
-- FIM DO SQL CRÍTICO
-- =====================================================
