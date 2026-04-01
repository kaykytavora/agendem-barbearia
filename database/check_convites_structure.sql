-- Execute esta query no Supabase para ver a estrutura da tabela funcionario_convites
-- E também ver um exemplo de dados do funcionario_data

-- 1. Estrutura da tabela funcionario_convites
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'funcionario_convites'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver exemplo de dados para entender o que tem no funcionario_data
-- (execute separadamente se quiser)
/*
SELECT
  id,
  email,
  funcionario_data,
  usado,
  expires_at
FROM funcionario_convites
WHERE token = 'faae420a-6b6f-4e84-8f19-608519d3cec1-1758851504122'
LIMIT 1;
*/