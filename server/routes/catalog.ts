import { Router } from 'express';
import { pool } from '../db.ts';
import { logAudit } from '../utils/audit.ts';

export const catalogRouter = Router();

// Categorias CRUD
catalogRouter.post('/categories', async (req, res) => {
  try {
    const { name, description, colorHex, active } = req.body;
    const inserted = await pool.query(
      'INSERT INTO categorias (nome, cor_hex, descricao, ativo) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, colorHex || '#551BB3', description ?? '', active ?? true]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

catalogRouter.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, colorHex } = req.body;
    await pool.query(
      'UPDATE categorias SET nome = COALESCE($1, nome), descricao = COALESCE($2, descricao), cor_hex = COALESCE($3, cor_hex) WHERE id = $4',
      [name ?? null, description ?? null, colorHex ?? null, Number(id)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

catalogRouter.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categorias WHERE id = $1', [Number(id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'Não é possível excluir categoria com produtos vinculados.' });
  }
});

// Produtos CRUD + Alerta de Validade + Busca PDV
catalogRouter.get('/products/expiring', async (_req, res) => {
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
    res.status(500).json({ error: (err as Error).message });
  }
});

catalogRouter.post('/products', async (req, res) => {
  try {
    const { sku, barcode, name, category, unit, costPrice, salePrice, stock, minStock, expiryDate, photoUrl, adminOnly } = req.body;
    const catRes = await pool.query<{ id: number }>('SELECT id FROM categorias WHERE nome = $1 LIMIT 1', [category]);
    const catId = catRes.rows[0]?.id ?? 1;
    const unitDb = unit === 'kg' ? 'KG' : unit === 'L' ? 'LT' : unit === 'cx' ? 'CX' : 'UN';

    const inserted = await pool.query(
      `INSERT INTO produtos (categoria_id, codigo_barras, codigo_interno, nome, foto_url, unidade_medida, preco_custo, preco_venda, estoque_atual, estoque_minimo, data_validade, somente_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [catId, barcode || null, sku || null, name, photoUrl || null, unitDb, costPrice ?? 0, salePrice, stock ?? 0, minStock ?? 5, expiryDate || null, !!adminOnly]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

catalogRouter.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, salePrice, costPrice, minStock, stock, expiryDate } = req.body;
    await pool.query(
      `UPDATE produtos SET
        nome = COALESCE($1, nome),
        preco_venda = COALESCE($2, preco_venda),
        preco_custo = COALESCE($3, preco_custo),
        estoque_minimo = COALESCE($4, estoque_minimo),
        estoque_atual = COALESCE($5, estoque_atual),
        data_validade = COALESCE($6, data_validade),
        updated_at = NOW()
       WHERE id = $7`,
      [name ?? null, salePrice ?? null, costPrice ?? null, minStock ?? null, stock ?? null, expiryDate ?? null, Number(id)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

catalogRouter.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE produtos SET ativo = FALSE WHERE id = $1', [Number(id)]);
    await logAudit(null, 'EXCLUIU_PRODUTO', 'produtos', Number(id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Movimentações de Estoque (com recálculo de custo médio em ENTRADA_COMPRA)
catalogRouter.post('/movements', async (req, res) => {
  const client = await pool.connect();
  try {
    const { productName, type, quantity, reason, costUnit, invoiceNumber, userId } = req.body;
    await client.query('BEGIN');

    const prodRes = await client.query<{ id: number; estoque_atual: string; preco_custo: string }>(
      'SELECT id, estoque_atual, preco_custo FROM produtos WHERE nome = $1 LIMIT 1',
      [productName]
    );
    const prod = prodRes.rows[0];
    if (!prod) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    const tipoDb =
      type === 'Entrada'
        ? 'ENTRADA_COMPRA'
        : type === 'Vencimento'
        ? 'VENCIMENTO'
        : type === 'Perda / Avaria'
        ? 'PERDA_AVARIA'
        : 'AJUSTE_INVENTARIO';

    const qtyNum = Number(quantity);
    await client.query(
      `INSERT INTO movimentacoes_estoque (produto_id, usuario_id, tipo, quantidade, custo_unitario, numero_nota_fiscal, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [prod.id, Number(userId) || 1, tipoDb, qtyNum, costUnit ?? prod.preco_custo, invoiceNumber ?? null, reason ?? '']
    );

    const cfg = await client.query<{ recalcular_custo_medio: boolean }>(
      'SELECT recalcular_custo_medio FROM configuracoes WHERE id = 1'
    );

    if (tipoDb === 'ENTRADA_COMPRA' && cfg.rows[0]?.recalcular_custo_medio && costUnit) {
      const oldStock = Math.max(0, Number(prod.estoque_atual));
      const oldCost = Number(prod.preco_custo);
      const newStock = oldStock + Math.abs(qtyNum);
      const avgCost = newStock > 0 ? (oldStock * oldCost + Math.abs(qtyNum) * Number(costUnit)) / newStock : Number(costUnit);
      await client.query(
        'UPDATE produtos SET estoque_atual = estoque_atual + $1, preco_custo = $2, updated_at = NOW() WHERE id = $3',
        [qtyNum, avgCost.toFixed(2), prod.id]
      );
    } else {
      await client.query(
        'UPDATE produtos SET estoque_atual = estoque_atual + $1, updated_at = NOW() WHERE id = $2',
        [qtyNum, prod.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(req.body);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});
