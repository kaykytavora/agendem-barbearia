-- Execute esta query no Supabase para ver a estrutura real da tabela funcionarios
-- Depois me fale quais colunas existem

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'funcionarios'
  AND table_schema = 'public'
ORDER BY ordinal_position;