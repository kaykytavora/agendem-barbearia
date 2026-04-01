-- CORREÇÃO FINAL - Remove todas as colunas que não existem na tabela funcionarios

CREATE OR REPLACE FUNCTION accept_employee_invite(
  invite_token TEXT,
  employee_password TEXT
) RETURNS JSON AS $$
DECLARE
  invite_data RECORD;
  new_employee_id UUID;
BEGIN
  -- Validate invite token
  SELECT * INTO invite_data
  FROM funcionario_convites
  WHERE token = invite_token
    AND usado = false
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;

  -- Check if employee already exists (by name)
  IF EXISTS (
    SELECT 1 FROM funcionarios
    WHERE nome = (invite_data.funcionario_data->>'nome')::TEXT
      AND barbearia_id = invite_data.barbearia_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Funcionário já existe nesta barbearia');
  END IF;

  -- Create employee record - APENAS colunas que existem na tabela
  INSERT INTO funcionarios (
    nome,
    nivel_permissao,
    barbearia_id,
    ativo,
    user_id
  ) VALUES (
    (invite_data.funcionario_data->>'nome')::TEXT,
    (invite_data.funcionario_data->>'nivel_permissao')::TEXT,
    invite_data.barbearia_id,
    true,
    NULL
  ) RETURNING id INTO new_employee_id;

  -- Mark invite as used
  UPDATE funcionario_convites
  SET usado = true
  WHERE id = invite_data.id;

  RETURN json_build_object(
    'success', true,
    'employee_id', new_employee_id,
    'message', 'Funcionário registrado com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;