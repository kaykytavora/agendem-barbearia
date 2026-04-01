-- APENAS AS CORREÇÕES - Execute somente isso se já tem a função no Supabase

-- Atualizar só as partes que referenciam email
CREATE OR REPLACE FUNCTION accept_employee_invite(
  invite_token TEXT,
  employee_password TEXT
) RETURNS JSON AS $$
DECLARE
  invite_data RECORD;
  new_employee_id UUID;
BEGIN
  -- Validate invite token (sem mudança)
  SELECT * INTO invite_data
  FROM funcionario_convites
  WHERE token = invite_token
    AND usado = false
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;

  -- CORREÇÃO 1: Mudar validação de duplicata para usar nome ao invés de email
  IF EXISTS (
    SELECT 1 FROM funcionarios
    WHERE nome = (invite_data.funcionario_data->>'nome')::TEXT
      AND barbearia_id = invite_data.barbearia_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Funcionário já existe nesta barbearia');
  END IF;

  -- CORREÇÃO 2: Remover coluna email do INSERT
  INSERT INTO funcionarios (
    nome,
    especialidade,
    nivel_permissao,
    foto_url,
    barbearia_id,
    ativo,
    user_id,
    created_at,
    updated_at
  ) VALUES (
    (invite_data.funcionario_data->>'nome')::TEXT,
    (invite_data.funcionario_data->>'especialidade')::TEXT,
    (invite_data.funcionario_data->>'nivel_permissao')::TEXT,
    (invite_data.funcionario_data->>'foto_url')::TEXT,
    invite_data.barbearia_id,
    true,
    NULL,
    NOW(),
    NOW()
  ) RETURNING id INTO new_employee_id;

  -- Mark invite as used (sem mudança)
  UPDATE funcionario_convites SET usado = true, updated_at = NOW() WHERE id = invite_data.id;

  RETURN json_build_object('success', true, 'employee_id', new_employee_id, 'message', 'Funcionário registrado com sucesso');

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;