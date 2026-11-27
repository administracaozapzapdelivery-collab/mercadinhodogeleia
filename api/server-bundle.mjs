// server/index.ts
import express from "express";
import cors from "cors";

// server/db.ts
import "dotenv/config";
import { Pool } from "pg";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL n\xE3o configurada no arquivo .env");
}
var useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_URL.includes("sslmode=require") || process.env.DATABASE_URL.includes("ssl=true");
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

// server/schema.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
async function initDatabase() {
  const candidates = [
    path.join(__dirname, "sql", "schema.sql"),
    path.join(process.cwd(), "server", "sql", "schema.sql")
  ];
  const sqlPath = candidates.find((p) => fs.existsSync(p));
  if (!sqlPath) {
    throw new Error(`schema.sql n\xE3o encontrado em: ${candidates.join(", ")}`);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
  await pool.query(
    "ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0.00"
  );
  await pool.query(
    "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS somente_admin BOOLEAN NOT NULL DEFAULT FALSE"
  );
  await pool.query(
    "ALTER TABLE vendas ADD COLUMN IF NOT EXISTS autorizado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL"
  );
  await pool.query(
    "ALTER TABLE vendas ADD COLUMN IF NOT EXISTS motivo_autorizacao VARCHAR(150)"
  );
  await pool.query(
    "ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS meta_diaria_faturamento NUMERIC(10,2) NOT NULL DEFAULT 5800.00"
  );
  await pool.query(
    `UPDATE configuracoes
     SET nome_impressora = 'VOX(U) 1'
     WHERE id = 1 AND (nome_impressora IS NULL OR nome_impressora = '' OR nome_impressora = 'EPSON TM-T20X \u2014 Balc\xE3o 01')`
  );
  await pool.query(
    "ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS mp_pix_ativo BOOLEAN NOT NULL DEFAULT TRUE"
  );
  await pool.query(
    "ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS mp_public_key TEXT"
  );
  await pool.query(
    "ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS mp_access_token TEXT"
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
    "ALTER TABLE comandas ADD COLUMN IF NOT EXISTS cadastrada BOOLEAN NOT NULL DEFAULT FALSE"
  );
  await pool.query(
    "ALTER TABLE comandas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE"
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
    SELECT 'Venda no Balc\xE3o', '', 0.00, 0.00, 'EM_DIA'
    WHERE NOT EXISTS (
      SELECT 1 FROM clientes WHERE LOWER(nome) = 'venda no balc\xE3o'
    )
  `);
  await pool.query(
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_login INTEGER NOT NULL DEFAULT 0"
  );
  await pool.query(
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMP WITH TIME ZONE"
  );
  await pool.query(`
    INSERT INTO dados_empresa (id, nome_fantasia, razao_social, cnpj, nome_proprietario, telefone, whatsapp, mensagem_cupom)
    VALUES (1, 'Mercadinho do Geleia', 'Mercadinho do Geleia Ltda', '48.123.456/0001-99', 'Geleia', '(11) 99444-1234', '(11) 99444-1234', 'Obrigado pela prefer\xEAncia! Volte sempre.')
    ON CONFLICT (id) DO NOTHING;
  `);
  const defaultHash = bcrypt.hashSync("123456", 10);
  await pool.query(
    "UPDATE usuarios SET senha_hash = $1 WHERE senha_hash LIKE 'hash_demo%'",
    [defaultHash]
  );
  const { rows } = await pool.query("SELECT COUNT(*) AS count FROM categorias");
  if (Number(rows[0]?.count ?? 0) === 0) {
    await pool.query(`
      INSERT INTO configuracoes (id, nome_fantasia, razao_social, cnpj, telefone_whatsapp)
      VALUES (1, 'Mercadinho do Geleia', 'Mercadinho do Geleia Ltda', '48.123.456/0001-99', '(11) 99444-1234')
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(
      `INSERT INTO usuarios (nome, email_login, senha_hash, pin_rapido, perfil, ativo, ultimo_acesso) VALUES
      ('Geleia (Propriet\xE1rio)', 'geleia@mercadinhodogeleia.com.br', $1, '1234', 'ADMIN', TRUE, NOW()),
      ('Maria Clara', 'maria.caixa@mercadinhodogeleia.com.br', $1, '4321', 'OPERADOR', TRUE, NOW()),
      ('Jo\xE3o Pedro', 'joao.estoque@mercadinhodogeleia.com.br', $1, '1111', 'OPERADOR', TRUE, NOW()),
      ('Carla Souza', 'carla.gerente@mercadinhodogeleia.com.br', $1, '2222', 'GERENTE', FALSE, NOW() - INTERVAL '6 days')`,
      [defaultHash]
    );
    await pool.query(`
      INSERT INTO categorias (nome, cor_hex, descricao, ativo) VALUES
      ('Mercearia', '#551BB3', 'Gr\xE3os, \xF3leos, farinhas e enlatados', TRUE),
      ('Bebidas', '#268FBE', 'Refrigerantes, sucos, \xE1guas e cervejas', TRUE),
      ('Latic\xEDnios', '#2CB8B2', 'Leites, queijos, manteigas e iogurtes', TRUE),
      ('Padaria', '#3DDB8F', 'P\xE3es frescos, bolos e salgados', TRUE),
      ('Hortifr\xFAti', '#A9F04D', 'Frutas, verduras e legumes frescos', TRUE),
      ('Limpeza', '#268FBE', 'Detergentes, sab\xF5es e desinfetantes', TRUE);
    `);
    await pool.query(`
      INSERT INTO fornecedores (razao_social, nome_fantasia, cnpj, telefone_whatsapp, email, nome_vendedor, categoria_fornecimento, prazo_entrega_dias) VALUES
      ('Distribuidora Paulista Alimentos Ltda', 'Distribuidora Paulista Alimentos', '12.345.678/0001-90', '(11) 3344-5500', 'pedidos@paulistaalimentos.com.br', 'Roberto Mendes', 'Mercearia', 2),
      ('Bebidas Express Com\xE9rcio Ltda', 'Bebidas Express Ltda', '23.456.789/0001-01', '(11) 3889-1200', 'vendas@bebidasexpress.com.br', 'Fernanda Lima', 'Bebidas', 1),
      ('Latic\xEDnios Vale Verde S/A', 'Latic\xEDnios Vale Verde', '34.567.890/0001-12', '(11) 4002-8922', 'comercial@valeverde.com.br', 'Paulo S\xE9rgio', 'Latic\xEDnios', 2),
      ('CEASA Hortifr\xFAti Direto Ltda', 'CEASA Hortifr\xFAti Direto', '45.678.901/0001-23', '(11) 99811-2233', 'ceasa@hortifrutidireto.com.br', 'Marcos Rocha', 'Hortifr\xFAti', 1);
    `);
    await pool.query(`
      INSERT INTO produtos (categoria_id, fornecedor_padrao_id, codigo_barras, codigo_interno, nome, unidade_medida, preco_custo, preco_venda, estoque_atual, estoque_minimo, data_validade) VALUES
      (2, 2, '7894900011517', 'BEB-001', 'Refrigerante Coca-Cola 2L', 'UN', 6.80, 10.50, 48, 15, '2027-03-15'),
      (1, 1, '7896006716114', 'MER-014', 'Arroz Tipo 1 Camil 5kg', 'UN', 21.50, 29.90, 6, 12, '2027-08-20'),
      (3, 3, '7891000315507', 'LAT-008', 'Leite Integral Italac 1L', 'UN', 3.90, 5.49, 5, 24, '2026-11-28'),
      (4, NULL, '7898215150015', 'PAD-003', 'P\xE3o Franc\xEAs Tradicional', 'KG', 8.20, 16.90, 18, 10, '2026-11-25'),
      (6, 1, '7891024132104', 'LIM-022', 'Detergente Yp\xEA Neutro 500ml', 'UN', 1.75, 2.89, 42, 20, '2028-01-10'),
      (1, 1, '7896036090244', 'MER-031', '\xD3leo de Soja Liza 900ml', 'UN', 5.40, 7.79, 4, 15, '2027-05-01'),
      (3, 3, '7891000100103', 'LAT-019', 'Iogurte Natural Nestl\xE9 170g', 'UN', 2.20, 3.99, 14, 10, '2026-11-27'),
      (5, 4, '2000000000051', 'HOR-005', 'Banana Prata Selecionada', 'KG', 4.10, 7.49, 22, 10, '2026-11-29');
    `);
    await pool.query(`
      INSERT INTO clientes (nome, cpf, telefone_whatsapp, limite_credito, saldo_devedor, dia_vencimento_preferencial, status_credito) VALUES
      ('Dona L\xFAcia Ferreira', '123.456.789-00', '(11) 98412-3301', 500.00, 184.50, 10, 'EM_DIA'),
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
      (1, 1, 2, 'ENTRADA_COMPRA', 24, 6.80, 'NF-e #99412', 'Reposi\xE7\xE3o Bebidas Express'),
      (7, 3, NULL, 'PERDA_AVARIA', -2, 2.20, NULL, 'Embalagem violada na prateleira'),
      (8, 3, NULL, 'VENCIMENTO', -3, 4.10, NULL, 'Frutas maduras al\xE9m do ponto de venda'),
      (2, 2, NULL, 'SAIDA_VENDA', -10, 21.50, NULL, 'Vendas consolidadas PDV');
    `);
    await pool.query(`
      INSERT INTO contas_a_pagar (fornecedor_id, descricao, categoria, valor, data_vencimento, status) VALUES
      (2, 'NF-e #99412 \u2014 Reposi\xE7\xE3o Bebidas', 'MERCADORIA', 1480.00, '2026-11-26', 'PENDENTE'),
      (NULL, 'Energia El\xE9trica (C\xE2mara Fria)', 'UTILIDADES', 890.50, '2026-11-25', 'PENDENTE'),
      (3, 'NF-e #88120 \u2014 Latic\xEDnios', 'MERCADORIA', 640.00, '2026-11-20', 'ATRASADO'),
      (NULL, 'Aluguel do Ponto Comercial', 'ALUGUEL', 3200.00, '2026-11-15', 'PAGO');
    `);
  }
  const itemsCount = await pool.query(
    `SELECT COUNT(*) AS count FROM venda_itens`
  );
  const demoVendas = await pool.query(
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

// server/routes/authAndUsers.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";

// server/utils/audit.ts
async function logAudit(usuarioId, acao, tabelaAfetada, registroId, detalhes = {}) {
  try {
    const cfg = await pool.query(
      "SELECT registrar_log_auditoria FROM configuracoes WHERE id = 1"
    );
    if (cfg.rows[0] && !cfg.rows[0].registrar_log_auditoria) return;
    await pool.query(
      `INSERT INTO auditoria_logs (usuario_id, acao, tabela_afetada, registro_id, detalhes_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [usuarioId, acao, tabelaAfetada, registroId, JSON.stringify(detalhes)]
    );
  } catch (err) {
    console.error("Falha ao gravar auditoria:", err.message);
  }
}

// server/utils/security.ts
import crypto from "node:crypto";
function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  const seed = process.env.DATABASE_URL || "mercadinho-geleia-dev-fallback";
  return crypto.createHash("sha256").update(`geleia-jwt::${seed}`).digest("hex");
}
function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - input.length % 4);
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(base64, "base64").toString("utf8");
}
function signAuthToken(payload, expiresInSec = 12 * 60 * 60) {
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSec
  };
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac("sha256", getJwtSecret()).update(data).digest();
  return `${data}.${base64UrlEncode(sig)}`;
}
function verifyAuthToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac("sha256", getJwtSecret()).update(data).digest()
    );
    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (!payload.sub || !payload.role || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-XSS-Protection", "0");
  next();
}
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Autentica\xE7\xE3o necess\xE1ria. Fa\xE7a login novamente." });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: "Sess\xE3o inv\xE1lida ou expirada. Fa\xE7a login novamente." });
    return;
  }
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ error: "Sess\xE3o inv\xE1lida." });
    return;
  }
  try {
    const { rows } = await pool.query(
      "SELECT id, perfil, nome, email_login, ativo FROM usuarios WHERE id = $1 LIMIT 1",
      [userId]
    );
    const dbUser = rows[0];
    if (!dbUser || !dbUser.ativo) {
      res.status(401).json({ error: "Usu\xE1rio inativo ou removido." });
      return;
    }
    req.user = {
      id: dbUser.id,
      name: dbUser.nome,
      email: dbUser.email_login,
      role: dbUser.perfil
    };
    next();
  } catch {
    res.status(500).json({ error: "Erro ao validar sess\xE3o." });
  }
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Autentica\xE7\xE3o necess\xE1ria." });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Acesso negado. Permiss\xE3o insuficiente para esta opera\xE7\xE3o." });
      return;
    }
    next();
  };
}
function parsePositiveId(raw) {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}
function safeErrorMessage(err, fallback = "Erro interno no servidor.") {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
function createRateLimiter(options) {
  const hits = /* @__PURE__ */ new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 1e3) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.keyPrefix ?? "rl"}:${ip}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1e3);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: options.message });
      return;
    }
    next();
  };
}
function createFailedAttemptTracker(maxAttempts = 3, windowMs = 15 * 60 * 1e3) {
  const attempts = /* @__PURE__ */ new Map();
  function getClientKey(req) {
    return req.ip || req.socket.remoteAddress || "unknown";
  }
  function cleanupExpired(now) {
    if (attempts.size > 1e3) {
      for (const [k, v] of attempts) {
        if (v.resetAt <= now) attempts.delete(k);
      }
    }
  }
  return {
    checkBlocked(req) {
      const now = Date.now();
      const key = getClientKey(req);
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) {
        if (entry) attempts.delete(key);
        return { blocked: false, remainingAttempts: maxAttempts, retryAfterSec: 0 };
      }
      const remainingAttempts = Math.max(0, maxAttempts - entry.count);
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1e3);
      return {
        blocked: entry.count >= maxAttempts,
        remainingAttempts,
        retryAfterSec
      };
    },
    recordFailure(req) {
      const now = Date.now();
      cleanupExpired(now);
      const key = getClientKey(req);
      const existing = attempts.get(key);
      const nextEntry = !existing || existing.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { count: existing.count + 1, resetAt: existing.resetAt };
      attempts.set(key, nextEntry);
      const remainingAttempts = Math.max(0, maxAttempts - nextEntry.count);
      const retryAfterSec = Math.ceil((nextEntry.resetAt - now) / 1e3);
      return {
        blocked: nextEntry.count >= maxAttempts,
        remainingAttempts,
        retryAfterSec
      };
    },
    reset(req) {
      attempts.delete(getClientKey(req));
    }
  };
}

// server/routes/authAndUsers.ts
var authAndUsersRouter = Router();
var MAX_LOGIN_ATTEMPTS = 3;
var unknownEmailTracker = createFailedAttemptTracker(MAX_LOGIN_ATTEMPTS, 15 * 60 * 1e3);
var pinUnlockLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  max: 5,
  message: "Muitas tentativas de PIN para desbloqueio. Aguarde alguns minutos.",
  keyPrefix: "pin-unlock"
});
authAndUsersRouter.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
      return;
    }
    const result = await pool.query(
      `SELECT id, nome, email_login, senha_hash, perfil, permissoes_json, ativo,
              COALESCE(tentativas_login, 0) AS tentativas_login, bloqueado_ate
       FROM usuarios WHERE LOWER(email_login) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );
    const user = result.rows[0];
    if (!user || !user.ativo) {
      const lockState = unknownEmailTracker.checkBlocked(req);
      if (lockState.blocked) {
        res.setHeader("Retry-After", String(lockState.retryAfterSec));
        res.status(429).json({
          error: "Muitas tentativas incorretas. Aguarde alguns minutos e tente novamente.",
          remainingAttempts: 0,
          maxAttempts: MAX_LOGIN_ATTEMPTS,
          retryAfterSec: lockState.retryAfterSec
        });
        return;
      }
      const fail = unknownEmailTracker.recordFailure(req);
      res.status(fail.blocked ? 429 : 401).json({
        error: fail.blocked ? "Usu\xE1rio n\xE3o encontrado ou inativo. Limite de tentativas atingido; aguarde alguns minutos." : "Usu\xE1rio n\xE3o encontrado ou inativo.",
        remainingAttempts: fail.remainingAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS
      });
      return;
    }
    const nowMs = Date.now();
    const blockedUntilMs = user.bloqueado_ate ? new Date(user.bloqueado_ate).getTime() : 0;
    if (blockedUntilMs > nowMs) {
      const retryAfterSec = Math.ceil((blockedUntilMs - nowMs) / 1e3);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "Usu\xE1rio bloqueado por excesso de tentativas incorretas. Solicite o desbloqueio ao Administrador ou aguarde.",
        remainingAttempts: 0,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        retryAfterSec
      });
      return;
    }
    const currentAttempts = blockedUntilMs > 0 ? 0 : Number(user.tentativas_login ?? 0);
    const valid = await bcrypt2.compare(password, user.senha_hash);
    if (!valid) {
      const nextAttempts = currentAttempts + 1;
      const blocked = nextAttempts >= MAX_LOGIN_ATTEMPTS;
      const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - nextAttempts);
      if (blocked) {
        await pool.query(
          `UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = NOW() + INTERVAL '15 minutes', updated_at = NOW() WHERE id = $2`,
          [MAX_LOGIN_ATTEMPTS, user.id]
        );
      } else {
        await pool.query(
          `UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = NULL, updated_at = NOW() WHERE id = $2`,
          [nextAttempts, user.id]
        );
      }
      res.status(blocked ? 429 : 401).json({
        error: blocked ? "Senha incorreta. Usu\xE1rio bloqueado ap\xF3s 3 tentativas; solicite o desbloqueio ao Administrador." : "Senha incorreta.",
        remainingAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS
      });
      return;
    }
    unknownEmailTracker.reset(req);
    await pool.query(
      "UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_acesso = NOW() WHERE id = $1",
      [user.id]
    );
    const token = signAuthToken({
      sub: String(user.id),
      email: user.email_login,
      name: user.nome,
      role: user.perfil
    });
    res.json({
      id: String(user.id),
      nome: user.nome,
      email: user.email_login,
      perfil: user.perfil,
      permissoes: user.permissoes_json,
      token
    });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.post("/auth/unlock-with-pin", pinUnlockLimiter, async (req, res) => {
  try {
    const { email, adminPin } = req.body;
    const pinTrimmed = String(adminPin ?? "").trim();
    if (!email || !pinTrimmed) {
      res.status(400).json({ error: "E-mail e PIN do Administrador/Gerente s\xE3o obrigat\xF3rios." });
      return;
    }
    const authRes = await pool.query(
      `SELECT id, nome FROM usuarios
       WHERE pin_rapido = $1 AND ativo = TRUE AND perfil IN ('ADMIN', 'GERENTE')
       LIMIT 1`,
      [pinTrimmed]
    );
    const authorizer = authRes.rows[0];
    if (!authorizer) {
      res.status(403).json({ error: "PIN inv\xE1lido ou usu\xE1rio sem permiss\xE3o de Administrador/Gerente." });
      return;
    }
    const targetRes = await pool.query(
      "SELECT id FROM usuarios WHERE email_login = $1 LIMIT 1",
      [email.trim()]
    );
    const targetUser = targetRes.rows[0];
    if (targetUser) {
      await pool.query(
        "UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, updated_at = NOW() WHERE id = $1",
        [targetUser.id]
      );
      await logAudit(authorizer.id, "DESBLOQUEOU_LOGIN_PIN", "usuarios", targetUser.id, {
        email: email.trim(),
        unlockedBy: authorizer.nome
      });
    }
    unknownEmailTracker.reset(req);
    res.json({ ok: true, unlockedBy: authorizer.nome });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.post("/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, email, role, password, pin, permissions } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "Nome e e-mail s\xE3o obrigat\xF3rios." });
      return;
    }
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password || "123456").trim();
    const cleanPin = String(pin || "1234").trim();
    const roleDb = role === "Administrador" ? "ADMIN" : role === "Gerente" ? "GERENTE" : "OPERADOR";
    const hash = await bcrypt2.hash(cleanPassword, 10);
    const inserted = await pool.query(
      `INSERT INTO usuarios (nome, email_login, senha_hash, pin_rapido, perfil, permissoes_json, ativo, ultimo_acesso)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), TRUE, NOW())
       RETURNING id`,
      [cleanName, cleanEmail, hash, cleanPin, roleDb, permissions ? JSON.stringify(permissions) : null]
    );
    await logAudit(req.user.id, "CRIOU_USUARIO", "usuarios", inserted.rows[0].id, {
      name: cleanName,
      role: roleDb
    });
    res.status(201).json({
      id: String(inserted.rows[0].id),
      name: cleanName,
      email: cleanEmail,
      role,
      permissions: permissions ?? {}
    });
  } catch (err) {
    const pgErr = err;
    if (pgErr?.code === "23505") {
      res.status(409).json({ error: "J\xE1 existe um usu\xE1rio cadastrado com este e-mail." });
      return;
    }
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.put("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de usu\xE1rio inv\xE1lido." });
      return;
    }
    const { name, email, role, active, password, pin, permissions } = req.body;
    const roleDb = role === "Administrador" ? "ADMIN" : role === "Gerente" ? "GERENTE" : "OPERADOR";
    const newHash = password ? await bcrypt2.hash(password, 10) : null;
    await pool.query(
      `UPDATE usuarios SET
        nome = COALESCE($1, nome),
        email_login = COALESCE($2, email_login),
        perfil = COALESCE($3, perfil),
        ativo = COALESCE($4, ativo),
        pin_rapido = COALESCE($5, pin_rapido),
        senha_hash = COALESCE($6, senha_hash),
        permissoes_json = COALESCE($7::jsonb, permissoes_json),
        updated_at = NOW()
       WHERE id = $8`,
      [
        name ?? null,
        email ?? null,
        roleDb,
        active ?? null,
        pin ?? null,
        newHash,
        permissions ? JSON.stringify(permissions) : null,
        id
      ]
    );
    await logAudit(req.user.id, "EDITOU_USUARIO", "usuarios", id, { name, role: roleDb });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.post("/users/:id/unlock", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de usu\xE1rio inv\xE1lido." });
      return;
    }
    await pool.query(
      "UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, updated_at = NOW() WHERE id = $1",
      [id]
    );
    await logAudit(req.user.id, "DESBLOQUEOU_USUARIO", "usuarios", id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.delete("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de usu\xE1rio inv\xE1lido." });
      return;
    }
    if (id === req.user.id) {
      res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel excluir o pr\xF3prio usu\xE1rio logado." });
      return;
    }
    const existing = await pool.query(
      "SELECT email FROM usuarios WHERE id = $1",
      [id]
    );
    if ((existing.rows[0]?.email ?? "").trim().toLowerCase() === "everaldozs@gmail.com") {
      res.status(403).json({ error: "O usu\xE1rio administrador principal n\xE3o pode ser exclu\xEDdo." });
      return;
    }
    try {
      await pool.query("DELETE FROM usuarios WHERE id = $1", [id]);
      await logAudit(req.user.id, "EXCLUIU_USUARIO", "usuarios", id);
      res.json({ ok: true, deleted: true });
    } catch {
      res.status(409).json({
        error: "Este usu\xE1rio possui vendas ou turnos de caixa vinculados e n\xE3o pode ser exclu\xEDdo. Use a op\xE7\xE3o Desativar."
      });
    }
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.get("/settings", requireAuth, async (_req, res) => {
  try {
    const [cfg, backups] = await Promise.all([
      pool.query("SELECT * FROM configuracoes WHERE id = 1"),
      pool.query("SELECT id, nome_arquivo, tamanho_bytes, tipo, caminho_storage, created_at FROM backups_historico ORDER BY id DESC LIMIT 20")
    ]);
    const row = cfg.rows[0] ?? null;
    if (row) {
      const rawToken = typeof row.mp_access_token === "string" ? row.mp_access_token : "";
      row.has_mp_access_token = Boolean(rawToken);
      row.mp_access_token_masked = rawToken ? `${rawToken.slice(0, 12)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${rawToken.slice(-8)}` : "";
      delete row.mp_access_token;
    }
    res.json({ config: row, backups: backups.rows });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.put("/settings", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const c = req.body;
    const newAccessToken = typeof c.mp_access_token === "string" && c.mp_access_token.trim() ? c.mp_access_token.trim() : null;
    await pool.query(
      `UPDATE configuracoes SET
        nome_fantasia = COALESCE($1, nome_fantasia),
        cnpj = COALESCE($2, cnpj),
        telefone_whatsapp = COALESCE($3, telefone_whatsapp),
        largura_bobina = COALESCE($4, largura_bobina),
        impressao_automatica = COALESCE($5, impressao_automatica),
        dias_alerta_validade = COALESCE($6, dias_alerta_validade),
        limite_fiado_padrao = COALESCE($7, limite_fiado_padrao),
        exigir_abertura_caixa = COALESCE($8, exigir_abertura_caixa),
        registrar_log_auditoria = COALESCE($9, registrar_log_auditoria),
        recalcular_custo_medio = COALESCE($10, recalcular_custo_medio),
        meta_diaria_faturamento = COALESCE($11, meta_diaria_faturamento),
        nome_impressora = COALESCE($12, nome_impressora),
        mp_pix_ativo = COALESCE($13, mp_pix_ativo),
        mp_public_key = COALESCE($14, mp_public_key),
        mp_access_token = COALESCE($15, mp_access_token),
        updated_at = NOW()
       WHERE id = 1`,
      [
        c.nome_fantasia ?? null,
        c.cnpj ?? null,
        c.telefone_whatsapp ?? null,
        c.largura_bobina ?? null,
        c.impressao_automatica ?? null,
        c.dias_alerta_validade ?? null,
        c.limite_fiado_padrao ?? null,
        c.exigir_abertura_caixa ?? null,
        c.registrar_log_auditoria ?? null,
        c.recalcular_custo_medio ?? null,
        c.meta_diaria_faturamento != null ? Number(c.meta_diaria_faturamento) : null,
        c.nome_impressora ?? null,
        typeof c.mp_pix_ativo === "boolean" ? c.mp_pix_ativo : null,
        c.mp_public_key ?? null,
        newAccessToken
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
authAndUsersRouter.post("/backups", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  try {
    const fileName = `backup_geleia_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.sql`;
    const inserted = await pool.query(
      `INSERT INTO backups_historico (nome_arquivo, tamanho_bytes, tipo, caminho_storage)
       VALUES ($1, $2, 'MANUAL', $3) RETURNING *`,
      [fileName, 1482900, `/backups/${fileName}`]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.get("/company", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM dados_empresa WHERE id = 1");
    res.json(result.rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
authAndUsersRouter.put("/company", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const c = req.body;
    const updated = await pool.query(
      `INSERT INTO dados_empresa (
        id, nome_fantasia, razao_social, cnpj, inscricao_estadual,
        nome_proprietario, cpf_proprietario, telefone, whatsapp, email,
        cep, endereco, numero, bairro, cidade, uf, mensagem_cupom, updated_at
      ) VALUES (
        1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nome_fantasia = EXCLUDED.nome_fantasia,
        razao_social = EXCLUDED.razao_social,
        cnpj = EXCLUDED.cnpj,
        inscricao_estadual = EXCLUDED.inscricao_estadual,
        nome_proprietario = EXCLUDED.nome_proprietario,
        cpf_proprietario = EXCLUDED.cpf_proprietario,
        telefone = EXCLUDED.telefone,
        whatsapp = EXCLUDED.whatsapp,
        email = EXCLUDED.email,
        cep = EXCLUDED.cep,
        endereco = EXCLUDED.endereco,
        numero = EXCLUDED.numero,
        bairro = EXCLUDED.bairro,
        cidade = EXCLUDED.cidade,
        uf = EXCLUDED.uf,
        mensagem_cupom = EXCLUDED.mensagem_cupom,
        updated_at = NOW()
      RETURNING *`,
      [
        c.nome_fantasia || "Mercadinho do Geleia",
        c.razao_social ?? "",
        c.cnpj ?? "",
        c.inscricao_estadual ?? "",
        c.nome_proprietario ?? "",
        c.cpf_proprietario ?? "",
        c.telefone ?? "",
        c.whatsapp ?? "",
        c.email ?? "",
        c.cep ?? "",
        c.endereco ?? "",
        c.numero ?? "",
        c.bairro ?? "",
        c.cidade ?? "",
        c.uf ?? "",
        c.mensagem_cupom ?? "Obrigado pela prefer\xEAncia! Volte sempre."
      ]
    );
    await pool.query(
      `UPDATE configuracoes SET
        nome_fantasia = $1,
        razao_social = $2,
        cnpj = $3,
        telefone_whatsapp = $4,
        mensagem_rodape_cupom = $5,
        updated_at = NOW()
       WHERE id = 1`,
      [
        c.nome_fantasia || "Mercadinho do Geleia",
        c.razao_social ?? null,
        c.cnpj ?? null,
        c.whatsapp || c.telefone || null,
        c.mensagem_cupom ?? null
      ]
    );
    await logAudit(null, "ATUALIZOU_DADOS_EMPRESA", "dados_empresa", 1, {
      nome_fantasia: c.nome_fantasia,
      cnpj: c.cnpj,
      nome_proprietario: c.nome_proprietario
    });
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// server/routes/catalog.ts
import { Router as Router2 } from "express";
var catalogRouter = Router2();
catalogRouter.post("/categories", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const { name, description, colorHex, active } = req.body;
    const inserted = await pool.query(
      "INSERT INTO categorias (nome, cor_hex, descricao, ativo) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, colorHex || "#551BB3", description ?? "", active ?? true]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
catalogRouter.put("/categories/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const { name, description, colorHex } = req.body;
    await pool.query(
      "UPDATE categorias SET nome = COALESCE($1, nome), descricao = COALESCE($2, descricao), cor_hex = COALESCE($3, cor_hex) WHERE id = $4",
      [name ?? null, description ?? null, colorHex ?? null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
catalogRouter.delete("/categories/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    await pool.query("DELETE FROM categorias WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel excluir categoria com produtos vinculados." });
  }
});
catalogRouter.get("/products/expiring", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id::text AS id,
        p.nome AS name,
        c.nome AS category,
        TO_CHAR(p.data_validade, 'YYYY-MM-DD') AS "expiryDate",
        p.estoque_atual::float AS stock,
        LOWER(p.unidade_medida::text) AS unit
      FROM produtos p
      JOIN categorias c ON c.id = p.categoria_id
      CROSS JOIN configuracoes cfg
      WHERE cfg.id = 1
        AND p.ativo = TRUE
        AND p.data_validade IS NOT NULL
        AND p.data_validade <= CURRENT_DATE + (cfg.dias_alerta_validade || ' days')::INTERVAL
      ORDER BY p.data_validade ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function isNumericOnlyProductName(value) {
  return typeof value === "string" && /^\d+$/.test(value.trim());
}
catalogRouter.post("/products", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const { sku, barcode, name, category, unit, costPrice, salePrice, stock, minStock, expiryDate, photoUrl, adminOnly } = req.body;
    if (!String(name ?? "").trim() || isNumericOnlyProductName(name)) {
      res.status(400).json({
        error: "O nome do produto n\xE3o pode conter apenas n\xFAmeros. Informe uma descri\xE7\xE3o v\xE1lida."
      });
      return;
    }
    const catRes = await pool.query("SELECT id FROM categorias WHERE nome = $1 LIMIT 1", [category]);
    const catId = catRes.rows[0]?.id ?? 1;
    const unitDb = unit === "kg" ? "KG" : unit === "L" ? "LT" : unit === "cx" ? "CX" : "UN";
    const inserted = await pool.query(
      `INSERT INTO produtos (categoria_id, codigo_barras, codigo_interno, nome, foto_url, unidade_medida, preco_custo, preco_venda, estoque_atual, estoque_minimo, data_validade, somente_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [catId, barcode || null, sku || null, name, photoUrl || null, unitDb, costPrice ?? 0, salePrice, stock ?? 0, minStock ?? 5, expiryDate || null, !!adminOnly]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
catalogRouter.put("/products/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const { name, barcode, category, unit, salePrice, costPrice, minStock, stock, expiryDate, adminOnly } = req.body;
    if (name !== void 0 && (!String(name).trim() || isNumericOnlyProductName(name))) {
      res.status(400).json({
        error: "O nome do produto n\xE3o pode conter apenas n\xFAmeros. Informe uma descri\xE7\xE3o v\xE1lida."
      });
      return;
    }
    let catId = null;
    if (category) {
      const catRes = await pool.query("SELECT id FROM categorias WHERE nome = $1 LIMIT 1", [category]);
      catId = catRes.rows[0]?.id ?? null;
    }
    const unitDb = unit ? unit === "kg" ? "KG" : unit === "L" ? "LT" : unit === "cx" ? "CX" : "UN" : null;
    await pool.query(
      `UPDATE produtos SET
        nome = COALESCE($1, nome),
        codigo_barras = COALESCE($2, codigo_barras),
        categoria_id = COALESCE($3, categoria_id),
        unidade_medida = COALESCE($4, unidade_medida),
        preco_venda = COALESCE($5, preco_venda),
        preco_custo = COALESCE($6, preco_custo),
        estoque_minimo = COALESCE($7, estoque_minimo),
        estoque_atual = COALESCE($8, estoque_atual),
        data_validade = COALESCE($9, data_validade),
        somente_admin = COALESCE($10, somente_admin),
        updated_at = NOW()
       WHERE id = $11`,
      [
        name ?? null,
        barcode ?? null,
        catId,
        unitDb,
        salePrice ?? null,
        costPrice ?? null,
        minStock ?? null,
        stock ?? null,
        expiryDate || null,
        adminOnly ?? null,
        id
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
catalogRouter.delete("/products/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    await pool.query("UPDATE produtos SET ativo = FALSE WHERE id = $1", [id]);
    await logAudit(req.user.id, "EXCLUIU_PRODUTO", "produtos", id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
catalogRouter.post("/movements", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { productName, type, quantity, reason, costUnit, invoiceNumber } = req.body;
    const qtyNum = Number(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum === 0) {
      res.status(400).json({ error: "Quantidade inv\xE1lida." });
      return;
    }
    await client.query("BEGIN");
    const prodRes = await client.query(
      "SELECT id, estoque_atual, preco_custo FROM produtos WHERE nome = $1 LIMIT 1",
      [productName]
    );
    const prod = prodRes.rows[0];
    if (!prod) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Produto n\xE3o encontrado." });
      return;
    }
    const tipoDb = type === "Entrada" ? "ENTRADA_COMPRA" : type === "Vencimento" ? "VENCIMENTO" : type === "Perda / Avaria" ? "PERDA_AVARIA" : "AJUSTE_INVENTARIO";
    await client.query(
      `INSERT INTO movimentacoes_estoque (produto_id, usuario_id, tipo, quantidade, custo_unitario, numero_nota_fiscal, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [prod.id, req.user.id, tipoDb, qtyNum, costUnit ?? prod.preco_custo, invoiceNumber ?? null, reason ?? ""]
    );
    const cfg = await client.query(
      "SELECT recalcular_custo_medio FROM configuracoes WHERE id = 1"
    );
    if (tipoDb === "ENTRADA_COMPRA" && cfg.rows[0]?.recalcular_custo_medio && costUnit) {
      const oldStock = Math.max(0, Number(prod.estoque_atual));
      const oldCost = Number(prod.preco_custo);
      const newStock = oldStock + Math.abs(qtyNum);
      const avgCost = newStock > 0 ? (oldStock * oldCost + Math.abs(qtyNum) * Number(costUnit)) / newStock : Number(costUnit);
      await client.query(
        "UPDATE produtos SET estoque_atual = estoque_atual + $1, preco_custo = $2, updated_at = NOW() WHERE id = $3",
        [qtyNum, avgCost.toFixed(2), prod.id]
      );
    } else {
      await client.query(
        "UPDATE produtos SET estoque_atual = estoque_atual + $1, updated_at = NOW() WHERE id = $2",
        [qtyNum, prod.id]
      );
    }
    await client.query("COMMIT");
    res.status(201).json(req.body);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// server/routes/salesAndPdv.ts
import { Router as Router3 } from "express";
var salesAndPdvRouter = Router3();
var pinRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1e3,
  max: 20,
  message: "Muitas tentativas de PIN. Aguarde alguns minutos.",
  keyPrefix: "pin"
});
var payMethodToDb = {
  Dinheiro: "DINHEIRO",
  PIX: "PIX",
  "D\xE9bito": "DEBITO",
  "Cr\xE9dito": "CREDITO",
  "Credi\xE1rio": "FIADO",
  Fiado: "FIADO"
};
salesAndPdvRouter.post("/sales", requireAuth, async (req, res, next) => {
  if (req.body?.authorizerPin) {
    pinRateLimiter(req, res, () => next());
    return;
  }
  next();
}, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      cupom,
      paymentMethod,
      customerId,
      items,
      discount = 0,
      authorizerPin
    } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Carrinho vazio." });
      return;
    }
    const parsedDiscount = Number(discount ?? 0);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
      res.status(400).json({ error: "Desconto inv\xE1lido." });
      return;
    }
    await client.query("BEGIN");
    const cfgRes = await client.query(
      "SELECT exigir_abertura_caixa, bloquear_fiado_acima_limite, exigir_pin_desconto_cancelamento, desconto_max_sem_pin FROM configuracoes WHERE id = 1"
    );
    const cfg = cfgRes.rows[0];
    const openShiftRes = await client.query(
      `SELECT id FROM caixas
       WHERE status = 'ABERTO'
         AND (data_abertura AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
       ORDER BY id DESC LIMIT 1`
    );
    const caixaId = openShiftRes.rows[0]?.id;
    if (!caixaId) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Nenhum caixa do dia aberto. Abra o caixa de hoje antes de realizar vendas." });
      return;
    }
    const activeCaixaId = caixaId;
    const activeOpId = req.user.id;
    const formaDb = payMethodToDb[paymentMethod] ?? "PIX";
    let subtotal = 0;
    const resolvedItems = [];
    for (const item of items) {
      const prodId = Number(item.productId);
      const qty = Number(item.quantity);
      if (!Number.isInteger(prodId) || prodId <= 0 || !Number.isFinite(qty) || qty <= 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Item ou quantidade inv\xE1lida no carrinho." });
        return;
      }
      const prodRes = await client.query(
        "SELECT id, preco_venda, preco_custo FROM produtos WHERE id = $1 AND ativo = TRUE LIMIT 1",
        [prodId]
      );
      const prod = prodRes.rows[0];
      if (!prod) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: `Produto #${prodId} n\xE3o encontrado ou inativo.` });
        return;
      }
      const preco = Number(prod.preco_venda);
      const custo = Number(prod.preco_custo);
      const itemSub = preco * qty;
      subtotal += itemSub;
      resolvedItems.push({
        produtoId: prod.id,
        quantidade: qty,
        precoUnitario: preco,
        custoUnitario: custo,
        subtotal: itemSub
      });
    }
    if (parsedDiscount > subtotal) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Desconto n\xE3o pode ser maior que o subtotal da venda." });
      return;
    }
    const discountPct = subtotal > 0 ? parsedDiscount / subtotal * 100 : 0;
    const maxDiscountPct = Number(cfg?.desconto_max_sem_pin ?? 5);
    if (cfg?.exigir_pin_desconto_cancelamento && discountPct > maxDiscountPct && req.user.role === "OPERADOR") {
      const pinTrimmed = String(authorizerPin ?? "").trim();
      if (!pinTrimmed) {
        await client.query("ROLLBACK");
        res.status(403).json({
          error: `Desconto acima de ${maxDiscountPct}% exige PIN de Gerente ou Administrador.`,
          requiresPin: true
        });
        return;
      }
      const authDiscountRes = await client.query(
        `SELECT id FROM usuarios WHERE pin_rapido = $1 AND ativo = TRUE AND perfil IN ('ADMIN', 'GERENTE') LIMIT 1`,
        [pinTrimmed]
      );
      if (authDiscountRes.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(403).json({ error: "PIN inv\xE1lido para autorizar desconto.", requiresPin: true });
        return;
      }
    }
    const total = Math.max(0, subtotal - parsedDiscount);
    let parsedCustomerId = customerId ? Number(customerId) : null;
    let authorizedByUser = null;
    let authorizationReason = null;
    if (!parsedCustomerId && formaDb !== "FIADO") {
      const balcaoRes = await client.query(
        `SELECT id FROM clientes WHERE LOWER(nome) = 'venda no balc\xE3o' LIMIT 1`
      );
      if (balcaoRes.rows[0]?.id) {
        parsedCustomerId = balcaoRes.rows[0].id;
      } else {
        const insertedBalcao = await client.query(
          `INSERT INTO clientes (nome, telefone_whatsapp, limite_credito, saldo_devedor, status_credito)
           VALUES ('Venda no Balc\xE3o', '', 0.00, 0.00, 'EM_DIA') RETURNING id`
        );
        parsedCustomerId = insertedBalcao.rows[0].id;
      }
    }
    if (formaDb === "FIADO") {
      if (!parsedCustomerId) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Selecione um cliente cadastrado para venda no Credi\xE1rio." });
        return;
      }
      const cliRes = await client.query(
        "SELECT nome, limite_credito, saldo_devedor, status_credito FROM clientes WHERE id = $1",
        [parsedCustomerId]
      );
      const cli = cliRes.rows[0];
      if (!cli) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Cliente de Credi\xE1rio n\xE3o encontrado." });
        return;
      }
      const cliNomeNorm = cli.nome.trim().toLowerCase();
      if (cliNomeNorm === "venda no balc\xE3o" || cliNomeNorm === "vendas no balc\xE3o") {
        await client.query("ROLLBACK");
        res.status(400).json({ error: 'O cliente "Venda no Balc\xE3o" n\xE3o pode ser utilizado em vendas no Credi\xE1rio.' });
        return;
      }
      const saldoAtual = Number(cli.saldo_devedor);
      const limiteAtual = Number(cli.limite_credito);
      const limiteDisponivel = limiteAtual - saldoAtual;
      const isBlocked = cli.status_credito === "BLOQUEADO";
      const isLimitLowOrExceeded = limiteDisponivel < total || limiteDisponivel <= 0;
      if (isBlocked || isLimitLowOrExceeded) {
        const reason = isBlocked ? "Cliente bloqueado no Credi\xE1rio" : limiteDisponivel <= 0 ? "Cliente com limite negativo ou zerado" : "Limite de cr\xE9dito insuficiente para esta venda";
        const pinTrimmed = String(authorizerPin ?? "").trim();
        if (!pinTrimmed) {
          await client.query("ROLLBACK");
          res.status(403).json({
            error: `${reason}. Informe o PIN de um Gerente ou Administrador para autorizar.`,
            requiresPin: true,
            reason
          });
          return;
        }
        const authRes = await client.query(
          `SELECT id, nome FROM usuarios
           WHERE pin_rapido = $1 AND ativo = TRUE AND perfil IN ('ADMIN', 'GERENTE')
           LIMIT 1`,
          [pinTrimmed]
        );
        if (authRes.rowCount === 0) {
          await client.query("ROLLBACK");
          res.status(403).json({
            error: "PIN inv\xE1lido ou usu\xE1rio sem permiss\xE3o de Gerente/Administrador.",
            requiresPin: true,
            reason
          });
          return;
        }
        authorizedByUser = authRes.rows[0];
        authorizationReason = reason;
      }
    }
    const saleRes = await client.query(
      `INSERT INTO vendas (numero_cupom, caixa_id, operador_id, cliente_id, forma_pagamento, subtotal, desconto, total, status, autorizado_por_id, motivo_autorizacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONCLUIDA', $9, $10) RETURNING id`,
      [
        cupom,
        activeCaixaId,
        activeOpId,
        parsedCustomerId,
        formaDb,
        subtotal,
        discount,
        total,
        authorizedByUser?.id ?? null,
        authorizationReason
      ]
    );
    const vendaId = saleRes.rows[0].id;
    for (const ri of resolvedItems) {
      await client.query(
        `INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, custo_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [vendaId, ri.produtoId, ri.quantidade, ri.precoUnitario, ri.custoUnitario, ri.subtotal]
      );
      await client.query(
        "UPDATE produtos SET estoque_atual = estoque_atual - $1, updated_at = NOW() WHERE id = $2",
        [ri.quantidade, ri.produtoId]
      );
      await client.query(
        `INSERT INTO movimentacoes_estoque (produto_id, usuario_id, tipo, quantidade, custo_unitario, observacao)
         VALUES ($1, $2, 'SAIDA_VENDA', $3, $4, $5)`,
        [ri.produtoId, activeOpId, -ri.quantidade, ri.custoUnitario, `Venda PDV ${cupom}`]
      );
    }
    if (formaDb === "DINHEIRO") {
      await client.query(
        "UPDATE caixas SET valor_sistema_dinheiro = valor_sistema_dinheiro + $1 WHERE id = $2",
        [total, activeCaixaId]
      );
    } else if (formaDb !== "FIADO") {
      await client.query(
        "UPDATE caixas SET valor_sistema_digital = valor_sistema_digital + $1 WHERE id = $2",
        [total, activeCaixaId]
      );
    }
    if (formaDb === "FIADO" && parsedCustomerId) {
      await client.query(
        "UPDATE clientes SET saldo_devedor = saldo_devedor + $1, updated_at = NOW() WHERE id = $2",
        [total, parsedCustomerId]
      );
      const obsFiado = authorizedByUser ? `Cupom ${cupom} \u2022 Autorizado por ${authorizedByUser.nome} (${authorizationReason})` : `Cupom ${cupom}`;
      await client.query(
        `INSERT INTO movimentacoes_fiado (cliente_id, venda_id, usuario_id, tipo, valor, observacao)
         VALUES ($1, $2, $3, 'COMPRA_FIADO', $4, $5)`,
        [parsedCustomerId, vendaId, activeOpId, total, obsFiado]
      );
    }
    if (authorizedByUser) {
      await client.query(
        `INSERT INTO auditoria_logs (usuario_id, acao, tabela_afetada, registro_id, detalhes_json)
         VALUES ($1, 'AUTORIZACAO_CREDIARIO_PIN', 'vendas', $2, $3::jsonb)`,
        [
          authorizedByUser.id,
          vendaId,
          JSON.stringify({
            cupom,
            clienteId: parsedCustomerId,
            operadorId: activeOpId,
            autorizadoPor: authorizedByUser.nome,
            motivo: authorizationReason,
            total
          })
        ]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({
      id: String(vendaId),
      cupom,
      total,
      authorizedBy: authorizedByUser?.nome ?? null
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
salesAndPdvRouter.get("/sales/:id/items", requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de venda inv\xE1lido." });
      return;
    }
    const result = await pool.query(
      `SELECT
        vi.id::text AS id,
        p.nome AS "productName",
        vi.quantidade::float AS quantity,
        vi.preco_unitario::float AS "unitPrice",
        vi.subtotal::float AS subtotal
       FROM venda_itens vi
       JOIN produtos p ON p.id = vi.produto_id
       WHERE vi.venda_id = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
salesAndPdvRouter.post("/sales/:id/cancel", requireAuth, pinRateLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de venda inv\xE1lido." });
      return;
    }
    const { adminPin } = req.body;
    const cfgRes = await client.query(
      "SELECT exigir_pin_desconto_cancelamento FROM configuracoes WHERE id = 1"
    );
    let adminId = null;
    if (cfgRes.rows[0]?.exigir_pin_desconto_cancelamento) {
      const adminRes = await client.query(
        "SELECT id FROM usuarios WHERE perfil = 'ADMIN' AND pin_rapido = $1 AND ativo = TRUE LIMIT 1",
        [adminPin ?? ""]
      );
      if (!adminRes.rows[0]) {
        res.status(403).json({ error: "PIN de Administrador inv\xE1lido para cancelamento." });
        return;
      }
      adminId = adminRes.rows[0].id;
    }
    await client.query("BEGIN");
    const saleRes = await client.query("SELECT id, numero_cupom, caixa_id, forma_pagamento, total, status FROM vendas WHERE id = $1", [id]);
    const sale = saleRes.rows[0];
    if (!sale || sale.status === "CANCELADA") {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Venda n\xE3o encontrada ou j\xE1 cancelada." });
      return;
    }
    await client.query("UPDATE vendas SET status = 'CANCELADA' WHERE id = $1", [sale.id]);
    const itemsRes = await client.query(
      "SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = $1",
      [sale.id]
    );
    for (const item of itemsRes.rows) {
      await client.query("UPDATE produtos SET estoque_atual = estoque_atual + $1 WHERE id = $2", [
        Number(item.quantidade),
        item.produto_id
      ]);
    }
    const total = Number(sale.total);
    if (sale.forma_pagamento === "DINHEIRO") {
      await client.query(
        "UPDATE caixas SET valor_sistema_dinheiro = GREATEST(0, valor_sistema_dinheiro - $1) WHERE id = $2",
        [total, sale.caixa_id]
      );
    } else if (sale.forma_pagamento !== "FIADO") {
      await client.query(
        "UPDATE caixas SET valor_sistema_digital = GREATEST(0, valor_sistema_digital - $1) WHERE id = $2",
        [total, sale.caixa_id]
      );
    }
    await client.query("COMMIT");
    await logAudit(adminId, "CANCELOU_VENDA", "vendas", sale.id, { cupom: sale.numero_cupom, total });
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
salesAndPdvRouter.get("/comandas", requireAuth, async (_req, res) => {
  try {
    const comandasRes = await pool.query(
      `SELECT c.id, c.identificador, c.observacao, c.status, c.cadastrada,
              TO_CHAR(c.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS created_at,
              TO_CHAR(c.updated_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS updated_at,
              u.nome AS operador
       FROM comandas c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.ativo = TRUE AND (c.cadastrada = TRUE OR c.status = 'ABERTA')
       ORDER BY (c.status = 'ABERTA') DESC, c.cadastrada DESC, c.identificador ASC, c.id ASC`
    );
    if (comandasRes.rows.length === 0) {
      res.json([]);
      return;
    }
    const ids = comandasRes.rows.map((r) => r.id);
    const itensRes = await pool.query(
      `SELECT ci.comanda_id, ci.produto_id, p.nome AS product_name,
              LOWER(p.unidade_medida::text) AS unit,
              ci.quantidade, ci.preco_unitario
       FROM comanda_itens ci
       JOIN produtos p ON p.id = ci.produto_id
       WHERE ci.comanda_id = ANY($1::int[])
       ORDER BY ci.id ASC`,
      [ids]
    );
    const itemsByComanda = /* @__PURE__ */ new Map();
    for (const row of itensRes.rows) {
      const qty = Number(row.quantidade);
      const price = Number(row.preco_unitario);
      const list = itemsByComanda.get(row.comanda_id) ?? [];
      list.push({
        productId: String(row.produto_id),
        productName: row.product_name,
        unit: row.unit === "lt" ? "L" : row.unit,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price
      });
      itemsByComanda.set(row.comanda_id, list);
    }
    res.json(
      comandasRes.rows.map((c) => {
        const items = itemsByComanda.get(c.id) ?? [];
        const total = items.reduce((acc, it) => acc + it.subtotal, 0);
        return {
          id: String(c.id),
          identificador: c.identificador,
          observacao: c.observacao ?? "",
          status: c.status,
          cadastrada: c.cadastrada,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          operator: c.operador ?? "Operador",
          items,
          total
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
salesAndPdvRouter.post("/comandas", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { identificador, observacao, items, cadastrada, prefixo, inicio, fim } = req.body;
    if (cadastrada && prefixo !== void 0 && inicio !== void 0 && fim !== void 0) {
      const start = Math.max(1, Math.floor(Number(inicio)));
      const end = Math.min(start + 49, Math.floor(Number(fim)));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        res.status(400).json({ error: "Intervalo inv\xE1lido para cadastro em lote." });
        return;
      }
      const pref = String(prefixo).trim();
      await client.query("BEGIN");
      let createdCount = 0;
      for (let n = start; n <= end; n++) {
        const label2 = `${pref ? `${pref} ` : ""}${String(n).padStart(2, "0")}`;
        const exists = await client.query(
          `SELECT id FROM comandas WHERE LOWER(TRIM(identificador)) = LOWER($1) AND ativo = TRUE LIMIT 1`,
          [label2]
        );
        if (exists.rows.length === 0) {
          await client.query(
            `INSERT INTO comandas (identificador, observacao, status, cadastrada, ativo, usuario_id)
             VALUES ($1, $2, 'LIVRE', TRUE, TRUE, $3)`,
            [label2, observacao?.trim() || null, req.user.id]
          );
          createdCount++;
        }
      }
      await client.query("COMMIT");
      res.status(201).json({ ok: true, createdCount });
      return;
    }
    const label = String(identificador ?? "").trim();
    if (!label) {
      res.status(400).json({ error: "Informe a identifica\xE7\xE3o da comanda (ex: MESA 01 ou Nome)." });
      return;
    }
    if (cadastrada) {
      const exists = await pool.query(
        `SELECT id FROM comandas WHERE LOWER(TRIM(identificador)) = LOWER($1) AND ativo = TRUE LIMIT 1`,
        [label]
      );
      if (exists.rows.length > 0) {
        res.status(409).json({ error: `J\xE1 existe uma comanda cadastrada com o nome "${label}".` });
        return;
      }
      const inserted2 = await pool.query(
        `INSERT INTO comandas (identificador, observacao, status, cadastrada, ativo, usuario_id)
         VALUES ($1, $2, 'LIVRE', TRUE, TRUE, $3) RETURNING id`,
        [label, observacao?.trim() || null, req.user.id]
      );
      res.status(201).json({ id: String(inserted2.rows[0].id), ok: true });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Adicione pelo menos um item para abrir a comanda." });
      return;
    }
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO comandas (identificador, observacao, status, cadastrada, ativo, usuario_id)
       VALUES ($1, $2, 'ABERTA', FALSE, TRUE, $3) RETURNING id`,
      [label, observacao?.trim() || null, req.user.id]
    );
    const comandaId = inserted.rows[0].id;
    for (const item of items) {
      await client.query(
        `INSERT INTO comanda_itens (comanda_id, produto_id, quantidade, preco_unitario)
         VALUES ($1, $2, $3, $4)`,
        [comandaId, Number(item.productId), Number(item.quantity), Number(item.unitPrice)]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ id: String(comandaId), ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});
salesAndPdvRouter.put("/comandas/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de comanda inv\xE1lido." });
      return;
    }
    const { items, observacao } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "A comanda precisa ter ao menos um item." });
      return;
    }
    await client.query("BEGIN");
    await client.query(
      `UPDATE comandas SET status = 'ABERTA', observacao = COALESCE($1, observacao), updated_at = NOW()
       WHERE id = $2 AND ativo = TRUE`,
      [observacao?.trim() || null, id]
    );
    await client.query("DELETE FROM comanda_itens WHERE comanda_id = $1", [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO comanda_itens (comanda_id, produto_id, quantidade, preco_unitario)
         VALUES ($1, $2, $3, $4)`,
        [id, Number(item.productId), Number(item.quantity), Number(item.unitPrice)]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});
salesAndPdvRouter.post("/comandas/:id/close", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de comanda inv\xE1lido." });
      return;
    }
    const { vendaId } = req.body;
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT cadastrada FROM comandas WHERE id = $1",
      [id]
    );
    if (existing.rows[0]?.cadastrada) {
      await client.query("DELETE FROM comanda_itens WHERE comanda_id = $1", [id]);
      await client.query(
        `UPDATE comandas SET status = 'LIVRE', observacao = NULL, venda_id = NULL, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    } else {
      await client.query(
        `UPDATE comandas SET status = 'FECHADA', venda_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [vendaId ? Number(vendaId) : null, id]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});
salesAndPdvRouter.delete("/comandas/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de comanda inv\xE1lido." });
      return;
    }
    const archive = req.query.mode === "archive";
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT cadastrada FROM comandas WHERE id = $1",
      [id]
    );
    if (archive) {
      await client.query("DELETE FROM comanda_itens WHERE comanda_id = $1", [id]);
      await client.query("UPDATE comandas SET ativo = FALSE, updated_at = NOW() WHERE id = $1", [id]);
    } else if (existing.rows[0]?.cadastrada) {
      await client.query("DELETE FROM comanda_itens WHERE comanda_id = $1", [id]);
      await client.query(
        `UPDATE comandas SET status = 'LIVRE', observacao = NULL, updated_at = NOW() WHERE id = $1`,
        [id]
      );
    } else {
      await client.query(`DELETE FROM comandas WHERE id = $1 AND status = 'ABERTA'`, [id]);
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});

// server/routes/partnersAndFinance.ts
import { Router as Router4 } from "express";
var partnersAndFinanceRouter = Router4();
function isBalcaoCustomerName(name) {
  const normalized = (name ?? "").trim().toLowerCase();
  return normalized === "venda no balc\xE3o" || normalized === "vendas no balc\xE3o";
}
partnersAndFinanceRouter.post("/customers", requireAuth, async (req, res) => {
  try {
    const { name, phone, cpf, creditLimit, status, address, dueDay, notes } = req.body;
    const statusDb = status === "Bloqueado" ? "BLOQUEADO" : status === "Aten\xE7\xE3o" ? "PROXIMO_VENCIMENTO" : "EM_DIA";
    const inserted = await pool.query(
      `INSERT INTO clientes (nome, cpf, telefone_whatsapp, endereco, limite_credito, dia_vencimento_preferencial, status_credito, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, cpf || null, phone, address ?? null, creditLimit ?? 200, dueDay ?? 10, statusDb, notes ?? null]
    );
    const newId = String(inserted.rows[0].id);
    res.status(201).json({
      id: newId,
      name: name ?? "",
      phone: phone ?? "",
      cpf: cpf ?? "",
      creditLimit: Number(creditLimit ?? 200),
      currentDebt: 0,
      status: "Em dia",
      lastPurchase: "Hoje"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
partnersAndFinanceRouter.put("/customers/:id", requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const existing = await pool.query(
      "SELECT nome FROM clientes WHERE id = $1",
      [id]
    );
    const isBalcao = isBalcaoCustomerName(existing.rows[0]?.nome);
    const { name, phone, cpf, creditLimit, status, address, dueDay, notes } = req.body;
    const statusDb = isBalcao ? "EM_DIA" : status === "Bloqueado" ? "BLOQUEADO" : status === "Aten\xE7\xE3o" ? "PROXIMO_VENCIMENTO" : status === "Em dia" ? "EM_DIA" : null;
    await pool.query(
      `UPDATE clientes SET
        nome = COALESCE($1, nome),
        cpf = COALESCE($2, cpf),
        telefone_whatsapp = COALESCE($3, telefone_whatsapp),
        endereco = COALESCE($4, endereco),
        limite_credito = COALESCE($5, limite_credito),
        dia_vencimento_preferencial = COALESCE($6, dia_vencimento_preferencial),
        status_credito = COALESCE($7, status_credito),
        observacoes = COALESCE($8, observacoes),
        saldo_devedor = CASE WHEN $9 THEN 0 ELSE saldo_devedor END,
        updated_at = NOW()
       WHERE id = $10`,
      [
        isBalcao ? null : name ?? null,
        cpf || null,
        phone ?? null,
        address ?? null,
        isBalcao ? 0 : creditLimit ?? null,
        dueDay ?? null,
        statusDb,
        notes ?? null,
        isBalcao,
        id
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.delete("/customers/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const existing = await pool.query(
      "SELECT nome FROM clientes WHERE id = $1",
      [id]
    );
    const nome = (existing.rows[0]?.nome ?? "").trim().toLowerCase();
    if (nome === "venda no balc\xE3o" || nome === "vendas no balc\xE3o") {
      res.status(403).json({
        error: 'O cliente padr\xE3o "Venda no Balc\xE3o" n\xE3o pode ser exclu\xEDdo.'
      });
      return;
    }
    await pool.query("DELETE FROM clientes WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch {
    res.status(409).json({
      error: "N\xE3o \xE9 poss\xEDvel excluir cliente com vendas ou movimenta\xE7\xF5es de credi\xE1rio vinculadas."
    });
  }
});
partnersAndFinanceRouter.get("/customers/:id/fiado", requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const result = await pool.query(
      `SELECT id::text AS id, tipo::text AS type, valor::float AS amount,
       COALESCE(observacao, '') AS note, TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') AS date
       FROM movimentacoes_fiado WHERE cliente_id = $1 ORDER BY id DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.post("/customers/:id/fiado/pay", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const { amount, note } = req.body;
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      res.status(400).json({ error: "Valor de pagamento inv\xE1lido." });
      return;
    }
    const existing = await pool.query(
      "SELECT nome FROM clientes WHERE id = $1",
      [id]
    );
    if (isBalcaoCustomerName(existing.rows[0]?.nome)) {
      res.status(403).json({ error: 'O cliente padr\xE3o "Venda no Balc\xE3o" n\xE3o possui credi\xE1rio.' });
      return;
    }
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO movimentacoes_fiado (cliente_id, usuario_id, tipo, valor, observacao)
       VALUES ($1, $2, 'PAGAMENTO_ABATE', $3, $4)`,
      [id, req.user.id, val, note || "Abatimento de fiado no balc\xE3o"]
    );
    await client.query(
      `UPDATE clientes SET saldo_devedor = GREATEST(0, saldo_devedor - $1),
       status_credito = CASE WHEN saldo_devedor - $1 <= 0 THEN 'EM_DIA'::status_credito_enum ELSE status_credito END,
       updated_at = NOW() WHERE id = $2`,
      [val, id]
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});
partnersAndFinanceRouter.post("/suppliers", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const { name, cnpj, contact, phone, category, leadTimeDays, email } = req.body;
    const inserted = await pool.query(
      `INSERT INTO fornecedores (razao_social, nome_fantasia, cnpj, telefone_whatsapp, email, nome_vendedor, categoria_fornecimento, prazo_entrega_dias)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, name, cnpj || null, phone, email || null, contact ?? "", category ?? "Geral", leadTimeDays ?? 2]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
partnersAndFinanceRouter.put("/suppliers/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const { name, cnpj, contact, phone, category, leadTimeDays, email } = req.body;
    await pool.query(
      `UPDATE fornecedores SET
        razao_social = COALESCE($1, razao_social),
        nome_fantasia = COALESCE($1, nome_fantasia),
        cnpj = COALESCE($2, cnpj),
        telefone_whatsapp = COALESCE($3, telefone_whatsapp),
        email = COALESCE($4, email),
        nome_vendedor = COALESCE($5, nome_vendedor),
        categoria_fornecimento = COALESCE($6, categoria_fornecimento),
        prazo_entrega_dias = COALESCE($7, prazo_entrega_dias)
       WHERE id = $8`,
      [
        name ?? null,
        cnpj || null,
        phone ?? null,
        email || null,
        contact ?? null,
        category ?? null,
        leadTimeDays ?? null,
        id
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.delete("/suppliers/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    try {
      await pool.query("DELETE FROM fornecedores WHERE id = $1", [id]);
    } catch {
      await pool.query("UPDATE fornecedores SET ativo = FALSE WHERE id = $1", [id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.post("/shifts/open", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { openingBalance, registerNumber, notes } = req.body;
    const inserted = await pool.query(
      `INSERT INTO caixas (numero_pdv, operador_id, valor_inicial, status, observacao_abertura)
       VALUES ($1, $2, $3, 'ABERTO', $4) RETURNING id`,
      [registerNumber || 1, req.user.id, openingBalance ?? 200, notes ?? null]
    );
    res.status(201).json({ id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.post("/shifts/:id/close", requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID de turno inv\xE1lido." });
      return;
    }
    const { countedCash, notes } = req.body;
    const shiftRes = await pool.query(
      "SELECT valor_inicial, valor_sistema_dinheiro FROM caixas WHERE id = $1",
      [id]
    );
    const sh = shiftRes.rows[0];
    if (!sh) {
      res.status(404).json({ error: "Turno n\xE3o encontrado." });
      return;
    }
    const expectedCash = Number(sh.valor_inicial) + Number(sh.valor_sistema_dinheiro);
    const diff = Number(countedCash) - expectedCash;
    await pool.query(
      `UPDATE caixas SET
        data_fechamento = NOW(),
        valor_informado_fechamento = $1,
        diferenca_quebra = $2,
        status = 'FECHADO',
        observacao_fechamento = $3
       WHERE id = $4`,
      [Number(countedCash), diff, notes ?? null, id]
    );
    await logAudit(req.user.id, "FECHOU_CAIXA", "caixas", id, { countedCash, diff });
    res.json({ ok: true, diff });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
function mapExpenseCategory(cat) {
  const c = (cat ?? "").toLowerCase();
  if (c.includes("aluguel")) return "ALUGUEL";
  if (c.includes("impost") || c.includes("taxa")) return "IMPOSTOS";
  if (c.includes("manuten")) return "MANUTENCAO";
  if (c.includes("energia") || c.includes("\xE1gua") || c.includes("util")) return "UTILIDADES";
  if (c.includes("folha") || c.includes("outr")) return "OUTROS";
  return "MERCADORIA";
}
partnersAndFinanceRouter.post("/payables", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const { description, supplier, category, dueDate, amount, status } = req.body;
    const isoDate = dueDate.includes("/") ? dueDate.split("/").reverse().join("-") : dueDate;
    const statusDb = status === "Pago" ? "PAGO" : status === "Vencido" ? "ATRASADO" : "PENDENTE";
    let supplierId = null;
    if (supplier && !supplier.toLowerCase().includes("sem fornecedor")) {
      const supRes = await pool.query(
        "SELECT id FROM fornecedores WHERE nome_fantasia = $1 LIMIT 1",
        [supplier]
      );
      supplierId = supRes.rows[0]?.id ?? null;
    }
    const inserted = await pool.query(
      `INSERT INTO contas_a_pagar (fornecedor_id, descricao, categoria, valor, data_vencimento, data_pagamento, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        supplierId,
        description,
        mapExpenseCategory(category),
        amount,
        isoDate,
        statusDb === "PAGO" ? isoDate : null,
        statusDb
      ]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
partnersAndFinanceRouter.put("/payables/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    const { description, supplier, category, dueDate, amount, status } = req.body;
    const isoDate = dueDate ? dueDate.includes("/") ? dueDate.split("/").reverse().join("-") : dueDate : null;
    const statusDb = status === "Pago" ? "PAGO" : status === "Vencido" ? "ATRASADO" : status === "Pendente" ? "PENDENTE" : null;
    let supplierId = null;
    if (supplier && !supplier.toLowerCase().includes("sem fornecedor")) {
      const supRes = await pool.query(
        "SELECT id FROM fornecedores WHERE nome_fantasia = $1 LIMIT 1",
        [supplier]
      );
      supplierId = supRes.rows[0]?.id ?? null;
    }
    await pool.query(
      `UPDATE contas_a_pagar SET
        fornecedor_id = $1,
        descricao = COALESCE($2, descricao),
        categoria = COALESCE($3, categoria),
        valor = COALESCE($4, valor),
        data_vencimento = COALESCE($5, data_vencimento),
        status = COALESCE($6, status),
        data_pagamento = CASE WHEN $6 = 'PAGO' THEN COALESCE(data_pagamento, CURRENT_DATE) ELSE data_pagamento END
       WHERE id = $7`,
      [
        supplierId,
        description ?? null,
        category ? mapExpenseCategory(category) : null,
        amount ?? null,
        isoDate,
        statusDb,
        id
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.delete("/payables/:id", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    await pool.query("DELETE FROM contas_a_pagar WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.post("/payables/:id/pay", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inv\xE1lido." });
      return;
    }
    await pool.query(
      "UPDATE contas_a_pagar SET status = 'PAGO', data_pagamento = CURRENT_DATE WHERE id = $1",
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
partnersAndFinanceRouter.get("/reports/abc", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id::text AS "productId",
        p.nome AS name,
        c.nome AS category,
        SUM(vi.quantidade)::float AS "qtySold",
        SUM(vi.subtotal)::float AS revenue,
        SUM((vi.preco_unitario - vi.custo_unitario) * vi.quantidade)::float AS "grossProfit"
      FROM venda_itens vi
      JOIN vendas v ON v.id = vi.venda_id
      JOIN produtos p ON p.id = vi.produto_id
      JOIN categorias c ON c.id = p.categoria_id
      WHERE v.status = 'CONCLUIDA'
      GROUP BY p.id, p.nome, c.nome
      ORDER BY revenue DESC
    `);
    const totalRevenue = result.rows.reduce((acc, r) => acc + r.revenue, 0) || 1;
    let cumulative = 0;
    const abc = result.rows.map((row) => {
      const sharePct = row.revenue / totalRevenue * 100;
      cumulative += sharePct;
      const abcClass = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";
      return { ...row, sharePct, cumulativePct: cumulative, abcClass };
    });
    res.json({ totalRevenue, items: abc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
partnersAndFinanceRouter.get("/dashboard/summary", requireAuth, async (_req, res) => {
  try {
    const [salesToday, criticalStock, fiadoTotal, expiringSoon, cfgRow] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(total), 0)::float AS total, COUNT(*)::int AS count
         FROM vendas
         WHERE status = 'CONCLUIDA'
           AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM produtos WHERE ativo = TRUE AND estoque_atual <= estoque_minimo"
      ),
      pool.query(
        "SELECT COALESCE(SUM(saldo_devedor), 0)::float AS total, COUNT(*)::int AS count FROM clientes WHERE saldo_devedor > 0"
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM produtos p CROSS JOIN configuracoes cfg
         WHERE cfg.id = 1 AND p.ativo = TRUE AND p.data_validade IS NOT NULL
         AND p.data_validade <= CURRENT_DATE + (cfg.dias_alerta_validade || ' days')::INTERVAL`
      ),
      pool.query(
        "SELECT meta_diaria_faturamento FROM configuracoes WHERE id = 1"
      )
    ]);
    const totalRev = salesToday.rows[0]?.total ?? 0;
    const salesCount = salesToday.rows[0]?.count ?? 0;
    res.json({
      revenueToday: totalRev,
      salesCount,
      avgTicket: salesCount > 0 ? totalRev / salesCount : 0,
      criticalStockCount: criticalStock.rows[0]?.count ?? 0,
      fiadoTotal: fiadoTotal.rows[0]?.total ?? 0,
      fiadoCustomers: fiadoTotal.rows[0]?.count ?? 0,
      expiringCount: expiringSoon.rows[0]?.count ?? 0,
      metaDiaria: Number(cfgRow.rows[0]?.meta_diaria_faturamento ?? 5800)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// server/routes/notifications.ts
import { Router as Router5 } from "express";
var notificationsRouter = Router5();
notificationsRouter.use(requireAuth);
async function syncNotifications() {
  const { rows: cfgRows } = await pool.query(
    "SELECT dias_alerta_validade FROM configuracoes WHERE id = 1"
  );
  const diasValidade = Number(cfgRows[0]?.dias_alerta_validade ?? 15);
  const { rows: expiryRows } = await pool.query(
    `SELECT
       id,
       nome,
       TO_CHAR(data_validade, 'YYYY-MM-DD') AS data_validade_iso,
       TO_CHAR(data_validade, 'DD/MM/YYYY') AS data_validade_br,
       (data_validade < CURRENT_DATE) AS vencido,
       somente_admin
     FROM produtos
     WHERE ativo = TRUE
       AND data_validade IS NOT NULL
       AND data_validade <= CURRENT_DATE + ($1 || ' days')::INTERVAL`,
    [diasValidade]
  );
  for (const p of expiryRows) {
    const chave = `VALIDADE:${p.id}:${p.data_validade_iso}:${p.vencido ? "VENCIDO" : "PROXIMO"}`;
    const severidade = p.vencido ? "CRITICA" : "ALERTA";
    const titulo = p.vencido ? `Produto vencido: ${p.nome}` : `Validade pr\xF3xima: ${p.nome}`;
    const mensagem = p.vencido ? `Venceu em ${p.data_validade_br}. Retire da g\xF4ndola.` : `Vence em ${p.data_validade_br}. Avalie promo\xE7\xE3o.`;
    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'VALIDADE', $2, $3, $4, '/alerta-de-validade', $5)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem, p.somente_admin]
    );
  }
  const { rows: stockRows } = await pool.query(
    `SELECT id, nome, estoque_atual::float AS estoque_atual, estoque_minimo::float AS estoque_minimo, somente_admin
     FROM produtos
     WHERE ativo = TRUE AND estoque_atual <= estoque_minimo`
  );
  for (const p of stockRows) {
    const atual = Number(p.estoque_atual);
    const minimo = Number(p.estoque_minimo);
    const zerado = atual <= 0;
    const chave = `ESTOQUE:${p.id}:${zerado ? "ZERO" : "BAIXO"}`;
    const severidade = zerado ? "CRITICA" : "ALERTA";
    const titulo = zerado ? `Estoque zerado: ${p.nome}` : `Estoque baixo: ${p.nome}`;
    const mensagem = zerado ? "Produto sem unidades em estoque." : `Atual: ${atual} (m\xEDnimo: ${minimo}).`;
    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'ESTOQUE', $2, $3, $4, '/produtos', $5)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem, p.somente_admin]
    );
  }
  const { rows: payableRows } = await pool.query(
    `SELECT
       id,
       descricao,
       valor::float AS valor,
       TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS venc_iso,
       TO_CHAR(data_vencimento, 'DD/MM/YYYY') AS venc_br,
       (data_vencimento < CURRENT_DATE) AS atrasada,
       (data_vencimento = CURRENT_DATE) AS hoje
     FROM contas_a_pagar
     WHERE status <> 'PAGO'
       AND data_vencimento <= CURRENT_DATE + INTERVAL '3 days'`
  );
  for (const cp of payableRows) {
    const valorFmt = Number(cp.valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
    const statusTag = cp.atrasada ? "ATRASADA" : cp.hoje ? "HOJE" : "BREVE";
    const chave = `CONTA_PAGAR:${cp.id}:${cp.venc_iso}:${statusTag}`;
    const severidade = cp.atrasada || cp.hoje ? "CRITICA" : "ALERTA";
    const titulo = cp.atrasada ? `Conta atrasada: ${cp.descricao}` : cp.hoje ? `Conta vence hoje: ${cp.descricao}` : `Conta a vencer: ${cp.descricao}`;
    const mensagem = `Vencimento: ${cp.venc_br} \u2022 ${valorFmt}`;
    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'CONTA_PAGAR', $2, $3, $4, '/contas-a-pagar', TRUE)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem]
    );
  }
  const { rows: credRows } = await pool.query(
    `SELECT id, nome, saldo_devedor::float AS saldo_devedor, limite_credito::float AS limite_credito, status_credito
     FROM clientes
     WHERE saldo_devedor > 0
       AND (
         status_credito IN ('PROXIMO_VENCIMENTO', 'ATRASADO', 'BLOQUEADO')
         OR (limite_credito > 0 AND saldo_devedor >= limite_credito * 0.8)
       )`
  );
  for (const c of credRows) {
    const saldoFmt = Number(c.saldo_devedor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
    const limFmt = Number(c.limite_credito).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
    const critico = c.status_credito === "ATRASADO" || c.status_credito === "BLOQUEADO";
    const chave = `CREDIARIO:${c.id}:${c.status_credito}`;
    const severidade = critico ? "CRITICA" : "ALERTA";
    const titulo = critico ? `Credi\xE1rio em atraso: ${c.nome}` : `Credi\xE1rio pr\xF3ximo do limite: ${c.nome}`;
    const mensagem = `Saldo: ${saldoFmt} / Limite: ${limFmt}`;
    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'CREDIARIO', $2, $3, $4, '/clientes', FALSE)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem]
    );
  }
  const { rows: caixaRows } = await pool.query(
    `SELECT id, numero_pdv
     FROM caixas
     WHERE status = 'ABERTO' AND data_abertura < NOW() - INTERVAL '24 hours'`
  );
  for (const cx of caixaRows) {
    const chave = `CAIXA_ABERTO:${cx.id}`;
    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'CAIXA', 'INFO', $2, $3, '/fluxo-de-caixa', FALSE)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [
        chave,
        `Caixa ${String(cx.numero_pdv).padStart(2, "0")} aberto h\xE1 +24h`,
        "Considere realizar a confer\xEAncia e fechamento do turno."
      ]
    );
  }
}
notificationsRouter.get("/notifications", async (req, res) => {
  try {
    await syncNotifications();
    const isAdmin = req.user.role === "ADMIN";
    const { rows } = await pool.query(
      `SELECT
         id::text AS id,
         tipo,
         severidade,
         titulo,
         mensagem,
         link,
         lida,
         TO_CHAR(created_at, 'DD/MM HH24:MI') AS "createdAt"
       FROM notificacoes
       WHERE excluida = FALSE
         ${isAdmin ? "" : "AND somente_admin = FALSE"}
       ORDER BY
         lida ASC,
         CASE severidade WHEN 'CRITICA' THEN 1 WHEN 'ALERTA' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT 50`
    );
    const unreadCount = rows.filter((r) => !r.lida).length;
    res.json({ items: rows, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
notificationsRouter.patch("/notifications/read-all", async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    await pool.query(
      `UPDATE notificacoes
       SET lida = TRUE, updated_at = NOW()
       WHERE excluida = FALSE AND lida = FALSE
         ${isAdmin ? "" : "AND somente_admin = FALSE"}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
notificationsRouter.patch("/notifications/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID inv\xE1lido" });
    }
    const lida = req.body?.lida !== void 0 ? Boolean(req.body.lida) : true;
    await pool.query(
      "UPDATE notificacoes SET lida = $1, updated_at = NOW() WHERE id = $2",
      [lida, id]
    );
    res.json({ ok: true, id: String(id), lida });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
notificationsRouter.delete("/notifications", async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    const onlyRead = req.query.all !== "true";
    await pool.query(
      `UPDATE notificacoes
       SET excluida = TRUE, updated_at = NOW()
       WHERE excluida = FALSE
         ${onlyRead ? "AND lida = TRUE" : ""}
         ${isAdmin ? "" : "AND somente_admin = FALSE"}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
notificationsRouter.delete("/notifications/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID inv\xE1lido" });
    }
    await pool.query(
      "UPDATE notificacoes SET excluida = TRUE, updated_at = NOW() WHERE id = $1",
      [id]
    );
    res.json({ ok: true, id: String(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// server/routes/print.ts
import { Router as Router6 } from "express";

// server/utils/printer.ts
import { execFile } from "node:child_process";
import fs2 from "node:fs/promises";
import os from "node:os";
import path2 from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var CP850_MAP = {
  \u00C7: 128,
  \u00FC: 129,
  \u00E9: 130,
  \u00E2: 131,
  \u00E4: 132,
  \u00E0: 133,
  \u00E5: 134,
  \u00E7: 135,
  \u00EA: 136,
  \u00EB: 137,
  \u00E8: 138,
  \u00EF: 139,
  \u00EE: 140,
  \u00EC: 141,
  \u00C4: 142,
  \u00C5: 143,
  \u00C9: 144,
  \u00E6: 145,
  \u00C6: 146,
  \u00F4: 147,
  \u00F6: 148,
  \u00F2: 149,
  \u00FB: 150,
  \u00F9: 151,
  \u00FF: 152,
  \u00D6: 153,
  \u00DC: 154,
  \u00F8: 155,
  "\xA3": 156,
  \u00D8: 157,
  "\xD7": 158,
  \u0192: 159,
  \u00E1: 160,
  \u00ED: 161,
  \u00F3: 162,
  \u00FA: 163,
  \u00F1: 164,
  \u00D1: 165,
  \u00AA: 166,
  \u00BA: 167,
  "\xBF": 168,
  "\xAE": 169,
  "\xAC": 170,
  "\xBD": 171,
  "\xBC": 172,
  "\xA1": 173,
  "\xAB": 174,
  "\xBB": 175,
  \u00C1: 181,
  \u00C2: 182,
  \u00C0: 183,
  "\xA9": 184,
  \u00E3: 198,
  \u00C3: 199,
  \u00CA: 210,
  \u00CB: 211,
  \u00C8: 212,
  \u00CD: 214,
  \u00CE: 215,
  \u00CF: 216,
  \u00D3: 224,
  \u00DF: 225,
  \u00D4: 226,
  \u00D2: 227,
  \u00F5: 228,
  \u00D5: 229,
  \u00DA: 233,
  \u00DB: 234,
  \u00D9: 235,
  \u00FD: 236,
  \u00DD: 237,
  "\xB0": 248,
  "\u2022": 42,
  "\u2014": 45,
  "\u2013": 45,
  "\u2702": 45
};
function encodeCp850(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      bytes.push(code);
    } else if (ch === "\n" || ch === "\r") {
      bytes.push(code);
    } else if (CP850_MAP[ch] !== void 0) {
      bytes.push(CP850_MAP[ch]);
    } else {
      const normalized = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const fallback = normalized.charCodeAt(0);
      bytes.push(fallback >= 32 && fallback <= 126 ? fallback : 63);
    }
  }
  return Buffer.from(bytes);
}
function formatMoney(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}
function wrapText(text, width) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word.length > width ? word.slice(0, width) : word;
      if (word.length > width) {
        lines.push(current);
        current = word.slice(width);
      }
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
function lrLine(left, right, width) {
  const r = right.trim();
  const maxLeft = Math.max(1, width - r.length - 1);
  const l = left.trim().slice(0, maxLeft);
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(spaces)}${r}`;
}
function buildEscPosReceipt(receipt, store, options = {}) {
  const cols = options.widthMm === "58mm" ? 32 : 48;
  const isCrediario = receipt.paymentMethod === "Credi\xE1rio";
  const twoCopies = options.twoCopies !== void 0 ? options.twoCopies : isCrediario;
  const chunks = [];
  const pushRaw = (...bytes) => chunks.push(Buffer.from(bytes));
  const pushText = (line = "") => chunks.push(encodeCp850(`${line}
`));
  const ESC = 27;
  const GS = 29;
  const initPrinter = () => {
    pushRaw(ESC, 64);
    pushRaw(ESC, 116, 2);
  };
  const alignLeft = () => pushRaw(ESC, 97, 0);
  const alignCenter = () => pushRaw(ESC, 97, 1);
  const boldOn = () => pushRaw(ESC, 69, 1);
  const boldOff = () => pushRaw(ESC, 69, 0);
  const sizeNormal = () => pushRaw(GS, 33, 0);
  const sizeDouble = () => pushRaw(GS, 33, 17);
  const sizeDoubleHeight = () => pushRaw(GS, 33, 1);
  const cutPaper = () => {
    pushRaw(10, 10, 10, 10);
    pushRaw(GS, 86, 66, 3);
  };
  const sepDash = "-".repeat(cols);
  const sepEq = "=".repeat(cols);
  const renderVia = (viaLabel, requireSignature) => {
    initPrinter();
    alignCenter();
    boldOn();
    sizeDoubleHeight();
    for (const line of wrapText((store.nome_fantasia || "Mercadinho do Geleia").toUpperCase(), cols)) {
      pushText(line);
    }
    sizeNormal();
    boldOff();
    if (store.razao_social) {
      for (const line of wrapText(store.razao_social, cols)) pushText(line);
    }
    if (store.cnpj) pushText(`CNPJ: ${store.cnpj}`);
    if (store.inscricao_estadual) pushText(`IE: ${store.inscricao_estadual}`);
    if (store.nome_proprietario) pushText(`Prop.: ${store.nome_proprietario}`);
    if (store.telefone || store.whatsapp) {
      const tel = store.telefone || store.whatsapp || "";
      const extra = store.telefone && store.whatsapp && store.telefone !== store.whatsapp ? ` | WhatsApp: ${store.whatsapp}` : "";
      for (const line of wrapText(`Tel: ${tel}${extra}`, cols)) pushText(line);
    }
    if (store.endereco) {
      const addr = [
        store.endereco,
        store.numero ? `, ${store.numero}` : "",
        store.bairro ? ` - ${store.bairro}` : "",
        store.cidade ? `, ${store.cidade}` : "",
        store.uf ? `/${store.uf}` : ""
      ].join("");
      for (const line of wrapText(addr, cols)) pushText(line);
    }
    pushText("");
    boldOn();
    pushText(`[ ${viaLabel.toUpperCase()} ]`);
    boldOff();
    alignLeft();
    pushText(sepDash);
    pushText(lrLine("CUPOM NAO FISCAL:", receipt.cupom, cols));
    pushText(lrLine("DATA/HORA:", receipt.date, cols));
    pushText(lrLine("OPERADOR:", receipt.operator, cols));
    boldOn();
    pushText(lrLine("PAGAMENTO:", receipt.paymentMethod.toUpperCase(), cols));
    boldOff();
    pushText(sepDash);
    if (receipt.customer) {
      boldOn();
      for (const line of wrapText(`CLIENTE: ${receipt.customer.name.toUpperCase()}`, cols)) {
        pushText(line);
      }
      boldOff();
      if (receipt.customer.cpf) pushText(`CPF: ${receipt.customer.cpf}`);
      if (receipt.customer.phone) pushText(`FONE: ${receipt.customer.phone}`);
      if (isCrediario && receipt.customer.newDebt !== void 0) {
        boldOn();
        pushText(lrLine("SALDO CREDIARIO ATUAL:", formatMoney(receipt.customer.newDebt), cols));
        boldOff();
      }
      pushText(sepDash);
    }
    boldOn();
    pushText(lrLine("ITEM / QTD x UNIT", "TOTAL", cols));
    boldOff();
    pushText(sepDash);
    receipt.items.forEach((item, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const titleLines = wrapText(`${num}. ${item.name}`, cols);
      boldOn();
      for (const line of titleLines) pushText(line);
      boldOff();
      const leftDetail = `  ${item.quantity} ${item.unit || "un"} x ${formatMoney(item.unitPrice)}`;
      pushText(lrLine(leftDetail, formatMoney(item.subtotal), cols));
    });
    pushText(sepDash);
    pushText(lrLine("SUBTOTAL:", formatMoney(receipt.subtotal), cols));
    if (receipt.discount > 0) {
      pushText(lrLine("DESCONTO:", `- ${formatMoney(receipt.discount)}`, cols));
    }
    pushText(sepEq);
    boldOn();
    sizeDoubleHeight();
    pushText(lrLine("TOTAL:", formatMoney(receipt.total), cols));
    sizeNormal();
    boldOff();
    pushText(sepEq);
    if (receipt.paymentMethod === "Dinheiro" && receipt.cashReceived !== void 0 && receipt.cashReceived > 0) {
      pushText(lrLine("VALOR RECEBIDO:", formatMoney(receipt.cashReceived), cols));
      boldOn();
      pushText(lrLine("TROCO:", formatMoney(receipt.changeDue || 0), cols));
      boldOff();
      pushText(sepDash);
    }
    if (requireSignature) {
      pushText("");
      const msg = isCrediario ? "Reconheco e confesso a divida referente aos itens acima descritos para pagamento no crediario." : "Confirmo o recebimento das mercadorias descritas neste cupom.";
      alignCenter();
      for (const line of wrapText(msg, cols)) pushText(line);
      pushText("");
      pushText("");
      pushText("_".repeat(Math.min(36, cols - 4)));
      boldOn();
      pushText((receipt.customer?.name || "Assinatura do Cliente").toUpperCase().slice(0, cols));
      boldOff();
      if (receipt.customer?.cpf) pushText(`CPF: ${receipt.customer.cpf}`);
      alignLeft();
    } else {
      pushText("");
      alignCenter();
      const footer = store.mensagem_cupom || "Obrigado pela preferencia! Volte sempre.";
      for (const line of wrapText(footer, cols)) pushText(line);
      alignLeft();
    }
    cutPaper();
  };
  if (isCrediario) {
    renderVia("1a Via - Estabelecimento (Assinar)", true);
    if (twoCopies) {
      renderVia("2a Via - Cliente", false);
    }
  } else {
    renderVia("Cupom Nao Fiscal", false);
    if (twoCopies) {
      renderVia("2a Via - Cliente", false);
    }
  }
  return Buffer.concat(chunks);
}
async function listWindowsPrinters() {
  if (process.platform !== "win32") {
    return { supported: false, printers: [] };
  }
  const psScript = `
$ErrorActionPreference = 'Stop'
$defaultName = (Get-CimInstance Win32_Printer -Filter "Default = True" | Select-Object -First 1 -ExpandProperty Name)
$items = Get-Printer | ForEach-Object {
  [PSCustomObject]@{
    name = $_.Name
    driverName = $_.DriverName
    portName = $_.PortName
    status = ($_.PrinterStatus -join ', ')
    isDefault = ($_.Name -eq $defaultName)
  }
}
$items | ConvertTo-Json -Compress
`.trim();
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", psScript],
    { timeout: 8e3 }
  );
  const trimmed = stdout.trim();
  if (!trimmed) return { supported: true, printers: [] };
  const parsed = JSON.parse(trimmed);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return { supported: true, printers: list };
}
async function sendRawToWindowsPrinter(printerName, rawBuffer) {
  if (process.platform !== "win32") {
    throw new Error("Impress\xE3o direta Windows Spooler dispon\xEDvel apenas em servidor Windows.");
  }
  if (!printerName.trim()) {
    throw new Error("Nome da impressora n\xE3o configurado.");
  }
  const tmpFile = path2.join(
    os.tmpdir(),
    `geleia-escpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`
  );
  await fs2.writeFile(tmpFile, rawBuffer);
  const safePrinter = printerName.replace(/'/g, "''");
  const safePath = tmpFile.replace(/'/g, "''");
  const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOCINFOA {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static void SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      var di = new DOCINFOA { pDocName = "Cupom Mercadinho do Geleia", pDataType = "RAW" };
      if (!StartDocPrinter(hPrinter, 1, ref di)) {
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        }
        try {
          int written;
          if (!WritePrinter(hPrinter, bytes, bytes.Length, out written) || written != bytes.Length) {
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes('${safePath}')
[RawPrinterHelper]::SendBytesToPrinter('${safePrinter}', $bytes)
`.trim();
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", psScript],
      { timeout: 15e3 }
    );
  } finally {
    await fs2.unlink(tmpFile).catch(() => {
    });
  }
}

// server/routes/print.ts
var printRouter = Router6();
printRouter.get("/printers", requireAuth, async (_req, res) => {
  try {
    const result = await listWindowsPrinters();
    res.json(result);
  } catch (err) {
    res.json({
      supported: process.platform === "win32",
      printers: [],
      error: err.message
    });
  }
});
printRouter.post("/receipt", requireAuth, async (req, res) => {
  try {
    const { receipt, twoCopies = true, printerName: bodyPrinter, width: bodyWidth } = req.body;
    if (!receipt || !Array.isArray(receipt.items)) {
      res.status(400).json({ error: "Dados do cupom inv\xE1lidos." });
      return;
    }
    if (process.platform !== "win32") {
      res.status(200).json({
        ok: false,
        fallbackBrowser: true,
        error: "Impress\xE3o direta dispon\xEDvel apenas no servidor local Windows."
      });
      return;
    }
    const [cfgRes, companyRes] = await Promise.all([
      pool.query("SELECT nome_impressora, largura_bobina FROM configuracoes WHERE id = 1"),
      pool.query("SELECT * FROM dados_empresa WHERE id = 1")
    ]);
    const cfg = cfgRes.rows[0] ?? {};
    const store = companyRes.rows[0] ?? {};
    const targetPrinter = (bodyPrinter || cfg.nome_impressora || "VOX(U) 1").trim();
    const widthMm = (bodyWidth || cfg.largura_bobina) === "58mm" ? "58mm" : "80mm";
    const raw = buildEscPosReceipt(receipt, store, {
      twoCopies: Boolean(twoCopies),
      widthMm
    });
    await sendRawToWindowsPrinter(targetPrinter, raw);
    res.json({ ok: true, printerName: targetPrinter, widthMm });
  } catch (err) {
    res.status(200).json({
      ok: false,
      fallbackBrowser: true,
      error: err.message
    });
  }
});
printRouter.post("/test", requireAuth, async (req, res) => {
  try {
    if (process.platform !== "win32") {
      res.status(400).json({ error: "Impress\xE3o de teste direta dispon\xEDvel apenas no Windows." });
      return;
    }
    const { printerName: bodyPrinter, width: bodyWidth } = req.body ?? {};
    const [cfgRes, companyRes] = await Promise.all([
      pool.query("SELECT nome_impressora, largura_bobina FROM configuracoes WHERE id = 1"),
      pool.query("SELECT * FROM dados_empresa WHERE id = 1")
    ]);
    const cfg = cfgRes.rows[0] ?? {};
    const store = companyRes.rows[0] ?? {};
    const targetPrinter = (bodyPrinter || cfg.nome_impressora || "VOX(U) 1").trim();
    const widthMm = (bodyWidth || cfg.largura_bobina) === "58mm" ? "58mm" : "80mm";
    const nowStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short"
    }).format(/* @__PURE__ */ new Date());
    const testReceipt = {
      cupom: "TESTE-0001",
      date: nowStr,
      operator: req.user?.name || "Sistema",
      paymentMethod: "Dinheiro",
      items: [
        { name: "Teste de Impressao Termica", quantity: 1, unit: "un", unitPrice: 1, subtotal: 1 },
        { name: "Acentuacao: A E I O U C a e i o u c", quantity: 1, unit: "un", unitPrice: 0, subtotal: 0 }
      ],
      subtotal: 1,
      discount: 0,
      total: 1,
      cashReceived: 1,
      changeDue: 0
    };
    const raw = buildEscPosReceipt(testReceipt, store, {
      twoCopies: false,
      widthMm
    });
    await sendRawToWindowsPrinter(targetPrinter, raw);
    res.json({ ok: true, printerName: targetPrinter, widthMm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// server/routes/mercadopago.ts
import crypto2 from "node:crypto";
import { Router as Router7 } from "express";
var mercadopagoRouter = Router7();
var MP_API_BASE = "https://api.mercadopago.com";
async function getMpConfig() {
  const { rows } = await pool.query("SELECT mp_pix_ativo, mp_public_key, mp_access_token FROM configuracoes WHERE id = 1");
  const row = rows[0];
  return {
    active: Boolean(row?.mp_pix_ativo),
    publicKey: row?.mp_public_key || process.env.MP_PUBLIC_KEY || "",
    accessToken: row?.mp_access_token || process.env.MP_ACCESS_TOKEN || ""
  };
}
mercadopagoRouter.post("/pix", requireAuth, async (req, res) => {
  try {
    const { amount, description, payerEmail } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: "Valor inv\xE1lido para gerar QR Code PIX." });
      return;
    }
    const mp = await getMpConfig();
    if (!mp.active) {
      res.status(400).json({ error: "Integra\xE7\xE3o Mercado Pago (PIX) est\xE1 desativada nas Configura\xE7\xF5es." });
      return;
    }
    if (!mp.accessToken) {
      res.status(400).json({ error: "Access Token do Mercado Pago n\xE3o configurado." });
      return;
    }
    const expiration = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    const idempotencyKey = crypto2.randomUUID();
    const mpRes = await fetch(`${MP_API_BASE}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mp.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: Number(numericAmount.toFixed(2)),
        description: (description || "Venda PDV - Mercadinho e Lanchonete do Geleia").slice(0, 250),
        payment_method_id: "pix",
        date_of_expiration: expiration,
        payer: {
          email: payerEmail || "cliente@mercadinhodogeleia.com.br"
        }
      })
    });
    const data = await mpRes.json().catch(() => null);
    if (!mpRes.ok || !data) {
      const msg = data?.message || data?.cause?.[0]?.description || "Erro ao gerar cobran\xE7a PIX no Mercado Pago.";
      const safeStatus = mpRes.status === 401 || mpRes.status === 403 ? 400 : mpRes.status || 502;
      res.status(safeStatus).json({ error: `Mercado Pago: ${msg}` });
      return;
    }
    const txData = data.point_of_interaction?.transaction_data ?? {};
    const paymentId = String(data.id);
    const status = String(data.status || "pending");
    await pool.query(
      `INSERT INTO mp_pix_pagamentos (payment_id, status, status_detail, transaction_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (payment_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
      [paymentId, status, String(data.status_detail || ""), Number(numericAmount.toFixed(2))]
    );
    res.json({
      paymentId,
      status,
      qrCode: txData.qr_code || "",
      qrCodeBase64: txData.qr_code_base64 || "",
      ticketUrl: txData.ticket_url || "",
      expiresAt: data.date_of_expiration || expiration
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
mercadopagoRouter.get("/pix/:paymentId", requireAuth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!/^\d+$/.test(paymentId)) {
      res.status(400).json({ error: "ID de pagamento inv\xE1lido." });
      return;
    }
    const cached = await pool.query("SELECT * FROM mp_pix_pagamentos WHERE payment_id = $1", [paymentId]);
    if (cached.rows[0]?.status === "approved") {
      res.json({
        paymentId,
        status: "approved",
        statusDetail: cached.rows[0].status_detail || "accredited",
        transactionAmount: Number(cached.rows[0].transaction_amount || 0),
        dateApproved: cached.rows[0].date_approved
      });
      return;
    }
    const mp = await getMpConfig();
    if (!mp.accessToken) {
      res.status(400).json({ error: "Access Token do Mercado Pago n\xE3o configurado." });
      return;
    }
    const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mp.accessToken}`
      }
    });
    const data = await mpRes.json().catch(() => null);
    if (!mpRes.ok || !data) {
      const safeStatus = mpRes.status === 401 || mpRes.status === 403 ? 400 : mpRes.status || 502;
      res.status(safeStatus).json({
        error: `Mercado Pago: ${data?.message || "Erro ao consultar status do PIX no Mercado Pago."}`
      });
      return;
    }
    const status = String(data.status || "pending");
    const statusDetail = String(data.status_detail || "");
    const amount = Number(data.transaction_amount || 0);
    const dateApproved = data.date_approved || null;
    await pool.query(
      `INSERT INTO mp_pix_pagamentos (payment_id, status, status_detail, transaction_amount, date_approved)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (payment_id) DO UPDATE SET
         status = EXCLUDED.status,
         status_detail = EXCLUDED.status_detail,
         date_approved = COALESCE(EXCLUDED.date_approved, mp_pix_pagamentos.date_approved),
         updated_at = NOW()`,
      [paymentId, status, statusDetail, amount, dateApproved]
    );
    res.json({
      paymentId: String(data.id),
      status,
      statusDetail,
      transactionAmount: amount,
      dateApproved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
mercadopagoRouter.post("/webhook", async (req, res) => {
  try {
    const queryType = String(req.query.type || req.query.topic || "");
    const bodyType = String(req.body?.type || req.body?.topic || "");
    const eventType = queryType || bodyType;
    const rawId = req.body?.data?.id ?? req.query["data.id"] ?? req.query.id ?? (typeof req.body?.resource === "string" ? req.body.resource.split("/").pop() : "");
    const paymentId = String(rawId || "").trim();
    if ((!eventType || eventType === "payment") && /^\d+$/.test(paymentId)) {
      const mp = await getMpConfig();
      if (mp.accessToken) {
        const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${mp.accessToken}` }
        });
        const data = await mpRes.json().catch(() => null);
        if (mpRes.ok && data?.id) {
          await pool.query(
            `INSERT INTO mp_pix_pagamentos (payment_id, status, status_detail, transaction_amount, date_approved)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (payment_id) DO UPDATE SET
               status = EXCLUDED.status,
               status_detail = EXCLUDED.status_detail,
               date_approved = COALESCE(EXCLUDED.date_approved, mp_pix_pagamentos.date_approved),
               updated_at = NOW()`,
            [
              String(data.id),
              String(data.status || "pending"),
              String(data.status_detail || ""),
              Number(data.transaction_amount || 0),
              data.date_approved || null
            ]
          );
        }
      }
    }
    res.status(200).json({ received: true });
  } catch {
    res.status(200).json({ received: true });
  }
});
mercadopagoRouter.post("/test", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  try {
    const bodyToken = typeof req.body?.accessToken === "string" ? req.body.accessToken.trim() : "";
    const mp = await getMpConfig();
    const tokenToTest = bodyToken || mp.accessToken;
    if (!tokenToTest) {
      res.status(400).json({ ok: false, error: "Informe o Access Token de produ\xE7\xE3o." });
      return;
    }
    const mpRes = await fetch(`${MP_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${tokenToTest}`
      }
    });
    const data = await mpRes.json().catch(() => null);
    if (!mpRes.ok || !data) {
      res.status(400).json({
        ok: false,
        error: data?.message || "Access Token inv\xE1lido ou sem permiss\xE3o."
      });
      return;
    }
    res.json({
      ok: true,
      userId: data.id,
      nickname: data.nickname || "",
      email: data.email || "",
      siteId: data.site_id || "MLB"
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// server/index.ts
var app = express();
app.disable("x-powered-by");
app.use(securityHeaders);
var allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      const isVercel = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
      if (isLocal || isVercel || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origem n\xE3o permitida pelo CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
var payMethodFromDb = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  DEBITO: "D\xE9bito",
  CREDITO: "Cr\xE9dito",
  FIADO: "Credi\xE1rio"
};
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: safeErrorMessage(err, "Banco indispon\xEDvel.") });
  }
});
app.get("/api/bootstrap", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    const canManageUsers = req.user.role === "ADMIN" || req.user.role === "GERENTE";
    const [
      products,
      categories,
      customers,
      suppliers,
      movements,
      payables,
      shifts,
      users,
      sales,
      company
    ] = await Promise.all([
      pool.query(`
        SELECT
          p.id::text AS id,
          COALESCE(p.codigo_interno, 'PRD-' || p.id) AS sku,
          COALESCE(p.codigo_barras, p.codigo_interno, '') AS barcode,
          p.nome AS name,
          c.nome AS category,
          CASE p.unidade_medida
            WHEN 'UN' THEN 'un'
            WHEN 'KG' THEN 'kg'
            WHEN 'LT' THEN 'L'
            WHEN 'CX' THEN 'cx'
            ELSE 'un'
          END AS unit,
          p.preco_custo::float AS "costPrice",
          p.preco_venda::float AS "salePrice",
          p.estoque_atual::float AS stock,
          p.estoque_minimo::float AS "minStock",
          TO_CHAR(p.data_validade, 'YYYY-MM-DD') AS "expiryDate",
          'A' AS "abcClass",
          p.somente_admin AS "adminOnly"
        FROM produtos p
        JOIN categorias c ON c.id = p.categoria_id
        WHERE p.ativo = TRUE
          ${isAdmin ? "" : "AND p.somente_admin = FALSE"}
        ORDER BY p.id DESC
      `),
      pool.query(`
        SELECT
          c.id::text AS id,
          c.nome AS name,
          COALESCE(c.descricao, '') AS description,
          COUNT(p.id)::int AS "productCount",
          30::float AS "marginTarget"
        FROM categorias c
        LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = TRUE
        GROUP BY c.id
        ORDER BY c.id DESC
      `),
      pool.query(`
        SELECT
          id::text AS id,
          nome AS name,
          telefone_whatsapp AS phone,
          COALESCE(cpf, '') AS cpf,
          limite_credito::float AS "creditLimit",
          saldo_devedor::float AS "currentDebt",
          CASE status_credito
            WHEN 'EM_DIA' THEN 'Em dia'
            WHEN 'PROXIMO_VENCIMENTO' THEN 'Aten\xE7\xE3o'
            ELSE 'Bloqueado'
          END AS status,
          TO_CHAR(updated_at, 'DD/MM/YYYY') AS "lastPurchase"
        FROM clientes
        ORDER BY id DESC
      `),
      pool.query(`
        SELECT
          id::text AS id,
          nome_fantasia AS name,
          COALESCE(cnpj, '') AS cnpj,
          COALESCE(nome_vendedor, '') AS contact,
          telefone_whatsapp AS phone,
          COALESCE(categoria_fornecimento, 'Geral') AS category,
          COALESCE(prazo_entrega_dias, 2) AS "leadTimeDays"
        FROM fornecedores
        WHERE ativo = TRUE
        ORDER BY id DESC
      `),
      pool.query(`
        SELECT
          m.id::text AS id,
          TO_CHAR(m.created_at, 'DD/MM/YYYY HH24:MI') AS date,
          p.nome AS "productName",
          CASE m.tipo
            WHEN 'ENTRADA_COMPRA' THEN 'Entrada'
            WHEN 'SAIDA_VENDA' THEN 'Sa\xEDda'
            WHEN 'PERDA_AVARIA' THEN 'Perda / Avaria'
            WHEN 'VENCIMENTO' THEN 'Vencimento'
            ELSE 'Sa\xEDda'
          END AS type,
          m.quantidade::float AS quantity,
          COALESCE(m.numero_nota_fiscal || ' - ', '') || COALESCE(m.observacao, '') AS reason,
          u.nome AS operator
        FROM movimentacoes_estoque m
        JOIN produtos p ON p.id = m.produto_id
        JOIN usuarios u ON u.id = m.usuario_id
        ORDER BY m.id DESC
      `),
      pool.query(`
        SELECT
          cp.id::text AS id,
          cp.descricao AS description,
          COALESCE(f.nome_fantasia, 'Despesa Fixa') AS supplier,
          TO_CHAR(cp.data_vencimento, 'DD/MM/YYYY') AS "dueDate",
          cp.valor::float AS amount,
          CASE cp.status
            WHEN 'PAGO' THEN 'Pago'
            WHEN 'PENDENTE' THEN 'Pendente'
            ELSE 'Vencido'
          END AS status,
          cp.categoria::text AS category
        FROM contas_a_pagar cp
        LEFT JOIN fornecedores f ON f.id = cp.fornecedor_id
        ORDER BY cp.id DESC
      `),
      pool.query(`
        SELECT
          cx.id::text AS id,
          'Caixa 0' || cx.numero_pdv AS register,
          u.nome AS operator,
          TO_CHAR(cx.data_abertura AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "openedAt",
          TO_CHAR(cx.data_fechamento AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "closedAt",
          cx.valor_inicial::float AS "openingBalance",
          (cx.valor_sistema_dinheiro + cx.valor_sistema_digital)::float AS "totalSales",
          (cx.valor_inicial + cx.valor_sistema_dinheiro + cx.valor_sistema_digital)::float AS "expectedBalance",
          CASE cx.status WHEN 'ABERTO' THEN 'Aberto' ELSE 'Fechado' END AS status
        FROM caixas cx
        JOIN usuarios u ON u.id = cx.operador_id
        ORDER BY cx.id DESC
      `),
      canManageUsers ? pool.query(`
            SELECT
              id::text AS id,
              nome AS name,
              email_login AS email,
              CASE perfil
                WHEN 'ADMIN' THEN 'Administrador'
                WHEN 'GERENTE' THEN 'Gerente'
                ELSE 'Operador de Caixa'
              END AS role,
              CASE WHEN ativo THEN 'Ativo' ELSE 'Inativo' END AS status,
              COALESCE(TO_CHAR(ultimo_acesso, 'DD/MM/YYYY HH24:MI'), 'Recente') AS "lastAccess",
              '' AS pin,
              permissoes_json AS permissions,
              (bloqueado_ate IS NOT NULL AND bloqueado_ate > NOW()) AS "isBlocked",
              COALESCE(tentativas_login, 0) AS "failedAttempts",
              TO_CHAR(bloqueado_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "blockedUntil"
            FROM usuarios
            ORDER BY id DESC
          `) : Promise.resolve({ rows: [] }),
      pool.query(`
        SELECT
          v.id::text AS id,
          v.numero_cupom AS cupom,
          TO_CHAR(v.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS date,
          COALESCE(c.nome, 'Consumidor Final') AS customer,
          COALESCE((SELECT SUM(vi.quantidade)::int FROM venda_itens vi WHERE vi.venda_id = v.id), 1) AS "itemsCount",
          v.total::float AS total,
          v.forma_pagamento::text AS "paymentMethodRaw",
          CASE v.status WHEN 'CONCLUIDA' THEN 'Conclu\xEDda' ELSE 'Cancelada' END AS status,
          u.nome AS operator,
          auth.nome AS "authorizedBy",
          v.motivo_autorizacao AS "authorizationReason"
        FROM vendas v
        JOIN usuarios u ON u.id = v.operador_id
        LEFT JOIN usuarios auth ON auth.id = v.autorizado_por_id
        LEFT JOIN clientes c ON c.id = v.cliente_id
        ORDER BY v.id DESC
      `),
      pool.query("SELECT * FROM dados_empresa WHERE id = 1")
    ]);
    res.json({
      products: products.rows,
      categories: categories.rows,
      customers: customers.rows,
      suppliers: suppliers.rows,
      movements: movements.rows,
      payables: payables.rows,
      shifts: shifts.rows,
      users: users.rows,
      sales: sales.rows.map((s) => ({
        ...s,
        paymentMethod: payMethodFromDb[s.paymentMethodRaw] ?? "PIX"
      })),
      company: company.rows[0] ?? null
    });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
app.use("/api", authAndUsersRouter);
app.use("/api", catalogRouter);
app.use("/api", salesAndPdvRouter);
app.use("/api", partnersAndFinanceRouter);
app.use("/api", notificationsRouter);
app.use("/api/print", printRouter);
app.use("/api/mercadopago", mercadopagoRouter);
var port = Number(process.env.PORT ?? 3001);
var dbInitPromise = null;
function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}
if (!process.env.VERCEL) {
  ensureDbInitialized().then(() => {
    app.listen(port, () => {
      console.log(`API Mercadinho do Geleia rodando na porta ${port} (PostgreSQL conectado)`);
    });
  }).catch((err) => {
    console.error("Erro ao conectar/inicializar PostgreSQL:", err.message);
    process.exit(1);
  });
}
export {
  app,
  ensureDbInitialized
};
