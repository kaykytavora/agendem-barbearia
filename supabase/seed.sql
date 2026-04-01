-- Dados de teste para verificar políticas RLS

-- Inserir uma barbearia de teste
INSERT INTO public.barbearias (id, nome, slug, endereco, cidade, bairro, cep, email_contato, telefone)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Barbearia Teste',
  'barbearia-teste',
  'Rua Teste, 123',
  'São Paulo',
  'Centro',
  '01000-000',
  'contato@barbeariateste.com',
  '11999999999'
);

-- Inserir categoria de serviço
INSERT INTO public.categorias_servicos (id, nome, descricao)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Cortes',
  'Serviços de corte de cabelo'
);

-- Inserir um serviço de teste
INSERT INTO public.servicos (id, barbearia_id, nome, descricao, valor, duracao_minutos, categoria_id)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440000',
  'Corte Masculino',
  'Corte de cabelo masculino tradicional',
  25.00,
  30,
  '550e8400-e29b-41d4-a716-446655440001'
);

-- Inserir um funcionário de teste
INSERT INTO public.funcionarios (id, barbearia_id, nome)
VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440000',
  'João Barbeiro'
);

-- Inserir um agendamento anônimo de teste
INSERT INTO public.agendamentos (
  id,
  barbearia_id,
  servico_id,
  funcionario_id,
  cliente_nome,
  cliente_telefone,
  cliente_email,
  data_hora,
  status
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  'Cliente Anônimo',
  '11987654321',
  'cliente@email.com',
  NOW() + INTERVAL '1 day',
  'pendente'
);

-- Inserir um usuário de teste para simular staff
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440005',
  'staff@barbeariateste.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Inserir perfil do staff
INSERT INTO public.profiles (id, user_id, name, phone, role, barbearia_id)
VALUES (
  '550e8400-e29b-41d4-a716-446655440006',
  '550e8400-e29b-41d4-a716-446655440005',
  'Staff Teste',
  '11999888777',
  'funcionario',
  '550e8400-e29b-41d4-a716-446655440000'
);