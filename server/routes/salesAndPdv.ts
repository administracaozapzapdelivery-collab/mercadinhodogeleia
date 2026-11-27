import { Router } from 'express';
import { pool } from '../db.ts';
import { logAudit } from '../utils/audit.ts';
import {
  createRateLimiter,
  parsePositiveId,
  requireAuth,
  safeErrorMessage,
} from '../utils/security.ts';

export const salesAndPdvRouter = Router();

const pinRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Muitas tentativas de PIN. Aguarde alguns minutos.',
  keyPrefix: 'pin',
});

const payMethodToDb: Record<string, string> = {
  Dinheiro: 'DINHEIRO',
  PIX: 'PIX',
  'Débito': 'DEBITO',
  'Crédito': 'CREDITO',
  'Crediário': 'FIADO',
  Fiado: 'FIADO',
};

// Finalizar Venda no PDV (Transação Atômica)
salesAndPdvRouter.post('/sales', requireAuth, async (req, res, next) => {
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
      authorizerPin,
    } = req.body as {
      cupom: string;
      paymentMethod: string;
      customerId?: string;
      authorizerPin?: string;
      items: { productId: string; quantity: number; salePrice?: number }[];
      discount?: number;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Carrinho vazio.' });
      return;
    }

    const parsedDiscount = Number(discount ?? 0);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
      res.status(400).json({ error: 'Desconto inválido.' });
      return;
    }

    await client.query('BEGIN');

    // 1. Verificar configuração e caixa aberto
    const cfgRes = await client.query<{
      exigir_abertura_caixa: boolean;
      bloquear_fiado_acima_limite: boolean;
      exigir_pin_desconto_cancelamento: boolean;
      desconto_max_sem_pin: string;
    }>(
      'SELECT exigir_abertura_caixa, bloquear_fiado_acima_limite, exigir_pin_desconto_cancelamento, desconto_max_sem_pin FROM configuracoes WHERE id = 1'
    );
    const cfg = cfgRes.rows[0];

    const openShiftRes = await client.query<{ id: number }>(
      `SELECT id FROM caixas
       WHERE status = 'ABERTO'
         AND (data_abertura AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
       ORDER BY id DESC LIMIT 1`
    );
    const caixaId = openShiftRes.rows[0]?.id;

    if (!caixaId) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Nenhum caixa do dia aberto. Abra o caixa de hoje antes de realizar vendas.' });
      return;
    }

    const activeCaixaId = caixaId;
    const activeOpId = req.user!.id;
    const formaDb = payMethodToDb[paymentMethod] ?? 'PIX';

    let subtotal = 0;
    const resolvedItems: {
      produtoId: number;
      quantidade: number;
      precoUnitario: number;
      custoUnitario: number;
      subtotal: number;
    }[] = [];

    for (const item of items) {
      const prodId = Number(item.productId);
      const qty = Number(item.quantity);
      if (!Number.isInteger(prodId) || prodId <= 0 || !Number.isFinite(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Item ou quantidade inválida no carrinho.' });
        return;
      }

      const prodRes = await client.query<{ id: number; preco_venda: string; preco_custo: string }>(
        'SELECT id, preco_venda, preco_custo FROM produtos WHERE id = $1 AND ativo = TRUE LIMIT 1',
        [prodId]
      );
      const prod = prodRes.rows[0];
      if (!prod) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: `Produto #${prodId} não encontrado ou inativo.` });
        return;
      }
      // Segurança: usa exclusivamente o preço de venda cadastrado no banco
      const preco = Number(prod.preco_venda);
      const custo = Number(prod.preco_custo);
      const itemSub = preco * qty;
      subtotal += itemSub;
      resolvedItems.push({
        produtoId: prod.id,
        quantidade: qty,
        precoUnitario: preco,
        custoUnitario: custo,
        subtotal: itemSub,
      });
    }

    if (parsedDiscount > subtotal) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Desconto não pode ser maior que o subtotal da venda.' });
      return;
    }

    const discountPct = subtotal > 0 ? (parsedDiscount / subtotal) * 100 : 0;
    const maxDiscountPct = Number(cfg?.desconto_max_sem_pin ?? 5);
    if (
      cfg?.exigir_pin_desconto_cancelamento &&
      discountPct > maxDiscountPct &&
      req.user!.role === 'OPERADOR'
    ) {
      const pinTrimmed = String(authorizerPin ?? '').trim();
      if (!pinTrimmed) {
        await client.query('ROLLBACK');
        res.status(403).json({
          error: `Desconto acima de ${maxDiscountPct}% exige PIN de Gerente ou Administrador.`,
          requiresPin: true,
        });
        return;
      }
      const authDiscountRes = await client.query<{ id: number }>(
        `SELECT id FROM usuarios WHERE pin_rapido = $1 AND ativo = TRUE AND perfil IN ('ADMIN', 'GERENTE') LIMIT 1`,
        [pinTrimmed]
      );
      if (authDiscountRes.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(403).json({ error: 'PIN inválido para autorizar desconto.', requiresPin: true });
        return;
      }
    }

    const total = Math.max(0, subtotal - parsedDiscount);

    // Validar limite de crediário e autorização por PIN se pagamento for FIADO
    let parsedCustomerId = customerId ? Number(customerId) : null;
    let authorizedByUser: { id: number; nome: string } | null = null;
    let authorizationReason: string | null = null;

    if (!parsedCustomerId && formaDb !== 'FIADO') {
      const balcaoRes = await client.query<{ id: number }>(
        `SELECT id FROM clientes WHERE LOWER(nome) = 'venda no balcão' LIMIT 1`
      );
      if (balcaoRes.rows[0]?.id) {
        parsedCustomerId = balcaoRes.rows[0].id;
      } else {
        const insertedBalcao = await client.query<{ id: number }>(
          `INSERT INTO clientes (nome, telefone_whatsapp, limite_credito, saldo_devedor, status_credito)
           VALUES ('Venda no Balcão', '', 0.00, 0.00, 'EM_DIA') RETURNING id`
        );
        parsedCustomerId = insertedBalcao.rows[0].id;
      }
    }

    if (formaDb === 'FIADO') {
      if (!parsedCustomerId) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Selecione um cliente cadastrado para venda no Crediário.' });
        return;
      }
      const cliRes = await client.query<{
        nome: string;
        limite_credito: string;
        saldo_devedor: string;
        status_credito: string;
      }>(
        'SELECT nome, limite_credito, saldo_devedor, status_credito FROM clientes WHERE id = $1',
        [parsedCustomerId]
      );
      const cli = cliRes.rows[0];
      if (!cli) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Cliente de Crediário não encontrado.' });
        return;
      }
      const cliNomeNorm = cli.nome.trim().toLowerCase();
      if (cliNomeNorm === 'venda no balcão' || cliNomeNorm === 'vendas no balcão') {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'O cliente "Venda no Balcão" não pode ser utilizado em vendas no Crediário.' });
        return;
      }

      const saldoAtual = Number(cli.saldo_devedor);
      const limiteAtual = Number(cli.limite_credito);
      const limiteDisponivel = limiteAtual - saldoAtual;
      const isBlocked = cli.status_credito === 'BLOQUEADO';
      const isLimitLowOrExceeded = limiteDisponivel < total || limiteDisponivel <= 0;

      if (isBlocked || isLimitLowOrExceeded) {
        const reason = isBlocked
          ? 'Cliente bloqueado no Crediário'
          : limiteDisponivel <= 0
            ? 'Cliente com limite negativo ou zerado'
            : 'Limite de crédito insuficiente para esta venda';

        const pinTrimmed = String(authorizerPin ?? '').trim();
        if (!pinTrimmed) {
          await client.query('ROLLBACK');
          res.status(403).json({
            error: `${reason}. Informe o PIN de um Gerente ou Administrador para autorizar.`,
            requiresPin: true,
            reason,
          });
          return;
        }

        const authRes = await client.query<{ id: number; nome: string }>(
          `SELECT id, nome FROM usuarios
           WHERE pin_rapido = $1 AND ativo = TRUE AND perfil IN ('ADMIN', 'GERENTE')
           LIMIT 1`,
          [pinTrimmed]
        );
        if (authRes.rowCount === 0) {
          await client.query('ROLLBACK');
          res.status(403).json({
            error: 'PIN inválido ou usuário sem permissão de Gerente/Administrador.',
            requiresPin: true,
            reason,
          });
          return;
        }

        authorizedByUser = authRes.rows[0];
        authorizationReason = reason;
      }
    }

    // a) Inserir venda
    const saleRes = await client.query<{ id: number }>(
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
        authorizationReason,
      ]
    );
    const vendaId = saleRes.rows[0].id;

    // b) e c) Inserir venda_itens, subtrair estoque e registrar movimentacoes_estoque
    for (const ri of resolvedItems) {
      await client.query(
        `INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, custo_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [vendaId, ri.produtoId, ri.quantidade, ri.precoUnitario, ri.custoUnitario, ri.subtotal]
      );

      await client.query(
        'UPDATE produtos SET estoque_atual = estoque_atual - $1, updated_at = NOW() WHERE id = $2',
        [ri.quantidade, ri.produtoId]
      );

      await client.query(
        `INSERT INTO movimentacoes_estoque (produto_id, usuario_id, tipo, quantidade, custo_unitario, observacao)
         VALUES ($1, $2, 'SAIDA_VENDA', $3, $4, $5)`,
        [ri.produtoId, activeOpId, -ri.quantidade, ri.custoUnitario, `Venda PDV ${cupom}`]
      );
    }

    // d) Somar saldo no caixa
    if (formaDb === 'DINHEIRO') {
      await client.query(
        'UPDATE caixas SET valor_sistema_dinheiro = valor_sistema_dinheiro + $1 WHERE id = $2',
        [total, activeCaixaId]
      );
    } else if (formaDb !== 'FIADO') {
      await client.query(
        'UPDATE caixas SET valor_sistema_digital = valor_sistema_digital + $1 WHERE id = $2',
        [total, activeCaixaId]
      );
    }

    // e) Se FIADO, somar saldo_devedor e registrar em movimentacoes_fiado
    if (formaDb === 'FIADO' && parsedCustomerId) {
      await client.query(
        'UPDATE clientes SET saldo_devedor = saldo_devedor + $1, updated_at = NOW() WHERE id = $2',
        [total, parsedCustomerId]
      );
      const obsFiado = authorizedByUser
        ? `Cupom ${cupom} • Autorizado por ${authorizedByUser.nome} (${authorizationReason})`
        : `Cupom ${cupom}`;
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
            total,
          }),
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      id: String(vendaId),
      cupom,
      total,
      authorizedBy: authorizedByUser?.nome ?? null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// Listar itens de uma venda (Modal "Ver")
salesAndPdvRouter.get('/sales/:id/items', requireAuth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de venda inválido.' });
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

// Cancelar Venda (valida PIN ADMIN, estorna estoque e caixa, grava auditoria)
salesAndPdvRouter.post('/sales/:id/cancel', requireAuth, pinRateLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de venda inválido.' });
      return;
    }
    const { adminPin } = req.body as { adminPin?: string };

    const cfgRes = await client.query<{ exigir_pin_desconto_cancelamento: boolean }>(
      'SELECT exigir_pin_desconto_cancelamento FROM configuracoes WHERE id = 1'
    );

    let adminId: number | null = null;
    if (cfgRes.rows[0]?.exigir_pin_desconto_cancelamento) {
      const adminRes = await client.query<{ id: number }>(
        "SELECT id FROM usuarios WHERE perfil = 'ADMIN' AND pin_rapido = $1 AND ativo = TRUE LIMIT 1",
        [adminPin ?? '']
      );
      if (!adminRes.rows[0]) {
        res.status(403).json({ error: 'PIN de Administrador inválido para cancelamento.' });
        return;
      }
      adminId = adminRes.rows[0].id;
    }

    await client.query('BEGIN');

    const saleRes = await client.query<{
      id: number;
      numero_cupom: string;
      caixa_id: number;
      forma_pagamento: string;
      total: string;
      status: string;
    }>('SELECT id, numero_cupom, caixa_id, forma_pagamento, total, status FROM vendas WHERE id = $1', [id]);

    const sale = saleRes.rows[0];
    if (!sale || sale.status === 'CANCELADA') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Venda não encontrada ou já cancelada.' });
      return;
    }

    await client.query("UPDATE vendas SET status = 'CANCELADA' WHERE id = $1", [sale.id]);

    const itemsRes = await client.query<{ produto_id: number; quantidade: string }>(
      'SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = $1',
      [sale.id]
    );
    for (const item of itemsRes.rows) {
      await client.query('UPDATE produtos SET estoque_atual = estoque_atual + $1 WHERE id = $2', [
        Number(item.quantidade),
        item.produto_id,
      ]);
    }

    const total = Number(sale.total);
    if (sale.forma_pagamento === 'DINHEIRO') {
      await client.query(
        'UPDATE caixas SET valor_sistema_dinheiro = GREATEST(0, valor_sistema_dinheiro - $1) WHERE id = $2',
        [total, sale.caixa_id]
      );
    } else if (sale.forma_pagamento !== 'FIADO') {
      await client.query(
        'UPDATE caixas SET valor_sistema_digital = GREATEST(0, valor_sistema_digital - $1) WHERE id = $2',
        [total, sale.caixa_id]
      );
    }

    await client.query('COMMIT');
    await logAudit(adminId, 'CANCELOU_VENDA', 'vendas', sale.id, { cupom: sale.numero_cupom, total });
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// Comandas / Pedidos em Aberto (Espetinhos, Jantinha e consumo no local)
salesAndPdvRouter.get('/comandas', requireAuth, async (_req, res) => {
  try {
    const comandasRes = await pool.query<{
      id: number;
      identificador: string;
      observacao: string | null;
      status: string;
      cadastrada: boolean;
      created_at: string;
      updated_at: string;
      operador: string | null;
    }>(
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
    const itensRes = await pool.query<{
      comanda_id: number;
      produto_id: number;
      product_name: string;
      unit: string;
      quantidade: string;
      preco_unitario: string;
    }>(
      `SELECT ci.comanda_id, ci.produto_id, p.nome AS product_name,
              LOWER(p.unidade_medida::text) AS unit,
              ci.quantidade, ci.preco_unitario
       FROM comanda_itens ci
       JOIN produtos p ON p.id = ci.produto_id
       WHERE ci.comanda_id = ANY($1::int[])
       ORDER BY ci.id ASC`,
      [ids]
    );

    const itemsByComanda = new Map<number, Array<{
      productId: string;
      productName: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>>();

    for (const row of itensRes.rows) {
      const qty = Number(row.quantidade);
      const price = Number(row.preco_unitario);
      const list = itemsByComanda.get(row.comanda_id) ?? [];
      list.push({
        productId: String(row.produto_id),
        productName: row.product_name,
        unit: row.unit === 'lt' ? 'L' : row.unit,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
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
          observacao: c.observacao ?? '',
          status: c.status,
          cadastrada: c.cadastrada,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          operator: c.operador ?? 'Operador',
          items,
          total,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

salesAndPdvRouter.post('/comandas', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { identificador, observacao, items, cadastrada, prefixo, inicio, fim } = req.body as {
      identificador?: string;
      observacao?: string;
      cadastrada?: boolean;
      prefixo?: string;
      inicio?: number;
      fim?: number;
      items?: Array<{ productId: string; quantity: number; unitPrice: number }>;
    };

    // Cadastro em lote de comandas/mesas (ex: MESA 01 a MESA 10)
    if (cadastrada && prefixo !== undefined && inicio !== undefined && fim !== undefined) {
      const start = Math.max(1, Math.floor(Number(inicio)));
      const end = Math.min(start + 49, Math.floor(Number(fim)));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        res.status(400).json({ error: 'Intervalo inválido para cadastro em lote.' });
        return;
      }
      const pref = String(prefixo).trim();
      await client.query('BEGIN');
      let createdCount = 0;
      for (let n = start; n <= end; n++) {
        const label = `${pref ? `${pref} ` : ''}${String(n).padStart(2, '0')}`;
        const exists = await client.query(
          `SELECT id FROM comandas WHERE LOWER(TRIM(identificador)) = LOWER($1) AND ativo = TRUE LIMIT 1`,
          [label]
        );
        if (exists.rows.length === 0) {
          await client.query(
            `INSERT INTO comandas (identificador, observacao, status, cadastrada, ativo, usuario_id)
             VALUES ($1, $2, 'LIVRE', TRUE, TRUE, $3)`,
            [label, observacao?.trim() || null, req.user!.id]
          );
          createdCount++;
        }
      }
      await client.query('COMMIT');
      res.status(201).json({ ok: true, createdCount });
      return;
    }

    const label = String(identificador ?? '').trim();
    if (!label) {
      res.status(400).json({ error: 'Informe a identificação da comanda (ex: MESA 01 ou Nome).' });
      return;
    }

    // Cadastro individual de comanda fixa/reutilizável
    if (cadastrada) {
      const exists = await pool.query(
        `SELECT id FROM comandas WHERE LOWER(TRIM(identificador)) = LOWER($1) AND ativo = TRUE LIMIT 1`,
        [label]
      );
      if (exists.rows.length > 0) {
        res.status(409).json({ error: `Já existe uma comanda cadastrada com o nome "${label}".` });
        return;
      }
      const inserted = await pool.query<{ id: number }>(
        `INSERT INTO comandas (identificador, observacao, status, cadastrada, ativo, usuario_id)
         VALUES ($1, $2, 'LIVRE', TRUE, TRUE, $3) RETURNING id`,
        [label, observacao?.trim() || null, req.user!.id]
      );
      res.status(201).json({ id: String(inserted.rows[0].id), ok: true });
      return;
    }

    // Abertura avulsa no PDV com itens
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Adicione pelo menos um item para abrir a comanda.' });
      return;
    }

    await client.query('BEGIN');
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO comandas (identificador, observacao, status, cadastrada, ativo, usuario_id)
       VALUES ($1, $2, 'ABERTA', FALSE, TRUE, $3) RETURNING id`,
      [label, observacao?.trim() || null, req.user!.id]
    );
    const comandaId = inserted.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO comanda_itens (comanda_id, produto_id, quantidade, preco_unitario)
         VALUES ($1, $2, $3, $4)`,
        [comandaId, Number(item.productId), Number(item.quantity), Number(item.unitPrice)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: String(comandaId), ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});

salesAndPdvRouter.put('/comandas/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de comanda inválido.' });
      return;
    }
    const { items, observacao } = req.body as {
      observacao?: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'A comanda precisa ter ao menos um item.' });
      return;
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE comandas SET status = 'ABERTA', observacao = COALESCE($1, observacao), updated_at = NOW()
       WHERE id = $2 AND ativo = TRUE`,
      [observacao?.trim() || null, id]
    );
    await client.query('DELETE FROM comanda_itens WHERE comanda_id = $1', [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO comanda_itens (comanda_id, produto_id, quantidade, preco_unitario)
         VALUES ($1, $2, $3, $4)`,
        [id, Number(item.productId), Number(item.quantity), Number(item.unitPrice)]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});

salesAndPdvRouter.post('/comandas/:id/close', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de comanda inválido.' });
      return;
    }
    const { vendaId } = req.body as { vendaId?: string | number };
    await client.query('BEGIN');
    const existing = await client.query<{ cadastrada: boolean }>(
      'SELECT cadastrada FROM comandas WHERE id = $1',
      [id]
    );
    if (existing.rows[0]?.cadastrada) {
      await client.query('DELETE FROM comanda_itens WHERE comanda_id = $1', [id]);
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
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});

salesAndPdvRouter.delete('/comandas/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de comanda inválido.' });
      return;
    }
    const archive = req.query.mode === 'archive';
    await client.query('BEGIN');
    const existing = await client.query<{ cadastrada: boolean }>(
      'SELECT cadastrada FROM comandas WHERE id = $1',
      [id]
    );
    if (archive) {
      await client.query('DELETE FROM comanda_itens WHERE comanda_id = $1', [id]);
      await client.query('UPDATE comandas SET ativo = FALSE, updated_at = NOW() WHERE id = $1', [id]);
    } else if (existing.rows[0]?.cadastrada) {
      await client.query('DELETE FROM comanda_itens WHERE comanda_id = $1', [id]);
      await client.query(
        `UPDATE comandas SET status = 'LIVRE', observacao = NULL, updated_at = NOW() WHERE id = $1`,
        [id]
      );
    } else {
      await client.query(`DELETE FROM comandas WHERE id = $1 AND status = 'ABERTA'`, [id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: safeErrorMessage(err) });
  } finally {
    client.release();
  }
});
