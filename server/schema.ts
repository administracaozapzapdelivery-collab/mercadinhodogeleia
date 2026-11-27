import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from './db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initDatabase() {
  const candidates = [
    path.join(__dirname, 'sql', 'schema.sql'),
    path.join(process.cwd(), 'server', 'sql', 'schema.sql'),
  ];
  const sqlPath = candidates.find((p) => fs.existsSync(p));
  if (!sqlPath) {
    throw new Error(`schema.sql não encontrado em: ${candidates.join(', ')}`);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);

  // Garante coluna custo_unitario em venda_itens caso a tabela tenha sido criada antes
  await pool.query(
    'ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0.00'
  );
  await pool.query(
    'ALTER TABLE produtos ADD COLUMN IF NOT EXISTS somente_admin BOOLEAN NOT NULL DEFAULT FALSE'
  );
  await pool.query(
    'ALTER TABLE vendas ADD COLUMN IF NOT EXISTS autorizado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL'
  );
  await pool.query(
    'ALTER TABLE vendas ADD COLUMN IF NOT EXISTS motivo_autorizacao VARCHAR(150)'
  );
  await pool.query(
    'ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS meta_diaria_faturamento NUMERIC(10,2) NOT NULL DEFAULT 5800.00'
  );
  await pool.query(
    `UPDATE configuracoes
     SET nome_impressora = 'VOX(U) 1'
     WHERE id = 1 AND (nome_impressora IS NULL OR nome_impressora = '' OR nome_impressora = 'EPSON TM-T20X — Balcão 01')`
  );
  await pool.query(
    'ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS mp_pix_ativo BOOLEAN NOT NULL DEFAULT TRUE'
  );
  await pool.query(
    'ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS mp_public_key TEXT'
  );
  await pool.query(
    'ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS mp_access_token TEXT'
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mp_pix_pagamentos (
      payment_id VARCHAR(64) PRIMARY KEY,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      status_detail VARCHAR(64),
      transaction_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
      date_approved TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comandas (
      id SERIAL PRIMARY KEY,
      identificador VARCHAR(80) NOT NULL,
      observacao VARCHAR(200),
      status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
      cadastrada BOOLEAN NOT NULL DEFAULT FALSE,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(
    'ALTER TABLE comandas ADD COLUMN IF NOT EXISTS cadastrada BOOLEAN NOT NULL DEFAULT FALSE'
  );
  await pool.query(
    'ALTER TABLE comandas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE'
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comanda_itens (
      id SERIAL PRIMARY KEY,
      comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      quantidade NUMERIC(10,3) NOT NULL DEFAULT 1,
      preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0.00
    )
  `);
  await pool.query(`
    INSERT INTO clientes (nome, telefone_whatsapp, limite_credito, saldo_devedor, status_credito)
    SELECT 'Venda no Balcão', '', 0.00, 0.00, 'EM_DIA'
    WHERE NOT EXISTS (
      SELECT 1 FROM clientes WHERE LOWER(nome) = 'venda no balcão'
    )
  `);
  await pool.query(
    'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_login INTEGER NOT NULL DEFAULT 0'
  );
  await pool.query(
    'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMP WITH TIME ZONE'
  );

  // Garante registro padrão em dados_empresa
  await pool.query(`
    INSERT INTO dados_empresa (id, nome_fantasia, razao_social, cnpj, nome_proprietario, telefone, whatsapp, mensagem_cupom)
    VALUES (1, 'Mercadinho do Geleia', 'Mercadinho do Geleia Ltda', '48.123.456/0001-99', 'Geleia', '(11) 99444-1234', '(11) 99444-1234', 'Obrigado pela preferência! Volte sempre.')
    ON CONFLICT (id) DO NOTHING;
  `);

  const defaultHash = bcrypt.hashSync('123456', 10);

  // Atualiza hashes de demo antigos para bcrypt válido (senha padrão: 123456)
  await pool.query(
    "UPDATE usuarios SET senha_hash = $1 WHERE senha_hash LIKE 'hash_demo%'",
    [defaultHash]
  );

  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM categorias');
  if (Number(rows[0]?.count ?? 0) === 0) {
    await pool.query(`
      INSERT INTO configuracoes (id, nome_fantasia, razao_social, cnpj, telefone_whatsapp)
      VALUES (1, 'Mercadinho do Geleia', 'Mercadinho do Geleia Ltda', '48.123.456/0001-99', '(11) 99444-1234')
      ON CONFLICT (id) DO NOTHING;
    `);

    await pool.query(
      `INSERT INTO usuarios (nome, email_login, senha_hash, pin_rapido, perfil, ativo, ultimo_acesso) VALUES
      ('Geleia (Proprietário)', 'geleia@mercadinhodogeleia.com.br', $1, '1234', 'ADMIN', TRUE, NOW()),
      ('Maria Clara', 'maria.caixa@mercadinhodogeleia.com.br', $1, '4321', 'OPERADOR', TRUE, NOW()),
      ('João Pedro', 'joao.estoque@mercadinhodogeleia.com.br', $1, '1111', 'OPERADOR', TRUE, NOW()),
      ('Carla Souza', 'carla.gerente@mercadinhodogeleia.com.br', $1, '2222', 'GERENTE', FALSE, NOW() - INTERVAL '6 days')`,
      [defaultHash]
    );

    await pool.query(`
      INSERT INTO categorias (nome, cor_hex, descricao, ativo) VALUES
      ('Mercearia', '#551BB3', 'Grãos, óleos, farinhas e enlatados', TRUE),
      ('Bebidas', '#268FBE', 'Refrigerantes, sucos, águas e cervejas', TRUE),
      ('Laticínios', '#2CB8B2', 'Leites, queijos, manteigas e iogurtes', TRUE),
      ('Padaria', '#3DDB8F', 'Pães frescos, bolos e salgados', TRUE),
      ('Hortifrúti', '#A9F04D', 'Frutas, verduras e legumes frescos', TRUE),
      ('Limpeza', '#268FBE', 'Detergentes, sabões e desinfetantes', TRUE);
    `);

    await pool.query(`
      INSERT INTO fornecedores (razao_social, nome_fantasia, cnpj, telefone_whatsapp, email, nome_vendedor, categoria_fornecimento, prazo_entrega_dias) VALUES
      ('Distribuidora Paulista Alimentos Ltda', 'Distribuidora Paulista Alimentos', '12.345.678/0001-90', '(11) 3344-5500', 'pedidos@paulistaalimentos.com.br', 'Roberto Mendes', 'Mercearia', 2),
      ('Bebidas Express Comércio Ltda', 'Bebidas Express Ltda', '23.456.789/0001-01', '(11) 3889-1200', 'vendas@bebidasexpress.com.br', 'Fernanda Lima', 'Bebidas', 1),
      ('Laticínios Vale Verde S/A', 'Laticínios Vale Verde', '34.567.890/0001-12', '(11) 4002-8922', 'comercial@valeverde.com.br', 'Paulo Sérgio', 'Laticínios', 2),
      ('CEASA Hortifrúti Direto Ltda', 'CEASA Hortifrúti Direto', '45.678.901/0001-23', '(11) 99811-2233', 'ceasa@hortifrutidireto.com.br', 'Marcos Rocha', 'Hortifrúti', 1);
    `);

    await pool.query(`
      INSERT INTO produtos (categoria_id, fornecedor_padrao_id, codigo_barras, codigo_interno, nome, unidade_medida, preco_custo, preco_venda, estoque_atual, estoque_minimo, data_validade) VALUES
      (2, 2, '7894900011517', 'BEB-001', 'Refrigerante Coca-Cola 2L', 'UN', 6.80, 10.50, 48, 15, '2027-03-15'),
      (1, 1, '7896006716114', 'MER-014', 'Arroz Tipo 1 Camil 5kg', 'UN', 21.50, 29.90, 6, 12, '2027-08-20'),
      (3, 3, '7891000315507', 'LAT-008', 'Leite Integral Italac 1L', 'UN', 3.90, 5.49, 5, 24, '2026-11-28'),
      (4, NULL, '7898215150015', 'PAD-003', 'Pão Francês Tradicional', 'KG', 8.20, 16.90, 18, 10, '2026-11-25'),
      (6, 1, '7891024132104', 'LIM-022', 'Detergente Ypê Neutro 500ml', 'UN', 1.75, 2.89, 42, 20, '2028-01-10'),
      (1, 1, '7896036090244', 'MER-031', 'Óleo de Soja Liza 900ml', 'UN', 5.40, 7.79, 4, 15, '2027-05-01'),
      (3, 3, '7891000100103', 'LAT-019', 'Iogurte Natural Nestlé 170g', 'UN', 2.20, 3.99, 14, 10, '2026-11-27'),
      (5, 4, '2000000000051', 'HOR-005', 'Banana Prata Selecionada', 'KG', 4.10, 7.49, 22, 10, '2026-11-29');
    `);

    await pool.query(`
      INSERT INTO clientes (nome, cpf, telefone_whatsapp, limite_credito, saldo_devedor, dia_vencimento_preferencial, status_credito) VALUES
      ('Dona Lúcia Ferreira', '123.456.789-00', '(11) 98412-3301', 500.00, 184.50, 10, 'EM_DIA'),
      ('Seu Joaquim Almeida', '234.567.890-11', '(11) 97234-8820', 350.00, 320.00, 15, 'PROXIMO_VENCIMENTO'),
      ('Mariana Costa', '345.678.901-22', '(11) 99102-4419', 600.00, 95.00, 5, 'EM_DIA'),
      ('Carlos Eduardo Silva', '456.789.012-33', '(11) 96551-1029', 300.00, 315.80, 10, 'BLOQUEADO');
    `);

    await pool.query(`
      INSERT INTO caixas (numero_pdv, operador_id, data_abertura, data_fechamento, valor_inicial, valor_sistema_dinheiro, valor_sistema_digital, status) VALUES
      (1, 2, NOW() - INTERVAL '8 hours', NULL, 250.00, 1420.00, 3405.90, 'ABERTO'),
      (1, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '16 hours', 250.00, 1890.00, 3500.40, 'FECHADO'),
      (2, 3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '18 hours', 150.00, 740.00, 1200.00, 'FECHADO');
    `);

    await pool.query(`
      INSERT INTO vendas (numero_cupom, caixa_id, operador_id, cliente_id, forma_pagamento, subtotal, desconto, total, status) VALUES
      ('#004821', 1, 2, NULL, 'PIX', 68.40, 0, 68.40, 'CONCLUIDA'),
      ('#004820', 1, 2, 1, 'FIADO', 42.90, 0, 42.90, 'CONCLUIDA'),
      ('#004819', 1, 1, NULL, 'CREDITO', 134.20, 0, 134.20, 'CONCLUIDA'),
      ('#004818', 1, 2, NULL, 'DINHEIRO', 18.00, 0, 18.00, 'CONCLUIDA'),
      ('#004817', 1, 1, NULL, 'DEBITO', 29.70, 0, 29.70, 'CANCELADA');
    `);

    await pool.query(`
      INSERT INTO movimentacoes_estoque (produto_id, usuario_id, fornecedor_id, tipo, quantidade, custo_unitario, numero_nota_fiscal, observacao) VALUES
      (1, 1, 2, 'ENTRADA_COMPRA', 24, 6.80, 'NF-e #99412', 'Reposição Bebidas Express'),
      (7, 3, NULL, 'PERDA_AVARIA', -2, 2.20, NULL, 'Embalagem violada na prateleira'),
      (8, 3, NULL, 'VENCIMENTO', -3, 4.10, NULL, 'Frutas maduras além do ponto de venda'),
      (2, 2, NULL, 'SAIDA_VENDA', -10, 21.50, NULL, 'Vendas consolidadas PDV');
    `);

    await pool.query(`
      INSERT INTO contas_a_pagar (fornecedor_id, descricao, categoria, valor, data_vencimento, status) VALUES
      (2, 'NF-e #99412 — Reposição Bebidas', 'MERCADORIA', 1480.00, '2026-11-26', 'PENDENTE'),
      (NULL, 'Energia Elétrica (Câmara Fria)', 'UTILIDADES', 890.50, '2026-11-25', 'PENDENTE'),
      (3, 'NF-e #88120 — Laticínios', 'MERCADORIA', 640.00, '2026-11-20', 'ATRASADO'),
      (NULL, 'Aluguel do Ponto Comercial', 'ALUGUEL', 3200.00, '2026-11-15', 'PAGO');
    `);
  }

  // Popula venda_itens iniciais apenas se as vendas demo (id 1..5) existirem e venda_itens estiver vazio
  const itemsCount = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM venda_itens`
  );
  const demoVendas = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM vendas WHERE id IN (1, 2, 3, 4, 5)`
  );
  if (Number(itemsCount.rows[0]?.count ?? 0) === 0 && Number(demoVendas.rows[0]?.count ?? 0) === 5) {
    await pool.query(`
      INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, custo_unitario, subtotal) VALUES
      (1, 1, 4, 10.50, 6.80, 42.00),
      (1, 4, 1.562, 16.90, 8.20, 26.40),
      (2, 2, 1, 29.90, 21.50, 29.90),
      (2, 3, 2, 5.49, 3.90, 10.98),
      (3, 2, 3, 29.90, 21.50, 89.70),
      (3, 1, 4, 10.50, 6.80, 42.00),
      (4, 4, 1.065, 16.90, 8.20, 18.00),
      (5, 6, 3, 7.79, 5.40, 23.37);
    `);
  }
}
