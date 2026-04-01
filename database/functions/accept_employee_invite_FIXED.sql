-- Database function for accepting employee invites (CORRIGIDA - SEM COLUNA EMAIL)
-- Cole este código no SQL Editor do Supabase para corrigir o erro

CREATE OR REPLACE FUNCTION accept_employee_invite(
  invite_token TEXT,
  employee_password TEXT
) RETURNS JSON AS $$
DECLARE
  invite_data RECORD;
  new_employee_id UUID;
  result JSON;
BEGIN
  -- Validate invite token
  SELECT * INTO invite_data
  FROM funcionario_convites
  WHERE token = invite_token
    AND usado = false
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Convite inválido ou expirado'
    );
  END IF;

  -- Check if employee already exists for this barbershop (by name since email column doesn't exist)
  IF EXISTS (
    SELECT 1 FROM funcionarios
    WHERE nome = (invite_data.funcionario_data->>'nome')::TEXT
      AND barbearia_id = invite_data.barbearia_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Funcionário já existe nesta barbearia'
    );
  END IF;

  -- Create employee record (without email column since it doesn't exist)
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
    NULL, -- Will be filled when auth account is created
    NOW(),
    NOW()
  ) RETURNING id INTO new_employee_id;

  -- Mark invite as used
  UPDATE funcionario_convites
  SET usado = true, updated_at = NOW()
  WHERE id = invite_data.id;

  -- Log the successful acceptance (optional - só se a tabela existir)
  BEGIN
    INSERT INTO employee_invite_logs (
      invite_id,
      employee_id,
      action,
      created_at
    ) VALUES (
      invite_data.id,
      new_employee_id,
      'accepted',
      NOW()
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- Tabela de logs não existe, continuar sem erro
      NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'employee_id', new_employee_id,
    'message', 'Funcionário registrado com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to anon role
GRANT EXECUTE ON FUNCTION accept_employee_invite(TEXT, TEXT) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION accept_employee_invite(TEXT, TEXT) IS
'Accepts employee invitation by creating employee record and marking invite as used.
Returns JSON with success status and employee_id or error message.
FIXED VERSION: Removed email column references to match actual table schema.';