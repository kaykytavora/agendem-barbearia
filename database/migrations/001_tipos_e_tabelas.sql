-- =============================================================================
-- 001 - TIPOS E TABELAS
-- =============================================================================
-- O Agendem é multi-barbearia: quase toda tabela tem `barbearia_id`, e é por essa
-- coluna que as regras de segurança (arquivo 004) separam os dados de cada negócio.
--
-- Mapa das tabelas (seta = "pertence a"):
--
--   auth.users (login, gerenciado pelo Supabase)
--       └── profiles (dados da pessoa e papel: cliente, funcionario ou admin)
--
--   barbearias (raiz de cada negócio)
--       ├── servicos ──────────────► categorias_servicos (lista global)
--       ├── funcionarios ──────────► profiles (quando o funcionário tem login)
--       │     ├── funcionario_pausas     (almoço, intervalo)
--       │     └── funcionario_ausencias  (férias, recesso)
--       ├── funcionario_convites         (convites por e-mail)
--       ├── horarios_funcionamento       (um registro por dia da semana)
--       ├── agendamentos ──────────► servicos, funcionarios, profiles, customers
--       │     └── feedbacks              (avaliação do atendimento)
--       ├── fidelidade                   (saldo de pontos por cliente)
--       ├── fidelidade_configuracoes     (regras de pontos da barbearia)
--       ├── recompensas
--       │     └── resgates_recompensas   (histórico de trocas)
--       └── assinaturas                  (plano da barbearia no Agendem)
--
--   customers  (clientes identificados pelo telefone, sem login)
--   audit_log  (registro de ações sensíveis, só para o backend)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tipos enumerados: limitam a coluna a uma lista fechada de valores
-- -----------------------------------------------------------------------------

-- Ciclo de vida do agendamento:
--
--   pendente ──► confirmado ──► finalizado
--       │             │
--       └─────────────┴───────► cancelado
CREATE TYPE public.agendamento_status AS ENUM ('pendente', 'confirmado', 'cancelado', 'finalizado');

CREATE TYPE public.metodo_pagamento AS ENUM ('cartao_credito', 'cartao_debito', 'pix', 'boleto', 'transferencia');

-- Cargo dentro da equipe da barbearia
CREATE TYPE public.nivel_permissao AS ENUM ('funcionario', 'gerente', 'dono');

CREATE TYPE public.status_assinatura AS ENUM ('ativa', 'cancelada', 'suspensa', 'vencida', 'teste');

CREATE TYPE public.tipo_plano AS ENUM ('basico', 'premium', 'empresarial');

-- Papel da pessoa no sistema; define o que ela pode ver e fazer
CREATE TYPE public.user_role AS ENUM ('cliente', 'admin', 'funcionario');


-- -----------------------------------------------------------------------------
-- Barbearias e pessoas
-- -----------------------------------------------------------------------------

CREATE TABLE public.barbearias (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                 text NOT NULL,
    logo_url             text,
    slug                 text UNIQUE,                         -- endereço público: /barbearia/<slug>
    descricao            text,
    endereco             text,
    bairro               text,
    cidade               text NOT NULL,
    cep                  text,
    email_contato        text,
    telefone             text,
    cores_personalizadas jsonb DEFAULT '{}'::jsonb,
    modo_tema            text DEFAULT 'dark' CHECK (modo_tema IN ('dark', 'light')),
    gallery_urls         text[] DEFAULT ARRAY[]::text[],
    fidelidade_ativa     boolean NOT NULL DEFAULT true,
    notificacoes_ativa   boolean DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Um perfil para cada login. Apagar o login apaga o perfil em cascata.
CREATE TABLE public.profiles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
    name                    text NOT NULL,
    phone                   text,
    role                    public.user_role NOT NULL DEFAULT 'cliente',
    barbearia_id            uuid REFERENCES public.barbearias (id) ON DELETE SET NULL,  -- só equipe
    receber_lembretes_email boolean DEFAULT true,
    receber_lembretes_sms   boolean DEFAULT false,
    consentimento_marketing boolean DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Clientes reconhecidos pelo telefone, mesmo sem conta. Só o backend acessa.
CREATE TABLE public.customers (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164   text NOT NULL UNIQUE,                        -- formato +5511999999999
    name         text,
    otp_verified boolean NOT NULL DEFAULT false,
    verified_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- Catálogo e equipe
-- -----------------------------------------------------------------------------

-- Lista compartilhada por todas as barbearias (usada também no filtro da busca)
CREATE TABLE public.categorias_servicos (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      text NOT NULL UNIQUE,
    descricao text
);

CREATE TABLE public.servicos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id    uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    nome            text NOT NULL,
    descricao       text,
    valor           numeric(10,2) NOT NULL,
    duracao_minutos integer NOT NULL,
    categoria_id    uuid REFERENCES public.categorias_servicos (id) ON DELETE SET NULL,
    categoria_id_2  uuid REFERENCES public.categorias_servicos (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.funcionarios (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid UNIQUE REFERENCES public.profiles (user_id) ON DELETE CASCADE,  -- nulo: sem login
    barbearia_id  uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    nome          text NOT NULL,
    email         text,
    especialidade text,
    nivel         public.nivel_permissao NOT NULL DEFAULT 'funcionario',
    is_owner      boolean DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Um registro por dia da semana (0 = domingo ... 6 = sábado)
CREATE TABLE public.horarios_funcionamento (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    dia_semana   integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_abre    time,
    hora_fecha   time,
    fechado      boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (barbearia_id, dia_semana)
);

-- Pausas curtas dentro de um dia; bloqueiam horários na agenda pública
CREATE TABLE public.funcionario_pausas (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id uuid NOT NULL REFERENCES public.funcionarios (id) ON DELETE CASCADE,
    barbearia_id   uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    data           date NOT NULL DEFAULT CURRENT_DATE,
    hora_inicio    time NOT NULL,
    hora_fim       time NOT NULL,
    motivo         text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT check_horario_valido CHECK (hora_fim > hora_inicio),
    CONSTRAINT unique_pausa_funcionario UNIQUE (funcionario_id, data, hora_inicio)
);

-- Períodos de dias inteiros em que o profissional não atende
CREATE TABLE public.funcionario_ausencias (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id uuid NOT NULL REFERENCES public.funcionarios (id) ON DELETE CASCADE,
    barbearia_id   uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    tipo           text NOT NULL CHECK (tipo IN ('ferias', 'recesso', 'outro')),
    data_inicio    date NOT NULL,
    data_fim       date NOT NULL,
    motivo         text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ausencia_datas_validas CHECK (data_fim >= data_inicio)
);

-- O token vai no link enviado por e-mail e é gerado aqui quando não for informado
CREATE TABLE public.funcionario_convites (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email            text NOT NULL,
    barbearia_id     uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    funcionario_data jsonb NOT NULL,                          -- nome, cargo e especialidade
    token            text UNIQUE DEFAULT encode(sha256(gen_random_uuid()::text::bytea), 'hex'),
    usado            boolean NOT NULL DEFAULT false,
    expires_at       timestamptz NOT NULL,
    created_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- Agendamentos e avaliações
-- -----------------------------------------------------------------------------

CREATE TABLE public.agendamentos (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id       uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    servico_id         uuid NOT NULL REFERENCES public.servicos (id) ON DELETE CASCADE,
    funcionario_id     uuid REFERENCES public.funcionarios (id) ON DELETE SET NULL,
    user_id            uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,  -- nulo: sem conta
    customer_id        uuid REFERENCES public.customers (id) ON DELETE SET NULL,
    cliente_nome       text NOT NULL,
    cliente_telefone   text NOT NULL,
    cliente_email      text,
    data_hora          timestamptz NOT NULL,
    status             public.agendamento_status NOT NULL DEFAULT 'pendente',
    avaliado           boolean NOT NULL DEFAULT false,
    booking_token_hash text,                                  -- só o hash do token de autoatendimento
    -- Calculada pelo banco: indica se quem agendou estava logado
    origem             text GENERATED ALWAYS AS (
                           CASE WHEN user_id IS NULL THEN 'anonimo' ELSE 'cliente' END
                       ) STORED,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Cada agendamento tem no máximo uma avaliação.
-- `rating` nasce nulo e é preenchido quando o cliente avalia.
CREATE TABLE public.feedbacks (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id      uuid NOT NULL UNIQUE REFERENCES public.agendamentos (id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
    barbearia_id        uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    rating              integer CHECK (rating BETWEEN 1 AND 5),
    comment             text,
    anonimo             boolean DEFAULT false,
    status              text NOT NULL DEFAULT 'pendente',     -- 'pendente' ou 'concluido'
    response            text,                                 -- resposta da barbearia
    response_created_at timestamptz,
    responded_by        uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- Programa de fidelidade
-- -----------------------------------------------------------------------------

-- O cliente é identificado pelo telefone dentro de cada barbearia
CREATE TABLE public.fidelidade (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
    barbearia_id     uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    cliente_telefone text,
    pontos           integer NOT NULL DEFAULT 0,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fidelidade_barbearia_telefone_unique UNIQUE (barbearia_id, cliente_telefone)
);

CREATE TABLE public.fidelidade_configuracoes (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id              uuid NOT NULL UNIQUE REFERENCES public.barbearias (id) ON DELETE CASCADE,
    pontos_por_servico        integer NOT NULL DEFAULT 1,
    pontos_minimos_recompensa integer DEFAULT 100,
    dias_expiracao            integer DEFAULT 365,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recompensas (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id       uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    nome               text NOT NULL,
    descricao          text,
    pontos_necessarios integer NOT NULL CHECK (pontos_necessarios > 0),
    ativo              boolean NOT NULL DEFAULT true,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.resgates_recompensas (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recompensa_id     uuid NOT NULL REFERENCES public.recompensas (id) ON DELETE CASCADE,
    cliente_telefone  text NOT NULL,
    barbearia_id      uuid NOT NULL REFERENCES public.barbearias (id) ON DELETE CASCADE,
    pontos_utilizados integer NOT NULL,
    data_resgate      timestamptz NOT NULL DEFAULT now(),
    status            text NOT NULL DEFAULT 'resgatado' CHECK (status IN ('resgatado', 'utilizado', 'cancelado'))
);


-- -----------------------------------------------------------------------------
-- Cobrança e auditoria
-- -----------------------------------------------------------------------------

CREATE TABLE public.assinaturas (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id           uuid NOT NULL UNIQUE REFERENCES public.barbearias (id) ON DELETE CASCADE,
    tipo_plano             public.tipo_plano NOT NULL DEFAULT 'basico',
    status                 public.status_assinatura NOT NULL DEFAULT 'teste',
    data_inicio            timestamptz NOT NULL DEFAULT now(),
    data_fim               timestamptz,
    data_cancelamento      timestamptz,
    valor_mensal           numeric(10,2) NOT NULL DEFAULT 0.00,
    moeda                  varchar(3) NOT NULL DEFAULT 'BRL',
    metodo_pagamento       public.metodo_pagamento,
    stripe_subscription_id text,
    stripe_customer_id     text,
    observacoes            text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    operation  text NOT NULL,
    table_name text NOT NULL,
    record_id  uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- Índices: aceleram as consultas mais frequentes do app
-- -----------------------------------------------------------------------------

CREATE INDEX idx_agendamentos_barbearia_data ON public.agendamentos (barbearia_id, data_hora);
CREATE INDEX idx_agendamentos_telefone       ON public.agendamentos (cliente_telefone);
CREATE INDEX idx_agendamentos_user           ON public.agendamentos (user_id);
CREATE INDEX idx_agendamentos_funcionario    ON public.agendamentos (funcionario_id);
CREATE INDEX idx_agendamentos_servico        ON public.agendamentos (servico_id);
CREATE INDEX idx_agendamentos_customer       ON public.agendamentos (customer_id);
CREATE INDEX idx_assinaturas_stripe          ON public.assinaturas (stripe_subscription_id);
CREATE INDEX idx_ausencias_barbearia         ON public.funcionario_ausencias (barbearia_id);
CREATE INDEX idx_ausencias_funcionario       ON public.funcionario_ausencias (funcionario_id, data_inicio, data_fim);
CREATE INDEX idx_convites_barbearia          ON public.funcionario_convites (barbearia_id);
CREATE INDEX idx_convites_email              ON public.funcionario_convites (email);
CREATE INDEX idx_convites_created_by         ON public.funcionario_convites (created_by);
CREATE INDEX idx_feedbacks_barbearia_status  ON public.feedbacks (barbearia_id, status);
CREATE INDEX idx_feedbacks_user              ON public.feedbacks (user_id);
CREATE INDEX idx_feedbacks_responded_by      ON public.feedbacks (responded_by);
CREATE INDEX idx_fidelidade_user             ON public.fidelidade (user_id);
CREATE INDEX idx_fidelidade_telefone         ON public.fidelidade (cliente_telefone);
CREATE INDEX idx_funcionarios_barbearia      ON public.funcionarios (barbearia_id);
CREATE INDEX idx_pausas_barbearia_data       ON public.funcionario_pausas (barbearia_id, data);
CREATE INDEX idx_profiles_barbearia          ON public.profiles (barbearia_id, role);
CREATE INDEX idx_profiles_phone              ON public.profiles (phone);
CREATE INDEX idx_recompensas_barbearia       ON public.recompensas (barbearia_id);
CREATE INDEX idx_resgates_barbearia_cliente  ON public.resgates_recompensas (barbearia_id, cliente_telefone);
CREATE INDEX idx_resgates_recompensa         ON public.resgates_recompensas (recompensa_id);
CREATE INDEX idx_servicos_barbearia          ON public.servicos (barbearia_id);
CREATE INDEX idx_servicos_categoria          ON public.servicos (categoria_id);
CREATE INDEX idx_servicos_categoria_2        ON public.servicos (categoria_id_2);
CREATE INDEX idx_audit_log_user              ON public.audit_log (user_id);
