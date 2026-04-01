-- VERSÃO DEFINITIVA - Com os campos EXATOS que existem no funcionario_data

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

  -- Check if employee already exists
  IF EXISTS (
    SELECT 1 FROM funcionarios
    WHERE nome = (invite_data.funcionario_data->>'nome')::TEXT
      AND barbearia_id = invite_data.barbearia_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Funcionário já existe nesta barbearia');
  END IF;

  -- Create employee record - USANDO OS CAMPOS QUE EXISTEM
  INSERT INTO funcionarios (
    user_id,
    barbearia_id,
    nome,
    nivel,
    created_at,
    updated_at
  ) VALUES (
    NULL, -- Will be filled when auth account is created
    invite_data.barbearia_id,
    (invite_data.funcionario_data->>'nome')::TEXT,
    (invite_data.funcionario_data->>'nivel_permissao')::TEXT,
    NOW(),
    NOW()
  ) RETURNING id INTO new_employee_id;

  -- Mark invite as used
  UPDATE funcionario_convites
  SET usado = true
  WHERE id = invite_data.id;

  RETURN json_build_object(
    'success', true,
    'employee_id', new_employee_id,
    'message', 'Funcionário registrado com sucesso',
    'nome', (invite_data.funcionario_data->>'nome')::TEXT,
    'nivel', (invite_data.funcionario_data->>'nivel_permissao')::TEXT
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;