-- ==============================================================================
-- BANCO DE DADOS POSTGRESQL — MERCADINHO DO GELEIA (ERP + PDV)
-- ==============================================================================

-- 1. CRIAÇÃO DOS TIPOS ENUM
DO $$ BEGIN
  CREATE TYPE perfil_usuario_enum AS ENUM ('ADMIN', 'GERENTE', 'OPERADOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE largura_bobina_enum AS ENUM ('80mm', '58mm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE impressao_auto_enum AS ENUM ('SEMPRE', 'PERGUNTAR', 'NUNCA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forma_pagamento_enum AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE frequencia_backup_enum AS ENUM ('DIARIO', '12H', 'SEMANAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_backup_enum AS ENUM ('AUTOMATICO', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE unidade_medida_enum AS ENUM ('UN', 'KG', 'LT', 'CX', 'PCT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_mov_estoque_enum AS ENUM ('ENTRADA_COMPRA', 'SAIDA_VENDA', 'PERDA_AVARIA', 'VENCIMENTO', 'AJUSTE_INVENTARIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_credito_enum AS ENUM ('EM_DIA', 'PROXIMO_VENCIMENTO', 'ATRASADO', 'BLOQUEADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_mov_fiado_enum AS ENUM ('COMPRA_FIADO', 'PAGAMENTO_ABATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_caixa_enum AS ENUM ('ABERTO', 'FECHADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_venda_enum AS ENUM ('CONCLUIDA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE categoria_despesa_enum AS ENUM ('MERCADORIA', 'UTILIDADES', 'ALUGUEL', 'IMPOSTOS', 'MANUTENCAO', 'OUTROS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_conta_pagar_enum AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 2. MÓDULO DE ACESSO, AUDITORIA E CONFIGURAÇÕES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email_login VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    pin_rapido VARCHAR(4),
    perfil perfil_usuario_enum NOT NULL DEFAULT 'OPERADOR',
    permissoes_json JSONB NOT NULL DEFAULT '{
        "operar_pdv": true,
        "abrir_fechar_caixa": true,
        "cancelar_venda_desconto": false,
        "editar_produtos": false,
        "registrar_perdas": false,
        "gerenciar_fiado": false,
        "acessar_financeiro_abc": false,
        "gerenciar_usuarios_config": false
    }'::jsonb,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acesso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configuracoes (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nome_fantasia VARCHAR(150) NOT NULL DEFAULT 'Mercadinho do Geleia',
    razao_social VARCHAR(200),
    cnpj VARCHAR(18),
    telefone_whatsapp VARCHAR(20),
    endereco_cupom VARCHAR(255),
    logo_url TEXT,
    largura_bobina largura_bobina_enum NOT NULL DEFAULT '80mm',
    nome_impressora VARCHAR(150) DEFAULT 'EPSON TM-T20X — Balcão 01',
    impressao_automatica impressao_auto_enum NOT NULL DEFAULT 'SEMPRE',
    mensagem_rodape_cupom TEXT DEFAULT 'Obrigado pela preferência! Volte sempre ao Mercadinho do Geleia.',
    exigir_abertura_caixa BOOLEAN NOT NULL DEFAULT TRUE,
    exigir_pin_desconto_cancelamento BOOLEAN NOT NULL DEFAULT TRUE,
    aviso_sonoro_bip BOOLEAN NOT NULL DEFAULT TRUE,
    agrupar_itens_cupom BOOLEAN NOT NULL DEFAULT TRUE,
    desconto_max_sem_pin NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    forma_pagamento_padrao forma_pagamento_enum NOT NULL DEFAULT 'DINHEIRO',
    dias_alerta_validade INTEGER NOT NULL DEFAULT 15,
    estoque_minimo_padrao INTEGER NOT NULL DEFAULT 5,
    margem_lucro_padrao NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    bloquear_venda_sem_estoque BOOLEAN NOT NULL DEFAULT TRUE,
    alertar_vencido_pdv BOOLEAN NOT NULL DEFAULT TRUE,
    recalcular_custo_medio BOOLEAN NOT NULL DEFAULT TRUE,
    limite_fiado_padrao NUMERIC(10,2) NOT NULL DEFAULT 200.00,
    dias_tolerancia_fiado INTEGER NOT NULL DEFAULT 5,
    bloquear_fiado_acima_limite BOOLEAN NOT NULL DEFAULT TRUE,
    exigir_pin_fiado_acima_limite BOOLEAN NOT NULL DEFAULT TRUE,
    habilitar_cobranca_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
    frequencia_backup frequencia_backup_enum NOT NULL DEFAULT 'DIARIO',
    retencao_backup_dias INTEGER NOT NULL DEFAULT 30,
    tempo_inatividade_min INTEGER NOT NULL DEFAULT 30,
    email_emergencia VARCHAR(150),
    registrar_log_auditoria BOOLEAN NOT NULL DEFAULT TRUE,
    exigir_senha_forte BOOLEAN NOT NULL DEFAULT TRUE,
    bloquear_apos_tentativas BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backups_historico (
    id SERIAL PRIMARY KEY,
    nome_arquivo VARCHAR(200) NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    tipo tipo_backup_enum NOT NULL DEFAULT 'AUTOMATICO',
    caminho_storage TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dados_empresa (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nome_fantasia VARCHAR(150) NOT NULL DEFAULT 'Mercadinho do Geleia',
    razao_social VARCHAR(200) DEFAULT '',
    cnpj VARCHAR(20) DEFAULT '',
    inscricao_estadual VARCHAR(30) DEFAULT '',
    nome_proprietario VARCHAR(180) NOT NULL DEFAULT '',
    cpf_proprietario VARCHAR(20) DEFAULT '',
    telefone VARCHAR(25) DEFAULT '',
    whatsapp VARCHAR(25) DEFAULT '',
    email VARCHAR(150) DEFAULT '',
    cep VARCHAR(15) DEFAULT '',
    endereco VARCHAR(255) DEFAULT '',
    numero VARCHAR(20) DEFAULT '',
    bairro VARCHAR(120) DEFAULT '',
    cidade VARCHAR(120) DEFAULT '',
    uf VARCHAR(2) DEFAULT '',
    mensagem_cupom TEXT DEFAULT 'Obrigado pela preferência! Volte sempre.',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    tabela_afetada VARCHAR(50) NOT NULL,
    registro_id INTEGER,
    detalhes_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 3. MÓDULO DE PESSOAS E PARCEIROS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    telefone_whatsapp VARCHAR(20) NOT NULL,
    endereco VARCHAR(255),
    limite_credito NUMERIC(10,2) NOT NULL DEFAULT 200.00,
    saldo_devedor NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    dia_vencimento_preferencial INTEGER CHECK (dia_vencimento_preferencial BETWEEN 1 AND 31),
    status_credito status_credito_enum NOT NULL DEFAULT 'EM_DIA',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fornecedores (
    id SERIAL PRIMARY KEY,
    razao_social VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(150) NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    telefone_whatsapp VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    nome_vendedor VARCHAR(100),
    categoria_fornecimento VARCHAR(100),
    prazo_entrega_dias INTEGER DEFAULT 2,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 4. MÓDULO DE CATÁLOGO E ESTOQUE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    cor_hex VARCHAR(7) NOT NULL DEFAULT '#268FBE',
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    fornecedor_padrao_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
    codigo_barras VARCHAR(50) UNIQUE,
    codigo_interno VARCHAR(20) UNIQUE,
    nome VARCHAR(180) NOT NULL,
    foto_url TEXT,
    unidade_medida unidade_medida_enum NOT NULL DEFAULT 'UN',
    preco_custo NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    preco_venda NUMERIC(10,2) NOT NULL,
    estoque_atual NUMERIC(10,3) NOT NULL DEFAULT 0.000,
    estoque_minimo NUMERIC(10,3) NOT NULL DEFAULT 5.000,
    data_validade DATE,
    lote VARCHAR(50),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    somente_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
    tipo tipo_mov_estoque_enum NOT NULL,
    quantidade NUMERIC(10,3) NOT NULL,
    custo_unitario NUMERIC(10,2),
    numero_nota_fiscal VARCHAR(50),
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 5. MÓDULO DE FRENTE DE CAIXA (PDV) E VENDAS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS caixas (
    id SERIAL PRIMARY KEY,
    numero_pdv INTEGER NOT NULL DEFAULT 1,
    operador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    data_fechamento TIMESTAMP WITH TIME ZONE,
    valor_inicial NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_sistema_dinheiro NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_sistema_digital NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_informado_fechamento NUMERIC(10,2),
    diferenca_quebra NUMERIC(10,2),
    status status_caixa_enum NOT NULL DEFAULT 'ABERTO',
    observacao_abertura TEXT,
    observacao_fechamento TEXT
);

CREATE TABLE IF NOT EXISTS vendas (
    id SERIAL PRIMARY KEY,
    numero_cupom VARCHAR(20) UNIQUE NOT NULL,
    caixa_id INTEGER NOT NULL REFERENCES caixas(id) ON DELETE RESTRICT,
    operador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    forma_pagamento forma_pagamento_enum NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    desconto NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status status_venda_enum NOT NULL DEFAULT 'CONCLUIDA',
    autorizado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_autorizacao VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venda_itens (
    id SERIAL PRIMARY KEY,
    venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade NUMERIC(10,3) NOT NULL,
    preco_unitario NUMERIC(10,2) NOT NULL,
    custo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(10,2) NOT NULL
);

-- ==============================================================================
-- 6. MÓDULO FINANCEIRO (FIADO E CONTAS A PAGAR)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS movimentacoes_fiado (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo tipo_mov_fiado_enum NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contas_a_pagar (
    id SERIAL PRIMARY KEY,
    fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
    descricao VARCHAR(200) NOT NULL,
    categoria categoria_despesa_enum NOT NULL DEFAULT 'MERCADORIA',
    valor NUMERIC(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status status_conta_pagar_enum NOT NULL DEFAULT 'PENDENTE',
    codigo_barras_boleto VARCHAR(100),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificacoes (
    id SERIAL PRIMARY KEY,
    chave_unica VARCHAR(140) UNIQUE NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    severidade VARCHAR(20) NOT NULL DEFAULT 'ALERTA',
    titulo VARCHAR(180) NOT NULL,
    mensagem TEXT NOT NULL,
    link VARCHAR(120) NOT NULL DEFAULT '/',
    somente_admin BOOLEAN NOT NULL DEFAULT FALSE,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    excluida BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
