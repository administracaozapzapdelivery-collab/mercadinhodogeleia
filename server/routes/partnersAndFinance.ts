import { Router } from 'express';
import { pool } from '../db.ts';
import { logAudit } from '../utils/audit.ts';

export const partnersAndFinanceRouter = Router();

// Clientes CRUD + Fiado
partnersAndFinanceRouter.post('/customers', async (req, res) => {
  try {
    const { name, phone, cpf, creditLimit, status, address, dueDay, notes } = req.body;
    const statusDb = status === 'Bloqueado' ? 'BLOQUEADO' : status === 'Atenção' ? 'PROXIMO_VENCIMENTO' : 'EM_DIA';
    const inserted = await pool.query(
      `INSERT INTO clientes (nome, cpf, telefone_whatsapp, endereco, limite_credito, dia_vencimento_preferencial, status_credito, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, cpf || null, phone, address ?? null, creditLimit ?? 200, dueDay ?? 10, statusDb, notes ?? null]
    );
    const newId = String(inserted.rows[0].id);
    // Retorna objeto com ID real do banco (nunca o id fake do frontend)
    res.status(201).json({
      id: newId,
      name: name ?? '',
      phone: phone ?? '',
      cpf: cpf ?? '',
      creditLimit: Number(creditLimit ?? 200),
      currentDebt: 0,
      status: 'Em dia',
      lastPurchase: 'Hoje',
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

partnersAndFinanceRouter.get('/customers/:id/fiado', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id::text AS id, tipo::text AS type, valor::float AS amount,
       COALESCE(observacao, '') AS note, TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') AS date
       FROM movimentacoes_fiado WHERE cliente_id = $1 ORDER BY id DESC`,
      [Number(id)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

partnersAndFinanceRouter.post('/customers/:id/fiado/pay', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { amount, note, userId } = req.body as { amount: number; note?: string; userId?: number };
    const val = Number(amount);
    if (!val || val <= 0) {
      res.status(400).json({ error: 'Valor de pagamento inválido.' });
      return;
    }

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO movimentacoes_fiado (cliente_id, usuario_id, tipo, valor, observacao)
       VALUES ($1, $2, 'PAGAMENTO_ABATE', $3, $4)`,
      [Number(id), userId || 1, val, note || 'Abatimento de fiado no balcão']
    );
    await client.query(
      `UPDATE clientes SET saldo_devedor = GREATEST(0, saldo_devedor - $1),
       status_credito = CASE WHEN saldo_devedor - $1 <= 0 THEN 'EM_DIA'::status_credito_enum ELSE status_credito END,
       updated_at = NOW() WHERE id = $2`,
      [val, Number(id)]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// Fornecedores CRUD
partnersAndFinanceRouter.post('/suppliers', async (req, res) => {
  try {
    const { name, cnpj, contact, phone, category, leadTimeDays, email } = req.body;
    const inserted = await pool.query(
      `INSERT INTO fornecedores (razao_social, nome_fantasia, cnpj, telefone_whatsapp, email, nome_vendedor, categoria_fornecimento, prazo_entrega_dias)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, name, cnpj || null, phone, email || null, contact ?? '', category ?? 'Geral', leadTimeDays ?? 2]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Turnos de Caixa (Abertura e Fechamento)
partnersAndFinanceRouter.post('/shifts/open', async (req, res) => {
  try {
    const { openingBalance, operatorId, registerNumber, notes } = req.body;
    const inserted = await pool.query(
      `INSERT INTO caixas (numero_pdv, operador_id, valor_inicial, status, observacao_abertura)
       VALUES ($1, $2, $3, 'ABERTO', $4) RETURNING id`,
      [registerNumber || 1, operatorId || 1, openingBalance ?? 200, notes ?? null]
    );
    res.status(201).json({ id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

partnersAndFinanceRouter.post('/shifts/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { countedCash, notes } = req.body as { countedCash: number; notes?: string };
    const shiftRes = await pool.query<{ valor_inicial: string; valor_sistema_dinheiro: string }>(
      'SELECT valor_inicial, valor_sistema_dinheiro FROM caixas WHERE id = $1',
      [Number(id)]
    );
    const sh = shiftRes.rows[0];
    if (!sh) {
      res.status(404).json({ error: 'Turno não encontrado.' });
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
      [Number(countedCash), diff, notes ?? null, Number(id)]
    );
    await logAudit(null, 'FECHOU_CAIXA', 'caixas', Number(id), { countedCash, diff });
    res.json({ ok: true, diff });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Contas a Pagar CRUD + Baixa Rápida
partnersAndFinanceRouter.post('/payables', async (req, res) => {
  try {
    const { description, dueDate, amount, status } = req.body;
    const isoDate = dueDate.includes('/') ? dueDate.split('/').reverse().join('-') : dueDate;
    const statusDb = status === 'Pago' ? 'PAGO' : status === 'Vencido' ? 'ATRASADO' : 'PENDENTE';
    const inserted = await pool.query(
      `INSERT INTO contas_a_pagar (descricao, categoria, valor, data_vencimento, status)
       VALUES ($1, 'MERCADORIA', $2, $3, $4) RETURNING id`,
      [description, amount, isoDate, statusDb]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

partnersAndFinanceRouter.post('/payables/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE contas_a_pagar SET status = 'PAGO', data_pagamento = CURRENT_DATE WHERE id = $1",
      [Number(id)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Relatório Curva ABC real de venda_itens
partnersAndFinanceRouter.get('/reports/abc', async (_req, res) => {
  try {
    const result = await pool.query<{
      productId: string;
      name: string;
      category: string;
      qtySold: number;
      revenue: number;
      grossProfit: number;
    }>(`
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
      const sharePct = (row.revenue / totalRevenue) * 100;
      cumulative += sharePct;
      const abcClass = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
      return { ...row, sharePct, cumulativePct: cumulative, abcClass };
    });

    res.json({ totalRevenue, items: abc });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Resumo agregado do Dashboard
partnersAndFinanceRouter.get('/dashboard/summary', async (_req, res) => {
  try {
    const [salesToday, criticalStock, fiadoTotal, expiringSoon] = await Promise.all([
      pool.query<{ total: number; count: number }>(
        "SELECT COALESCE(SUM(total), 0)::float AS total, COUNT(*)::int AS count FROM vendas WHERE status = 'CONCLUIDA'"
      ),
      pool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM produtos WHERE ativo = TRUE AND estoque_atual <= estoque_minimo'
      ),
      pool.query<{ total: number; count: number }>(
        'SELECT COALESCE(SUM(saldo_devedor), 0)::float AS total, COUNT(*)::int AS count FROM clientes WHERE saldo_devedor > 0'
      ),
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM produtos p CROSS JOIN configuracoes cfg
         WHERE cfg.id = 1 AND p.ativo = TRUE AND p.data_validade IS NOT NULL
         AND p.data_validade <= CURRENT_DATE + (cfg.dias_alerta_validade || ' days')::INTERVAL`
      ),
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
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
