-- Execute esta query para ver o conteúdo EXATO do funcionario_data do seu convite

SELECT
  id,
  email,
  funcionario_data,
  usado,
  token
FROM funcionario_convites
WHERE token = 'faae420a-6b6f-4e84-8f19-608519d3cec1-1758851504122';

-- E também vamos ver todas as chaves que existem no JSON funcionario_data
SELECT DISTINCT jsonb_object_keys(funcionario_data) as available_keys
FROM funcionario_convites
WHERE token = 'faae420a-6b6f-4e84-8f19-608519d3cec1-1758851504122';