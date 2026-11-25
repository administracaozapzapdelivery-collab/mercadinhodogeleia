import express from 'express';
import cors from 'cors';
import { pool } from './db.ts';
import { initDatabase } from './schema.ts';
import { authAndUsersRouter } from './routes/authAndUsers.ts';
import { catalogRouter } from './routes/catalog.ts';
import { salesAndPdvRouter } from './routes/salesAndPdv.ts';
import { partnersAndFinanceRouter } from './routes/partnersAndFinance.ts';
import { notificationsRouter } from './routes/notifications.ts';

export const app = express();
app.use(cors());
app.use(express.json());

const payMethodFromDb: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  FIADO: 'Crediário',
};

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.get('/api/bootstrap', async (req, res) => {
  try {
    const isAdmin = String(req.query.role ?? '').toUpperCase() === 'ADMIN';
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
      company,
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
          ${isAdmin ? '' : 'AND p.somente_admin = FALSE'}
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
            WHEN 'PROXIMO_VENCIMENTO' THEN 'Atenção'
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
            WHEN 'SAIDA_VENDA' THEN 'Saída'
            WHEN 'PERDA_AVARIA' THEN 'Perda / Avaria'
            WHEN 'VENCIMENTO' THEN 'Vencimento'
            ELSE 'Saída'
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
          TO_CHAR(cx.data_abertura, 'DD/MM/YYYY HH24:MI') AS "openedAt",
          TO_CHAR(cx.data_fechamento, 'DD/MM/YYYY HH24:MI') AS "closedAt",
          cx.valor_inicial::float AS "openingBalance",
          (cx.valor_sistema_dinheiro + cx.valor_sistema_digital)::float AS "totalSales",
          (cx.valor_inicial + cx.valor_sistema_dinheiro + cx.valor_sistema_digital)::float AS "expectedBalance",
          CASE cx.status WHEN 'ABERTO' THEN 'Aberto' ELSE 'Fechado' END AS status
        FROM caixas cx
        JOIN usuarios u ON u.id = cx.operador_id
        ORDER BY cx.id DESC
      `),
      pool.query(`
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
          COALESCE(pin_rapido, '') AS pin,
          permissoes_json AS permissions
        FROM usuarios
        ORDER BY id DESC
      `),
      pool.query(`
        SELECT
          v.id::text AS id,
          v.numero_cupom AS cupom,
          TO_CHAR(v.created_at, 'DD/MM/YYYY HH24:MI') AS date,
          COALESCE(c.nome, 'Consumidor Final') AS customer,
          COALESCE((SELECT SUM(vi.quantidade)::int FROM venda_itens vi WHERE vi.venda_id = v.id), 1) AS "itemsCount",
          v.total::float AS total,
          v.forma_pagamento::text AS "paymentMethodRaw",
          CASE v.status WHEN 'CONCLUIDA' THEN 'Concluída' ELSE 'Cancelada' END AS status,
          u.nome AS operator,
          auth.nome AS "authorizedBy",
          v.motivo_autorizacao AS "authorizationReason"
        FROM vendas v
        JOIN usuarios u ON u.id = v.operador_id
        LEFT JOIN usuarios auth ON auth.id = v.autorizado_por_id
        LEFT JOIN clientes c ON c.id = v.cliente_id
        ORDER BY v.id DESC
      `),
      pool.query('SELECT * FROM dados_empresa WHERE id = 1'),
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
        paymentMethod: payMethodFromDb[s.paymentMethodRaw] ?? 'PIX',
      })),
      company: company.rows[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.use('/api', authAndUsersRouter);
app.use('/api', catalogRouter);
app.use('/api', salesAndPdvRouter);
app.use('/api', partnersAndFinanceRouter);
app.use('/api', notificationsRouter);

const port = Number(process.env.PORT ?? 3001);

let dbInitPromise: Promise<void> | null = null;
export function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase();
  }
  return dbInitPromise;
}

if (!process.env.VERCEL) {
  ensureDbInitialized()
    .then(() => {
      app.listen(port, () => {
        console.log(`API Mercadinho do Geleia rodando na porta ${port} (PostgreSQL conectado)`);
      });
    })
    .catch((err) => {
      console.error('Erro ao conectar/inicializar PostgreSQL:', err.message);
      process.exit(1);
    });
}
