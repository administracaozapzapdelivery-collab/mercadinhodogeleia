import { Router } from 'express';
import { pool } from '../db.ts';
import { logAudit } from '../utils/audit.ts';
import { parsePositiveId, requireAuth, requireRole, safeErrorMessage } from '../utils/security.ts';

export const partnersAndFinanceRouter = Router();

// Clientes CRUD + Fiado
partnersAndFinanceRouter.post('/customers', requireAuth, async (req, res) => {
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

partnersAndFinanceRouter.put('/customers/:id', requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const { name, phone, cpf, creditLimit, status, address, dueDay, notes } = req.body;
    const statusDb =
      status === 'Bloqueado'
        ? 'BLOQUEADO'
        : status === 'Atenção'
          ? 'PROXIMO_VENCIMENTO'
          : status === 'Em dia'
            ? 'EM_DIA'
            : null;
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
        updated_at = NOW()
       WHERE id = $9`,
      [
        name ?? null,
        cpf || null,
        phone ?? null,
        address ?? null,
        creditLimit ?? null,
        dueDay ?? null,
        statusDb,
        notes ?? null,
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

partnersAndFinanceRouter.delete('/customers/:id', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const existing = await pool.query<{ nome: string }>(
      'SELECT nome FROM clientes WHERE id = $1',
      [id]
    );
    const nome = (existing.rows[0]?.nome ?? '').trim().toLowerCase();
    if (nome === 'venda no balcão' || nome === 'vendas no balcão') {
      res.status(403).json({
        error: 'O cliente padrão "Venda no Balcão" não pode ser excluído.',
      });
      return;
    }
    await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch {
    res.status(409).json({
      error: 'Não é possível excluir cliente com vendas ou movimentações de crediário vinculadas.',
    });
  }
});

partnersAndFinanceRouter.get('/customers/:id/fiado', requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
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

partnersAndFinanceRouter.post('/customers/:id/fiado/pay', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const { amount, note } = req.body as { amount: number; note?: string };
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      res.status(400).json({ error: 'Valor de pagamento inválido.' });
      return;
    }

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO movimentacoes_fiado (cliente_id, usuario_id, tipo, valor, observacao)
       VALUES ($1, $2, 'PAGAMENTO_ABATE', $3, $4)`,
      [id, req.user!.id, val, note || 'Abatimento de fiado no balcão']
    );
    await client.query(
      `UPDATE clientes SET saldo_devedor = GREATEST(0, saldo_devedor - $1),
       status_credito = CASE WHEN saldo_devedor - $1 <= 0 THEN 'EM_DIA'::status_credito_enum ELSE status_credito END,
       updated_at = NOW() WHERE id = $2`,
      [val, id]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});

// Fornecedores CRUD (ADMIN/GERENTE)
partnersAndFinanceRouter.post('/suppliers', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
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

partnersAndFinanceRouter.put('/suppliers/:id', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
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
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

partnersAndFinanceRouter.delete('/suppliers/:id', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    try {
      await pool.query('DELETE FROM fornecedores WHERE id = $1', [id]);
    } catch {
      await pool.query('UPDATE fornecedores SET ativo = FALSE WHERE id = $1', [id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// Turnos de Caixa (Abertura exclusiva para ADMIN e Fechamento)
partnersAndFinanceRouter.post('/shifts/open', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { openingBalance, registerNumber, notes } = req.body;
    const inserted = await pool.query(
      `INSERT INTO caixas (numero_pdv, operador_id, valor_inicial, status, observacao_abertura)
       VALUES ($1, $2, $3, 'ABERTO', $4) RETURNING id`,
      [registerNumber || 1, req.user!.id, openingBalance ?? 200, notes ?? null]
    );
    res.status(201).json({ id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

partnersAndFinanceRouter.post('/shifts/:id/close', requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de turno inválido.' });
      return;
    }
    const { countedCash, notes } = req.body as { countedCash: number; notes?: string };
    const shiftRes = await pool.query<{ valor_inicial: string; valor_sistema_dinheiro: string }>(
      'SELECT valor_inicial, valor_sistema_dinheiro FROM caixas WHERE id = $1',
      [id]
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
      [Number(countedCash), diff, notes ?? null, id]
    );
    await logAudit(req.user!.id, 'FECHOU_CAIXA', 'caixas', id, { countedCash, diff });
    res.json({ ok: true, diff });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// Contas a Pagar CRUD + Baixa Rápida
function mapExpenseCategory(cat?: string) {
  const c = (cat ?? '').toLowerCase();
  if (c.includes('aluguel')) return 'ALUGUEL';
  if (c.includes('impost') || c.includes('taxa')) return 'IMPOSTOS';
  if (c.includes('manuten')) return 'MANUTENCAO';
  if (c.includes('energia') || c.includes('água') || c.includes('util')) return 'UTILIDADES';
  if (c.includes('folha') || c.includes('outr')) return 'OUTROS';
  return 'MERCADORIA';
}

partnersAndFinanceRouter.post('/payables', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const { description, supplier, category, dueDate, amount, status } = req.body;
    const isoDate = dueDate.includes('/') ? dueDate.split('/').reverse().join('-') : dueDate;
    const statusDb = status === 'Pago' ? 'PAGO' : status === 'Vencido' ? 'ATRASADO' : 'PENDENTE';
    let supplierId: number | null = null;
    if (supplier && !supplier.toLowerCase().includes('sem fornecedor')) {
      const supRes = await pool.query<{ id: number }>(
        'SELECT id FROM fornecedores WHERE nome_fantasia = $1 LIMIT 1',
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
        statusDb === 'PAGO' ? isoDate : null,
        statusDb,
      ]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

partnersAndFinanceRouter.put('/payables/:id', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const { description, supplier, category, dueDate, amount, status } = req.body;
    const isoDate = dueDate
      ? dueDate.includes('/')
        ? dueDate.split('/').reverse().join('-')
        : dueDate
      : null;
    const statusDb =
      status === 'Pago' ? 'PAGO' : status === 'Vencido' ? 'ATRASADO' : status === 'Pendente' ? 'PENDENTE' : null;
    let supplierId: number | null = null;
    if (supplier && !supplier.toLowerCase().includes('sem fornecedor')) {
      const supRes = await pool.query<{ id: number }>(
        'SELECT id FROM fornecedores WHERE nome_fantasia = $1 LIMIT 1',
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
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

partnersAndFinanceRouter.delete('/payables/:id', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    await pool.query('DELETE FROM contas_a_pagar WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

partnersAndFinanceRouter.post('/payables/:id/pay', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
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

// Relatório Curva ABC real de venda_itens
partnersAndFinanceRouter.get('/reports/abc', requireAuth, async (_req, res) => {
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
partnersAndFinanceRouter.get('/dashboard/summary', requireAuth, async (_req, res) => {
  try {
    const [salesToday, criticalStock, fiadoTotal, expiringSoon, cfgRow] = await Promise.all([
      pool.query<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(total), 0)::float AS total, COUNT(*)::int AS count
         FROM vendas
         WHERE status = 'CONCLUIDA'
           AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`
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
      pool.query<{ meta_diaria_faturamento: number }>(
        'SELECT meta_diaria_faturamento FROM configuracoes WHERE id = 1'
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
      metaDiaria: Number(cfgRow.rows[0]?.meta_diaria_faturamento ?? 5800),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
